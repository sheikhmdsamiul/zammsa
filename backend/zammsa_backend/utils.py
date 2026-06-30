import logging
import re

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# Prefix registry. Most IDs use [Prefix]-[Fiscal Year]-[Department]-[Sequential Number].
# APP IDs intentionally omit the department segment.
ID_PREFIXES = {
    'APP': 'Annual Procurement Plan',
    'REQ': 'Requisition',
    'CPP': 'Contract Procurement Plan',
    'GPN': 'General Procurement Notice',
    'SOL': 'Solicitation',
    'BID': 'Bid Submission',
    'RCT': 'Bid Receipt',
    'BER': 'Bid Evaluation Report',
    'CON': 'Contract',
    'PO': 'Purchase Order',
    'DLV': 'Delivery Advice',
    'GRN': 'Goods Receipt Note',
    'INV': 'Invoice',
    'LOC': 'Letter of Credit',
    'ENC': 'Budget Encumbrance',
}

TRACEABLE_ID_PATTERN = re.compile(
    r'^(?P<prefix>[A-Z]{2,4})-(?P<fiscal_year>\d{4})(?:-(?P<department>[A-Z0-9]{2,3}))?-(?P<sequence>\d{4,5})$'
)

DEFAULT_DEPARTMENT_CODE = 'PRC'
SEQUENTIAL_WIDTH = 5


def normalize_department_code(department_code):
    code = re.sub(r'[^A-Z0-9]', '', str(department_code or '').strip().upper())
    return code[:3] or DEFAULT_DEPARTMENT_CODE


def normalize_fiscal_year_code(fiscal_year):
    fiscal_year = str(fiscal_year or timezone.now().year).strip()
    match = re.search(r'\d{4}', fiscal_year)
    if match:
        return match.group(0)
    return fiscal_year[:4].upper()


def get_current_fiscal_year_code():
    try:
        from master_data.models import FiscalYear

        fy = FiscalYear.objects.filter(is_current=True).first()
        if fy:
            return normalize_fiscal_year_code(fy.year_code)
    except Exception as exc:
        logger.warning('Failed to fetch current fiscal year from DB: %s', exc)
    return str(timezone.now().year)


def resolve_requisition_context(requisition):
    if not requisition:
        return DEFAULT_DEPARTMENT_CODE, None

    dept = requisition.department.dept_code if requisition.department else DEFAULT_DEPARTMENT_CODE
    fiscal_year = None
    if requisition.app_line_item and requisition.app_line_item.app:
        fiscal_year = requisition.app_line_item.app.fiscal_year.year_code
    return dept, fiscal_year


def resolve_solicitation_context(solicitation):
    if not solicitation:
        return DEFAULT_DEPARTMENT_CODE, None

    dept = DEFAULT_DEPARTMENT_CODE
    if solicitation.department:
        dept = solicitation.department.dept_code
    elif solicitation.requisition and solicitation.requisition.department:
        dept = solicitation.requisition.department.dept_code

    fiscal_year = None
    if solicitation.requisition and solicitation.requisition.app_line_item and solicitation.requisition.app_line_item.app:
        fiscal_year = solicitation.requisition.app_line_item.app.fiscal_year.year_code
    elif (
        solicitation.cpp
        and solicitation.cpp.requisition
        and solicitation.cpp.requisition.app_line_item
        and solicitation.cpp.requisition.app_line_item.app
    ):
        fiscal_year = solicitation.cpp.requisition.app_line_item.app.fiscal_year.year_code
    return dept, fiscal_year


def resolve_app_context(app):
    if not app:
        return DEFAULT_DEPARTMENT_CODE, None

    dept = app.department.dept_code if app.department else DEFAULT_DEPARTMENT_CODE
    fiscal_year = app.fiscal_year.year_code if app.fiscal_year else None
    return dept, fiscal_year


def resolve_contract_context(contract):
    if not contract or not contract.solicitation:
        return DEFAULT_DEPARTMENT_CODE, None
    return resolve_solicitation_context(contract.solicitation)


def parse_traceable_id(value):
    if not value:
        return None

    match = TRACEABLE_ID_PATTERN.match(str(value).strip().upper())
    if not match:
        return None

    return {
        'prefix': match.group('prefix'),
        'fiscal_year': match.group('fiscal_year'),
        'department': match.group('department'),
        'sequence': int(match.group('sequence')),
        'raw': value,
    }


def is_traceable_id(value):
    return parse_traceable_id(value) is not None


def needs_traceable_id_regeneration(value, prefix):
    if not value:
        return True

    parsed = parse_traceable_id(value)
    return not parsed or parsed['prefix'] != prefix.upper()


def _scan_max_sequence(model_class, field_name, prefix_str):
    filter_kwargs = {f'{field_name}__startswith': prefix_str}
    existing_ids = model_class.objects.filter(**filter_kwargs).values_list(field_name, flat=True)

    max_seq = 0
    for val in existing_ids:
        parsed = parse_traceable_id(val)
        if parsed:
            max_seq = max(max_seq, parsed['sequence'])
            continue
        try:
            parts = str(val).split('-')
            if len(parts) >= 4:
                max_seq = max(max_seq, int(parts[-1]))
        except (ValueError, IndexError):
            continue
    return max_seq


def _allocate_sequence(prefix, fiscal_year, department_code, model_class, field_name, include_department=True):
    from master_data.models import IdSequence

    dept_code = normalize_department_code(department_code)
    prefix = prefix.upper()
    fiscal_year = normalize_fiscal_year_code(fiscal_year)
    sequence_dept_code = dept_code if include_department else prefix[:3]
    prefix_str = f'{prefix}-{fiscal_year}-{dept_code}-' if include_department else f'{prefix}-{fiscal_year}-'

    with transaction.atomic():
        IdSequence.objects.get_or_create(
            prefix=prefix,
            fiscal_year=fiscal_year,
            department_code=sequence_dept_code,
            defaults={'last_sequence': 0},
        )
        seq_obj = IdSequence.objects.select_for_update().get(
            prefix=prefix,
            fiscal_year=fiscal_year,
            department_code=sequence_dept_code,
        )
        if seq_obj.last_sequence == 0:
            scanned = _scan_max_sequence(model_class, field_name, prefix_str)
            if scanned > seq_obj.last_sequence:
                seq_obj.last_sequence = scanned
                seq_obj.save(update_fields=['last_sequence'])

        seq_obj.last_sequence += 1
        next_seq = seq_obj.last_sequence
        seq_obj.save(update_fields=['last_sequence'])

    return next_seq


def generate_traceable_id(
    prefix,
    department_code,
    model_class,
    field_name,
    fiscal_year=None,
    seq_width=SEQUENTIAL_WIDTH,
):
    """
    Construct trace IDs using a 4-part hierarchical structure:
    [Prefix]-[Fiscal Year]-[Department/Entity]-[Sequential Number]

    Sequential counters reset per fiscal year and department, and are allocated
    atomically to avoid collisions under concurrent load.
    """
    if not fiscal_year:
        fiscal_year = get_current_fiscal_year_code()
    else:
        fiscal_year = normalize_fiscal_year_code(fiscal_year)

    dept_code = normalize_department_code(department_code)
    prefix = prefix.upper()

    include_department = prefix != 'APP'
    next_seq = _allocate_sequence(prefix, fiscal_year, dept_code, model_class, field_name, include_department)
    if not include_department:
        return f'{prefix}-{fiscal_year}-{next_seq:0{seq_width}d}'
    return f'{prefix}-{fiscal_year}-{dept_code}-{next_seq:0{seq_width}d}'

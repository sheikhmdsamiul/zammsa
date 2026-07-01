import hashlib
import json
import logging
from datetime import datetime
from django.template import Template, Context
from django.utils import timezone

logger = logging.getLogger(__name__)

PLACEHOLDER_PREFIX = '{{'
PLACEHOLDER_SUFFIX = '}}'

PLACEHOLDER_MAP = {
    'sol_number': 'sol_number',
    'title': 'title',
    'description': 'description',
    'issue_date': 'issue_date',
    'closing_date': 'closing_date',
    'opening_date': 'opening_date',
    'estimated_value': 'estimated_value',
    'currency': 'currency',
    'budget_code': 'budget_code',
    'department': 'department_name',
    'submission_format': 'submission_format',
    'bid_validity_days': 'bid_validity_days',
    'pre_bid_date': 'pre_bid_date',
    'pre_bid_venue': 'pre_bid_venue',
    'citizen_preference': 'citizen_preference',
    'bid_security_required': 'bid_security_required',
    'bid_security_type': 'bid_security_type',
    'bid_security_rate': 'bid_security_rate',
    'contact_person': 'contact_person',
    'contact_phone': 'contact_phone',
    'contact_email': 'contact_email',
    'minimum_technical_threshold': 'minimum_technical_threshold',
    'evaluation_method': 'evaluation_method_display',
    'clarification_cutoff': 'clarification_cutoff',
    'req_number': 'requisition_number',
    'cpp_number': 'cpp_number',
    'cpp_method': 'cpp_method_display',
    'cpp_procurement_strategy': 'cpp_procurement_strategy',
    'cpp_estimated_value': 'cpp_estimated_value',
    'cpp_baseline_locked': 'cpp_baseline_locked',
    'cpp_baseline_locked_date': 'cpp_baseline_locked_date',
    'organization_name': 'organization_name',
    'organization_logo_url': 'organization_logo_url',
    'items_table': 'items_table',
    'criteria_table': 'criteria_table',
    'addenda_table': 'addenda_table',
}

SCC_PLACEHOLDER_MAP = {
    'scc_contract_value': 'estimated_value',
    'scc_payment_terms': 'payment_terms_display',
    'scc_retention_rate': 'retention_rate',
    'scc_ld_rate': 'ld_rate',
    'scc_ld_cap': 'ld_cap',
    'scc_performance_security': 'performance_security',
    'scc_amendment_cap': 'amendment_cap',
}


def build_template_context(solicitation):
    """Build a flat dict of all placeholder values from a solicitation."""
    ctx = {}

    ctx['sol_number'] = solicitation.sol_number or ''
    ctx['title'] = solicitation.title or ''
    ctx['description'] = solicitation.description or ''
    ctx['issue_date'] = _fmt_date(solicitation.issue_date)
    ctx['closing_date'] = _fmt_datetime(solicitation.closing_date)
    ctx['opening_date'] = _fmt_datetime(solicitation.opening_date)
    ctx['estimated_value'] = str(solicitation.estimated_value or '')
    ctx['currency'] = solicitation.currency or 'ZMW'
    ctx['budget_code'] = solicitation.budget_code or ''
    ctx['department_name'] = _get_dept_name(solicitation)
    ctx['submission_format'] = solicitation.get_submission_format_display() or solicitation.submission_format or ''
    ctx['bid_validity_days'] = str(solicitation.bid_validity_days or '')
    ctx['pre_bid_date'] = _fmt_date(solicitation.pre_bid_date)
    ctx['pre_bid_venue'] = solicitation.pre_bid_venue or ''
    ctx['citizen_preference'] = 'Applicable' if solicitation.citizen_preference else 'Not Applicable'
    ctx['bid_security_required'] = 'Yes' if solicitation.bid_security_required else 'No'
    ctx['bid_security_type'] = _format_security_type(solicitation.bid_security_type)
    ctx['bid_security_rate'] = str(solicitation.bid_security_rate or '') + '%' if solicitation.bid_security_rate else ''
    ctx['contact_person'] = solicitation.contact_person or ''
    ctx['contact_phone'] = solicitation.contact_phone or ''
    ctx['contact_email'] = solicitation.contact_email or ''
    ctx['minimum_technical_threshold'] = str(solicitation.minimum_technical_threshold or '') + ' points' if solicitation.minimum_technical_threshold else ''
    ctx['evaluation_method_display'] = _get_evaluation_method_display(solicitation)
    ctx['clarification_cutoff'] = _fmt_datetime(solicitation.clarification_cutoff)

    ctx['requisition_number'] = solicitation.requisition.req_number if solicitation.requisition else ''
    
    # SRS FR-SOL-01: Enhanced CPP data integration
    if solicitation.cpp:
        ctx['cpp_number'] = solicitation.cpp.cpp_number or ''
        ctx['cpp_method_display'] = _get_cpp_method_display(solicitation.cpp.method)
        ctx['cpp_procurement_strategy'] = solicitation.cpp.procurement_strategy or 'Standard procurement strategy'
        ctx['cpp_estimated_value'] = f"{solicitation.cpp.estimated_value:,.2f} ZMW" if solicitation.cpp.estimated_value else ''
        ctx['cpp_baseline_locked'] = 'Yes (Locked)' if solicitation.cpp.is_baseline_locked else 'No (Unlocked)'
        ctx['cpp_baseline_locked_date'] = _fmt_date(solicitation.cpp.baseline_locked_at) if solicitation.cpp.baseline_locked_at else ''
    else:
        ctx['cpp_number'] = ''
        ctx['cpp_method_display'] = ''
        ctx['cpp_procurement_strategy'] = ''
        ctx['cpp_estimated_value'] = ''
        ctx['cpp_baseline_locked'] = ''
        ctx['cpp_baseline_locked_date'] = ''

    from django.conf import settings
    ctx['organization_name'] = 'Zambia Medicines and Medical Supplies Agency (ZAMMSA)'
    ctx['organization_logo_url'] = ''

    ctx['items_table'] = _build_items_table(solicitation)
    ctx['criteria_table'] = _build_criteria_table(solicitation)
    ctx['addenda_table'] = _build_addenda_table(solicitation)

    ctx['payment_terms_display'] = '30 days from approved invoice'
    ctx['retention_rate'] = '5%'
    ctx['ld_rate'] = '0.5% per week'
    ctx['ld_cap'] = '10% of contract value'
    ctx['performance_security'] = '5% of contract value'
    ctx['amendment_cap'] = '25% cumulative'

    return ctx


def merge_template(solicitation, template_content):
    """Replace all placeholders in template_content with solicitation data."""
    ctx = build_template_context(solicitation)
    result = template_content
    for key, value in ctx.items():
        placeholder = f'{PLACEHOLDER_PREFIX}{key}{PLACEHOLDER_SUFFIX}'
        if placeholder in result:
            result = result.replace(placeholder, str(value))
    return result


def compute_document_hash(content: bytes) -> str:
    """Compute SHA-256 hash of document content for integrity verification."""
    return hashlib.sha256(content).hexdigest()


def _fmt_date(d):
    if not d:
        return ''
    if isinstance(d, str):
        return d
    return d.strftime('%d %B %Y') if hasattr(d, 'strftime') else str(d)


def _fmt_datetime(d):
    if not d:
        return ''
    if isinstance(d, str):
        return d
    return d.strftime('%d %B %Y at %H:%M') if hasattr(d, 'strftime') else str(d)


def _get_dept_name(sol):
    if sol.department:
        return sol.department.dept_name
    if sol.requisition and sol.requisition.department:
        return sol.requisition.department.dept_name
    return ''


def _format_security_type(st):
    mapping = {
        'bank_guarantee': 'Bank Guarantee',
        'surety_bond': 'Surety Bond',
        'cash': 'Cash Deposit',
    }
    return mapping.get(st, st or '')


def _get_evaluation_method_display(sol):
    method = sol.evaluation_method or 'lowest_price'
    mapping = {
        'lowest_price': 'Lowest Evaluated Price',
        'qcbs': 'Quality and Cost Based Selection (QCBS)',
        'qbs': 'Quality Based Selection (QBS)',
        'lcs': 'Least Cost Selection (LCS)',
        'fbs': 'Fixed Budget Selection (FBS)',
    }
    return mapping.get(method, method)


def _get_cpp_method_display(method):
    """Get display name for CPP procurement method (SRS FR-METHOD-01)."""
    if not method:
        return ''
    mapping = {
        'open_tender': 'Open National Bidding (ONB)',
        'international': 'Open International Bidding (OIB)',
        'limited': 'Limited Bidding (LB)',
        'simplified': 'Simplified Bidding (SB)',
        'direct': 'Direct Procurement (DP)',
    }
    return mapping.get(method, method.replace('_', ' ').title())


def _build_items_table(sol):
    if not sol.requisition:
        return ''
    items = sol.requisition.items.all()
    if not items:
        return ''
    rows = ''.join(
        f'<tr><td style="padding:8px;border:1px solid #d1d5db;">{i.description}</td>'
        f'<td style="padding:8px;border:1px solid #d1d5db;text-align:center;">{i.quantity}</td>'
        f'<td style="padding:8px;border:1px solid #d1d5db;text-align:center;">{i.unit_of_measure.uom_name if i.unit_of_measure else ""}</td>'
        f'<td style="padding:8px;border:1px solid #d1d5db;text-align:right;">{i.total_estimate or ""}</td></tr>'
        for i in items
    )
    return (
        '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">'
        '<thead><tr style="background:#f3f4f6;">'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:left;">Description</th>'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:center;">Quantity</th>'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:center;">Unit</th>'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:right;">Total (ZMW)</th>'
        '</tr></thead><tbody>' + rows + '</tbody></table>'
    )


def _build_criteria_table(sol):
    criteria = sol.evaluation_criteria.all().order_by('order_index')
    if not criteria:
        return ''
    rows = ''.join(
        f'<tr><td style="padding:8px;border:1px solid #d1d5db;">{c.criterion_name}</td>'
        f'<td style="padding:8px;border:1px solid #d1d5db;text-align:center;">{c.get_criterion_type_display()}</td>'
        f'<td style="padding:8px;border:1px solid #d1d5db;text-align:center;">{c.weight}%</td>'
        f'<td style="padding:8px;border:1px solid #d1d5db;text-align:center;">{c.max_score}</td></tr>'
        for c in criteria
    )
    return (
        '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">'
        '<thead><tr style="background:#f3f4f6;">'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:left;">Criterion</th>'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:center;">Type</th>'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:center;">Weight</th>'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:center;">Max Score</th>'
        '</tr></thead><tbody>' + rows + '</tbody></table>'
    )


def _build_addenda_table(sol):
    addenda = sol.addenda.all().order_by('addendum_number')
    if not addenda:
        return ''
    rows = ''.join(
        f'<tr><td style="padding:8px;border:1px solid #d1d5db;text-align:center;">{a.addendum_number}</td>'
        f'<td style="padding:8px;border:1px solid #d1d5db;">{a.description[:100]}</td>'
        f'<td style="padding:8px;border:1px solid #d1d5db;text-align:center;">{_fmt_datetime(a.created_at)}</td>'
        f'<td style="padding:8px;border:1px solid #d1d5db;text-align:center;">{_fmt_datetime(a.extended_closing_date) if a.extended_closing_date else "—"}</td></tr>'
        for a in addenda
    )
    return (
        '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">'
        '<thead><tr style="background:#f3f4f6;">'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:center;">No.</th>'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:left;">Description</th>'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:center;">Issued</th>'
        '<th style="padding:10px;border:1px solid #d1d5db;text-align:center;">Extended Closing</th>'
        '</tr></thead><tbody>' + rows + '</tbody></table>'
    )

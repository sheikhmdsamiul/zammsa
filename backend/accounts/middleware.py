import re
from django.utils import timezone
from django.conf import settings


SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')

ROLE_PERMISSION_MAP = {
    'system_admin': {'*'},
    'director_procurement': {
        'requisitions.*', 'solicitations.*', 'bids.*', 'evaluations.*',
        'contracts.*', 'suppliers.*', 'reporting.*', 'procurement_planning.*',
        'method_selection.*', 'master_data.*', 'system_config.*',
    },
    'director_general': {
        'contracts.*', 'reporting.dashboard', 'reporting.*',
        'suppliers.*', 'procurement_planning.*',
    },
    'zpc_member': {
        'contracts.view', 'contracts.amendments.approve',
        'evaluations.view', 'reporting.view',
    },
    'procurement_officer': {
        'requisitions.*', 'solicitations.*', 'bids.*', 'evaluations.*',
        'contracts.*', 'procurement_planning.*', 'method_selection.*',
    },
    'procurement_manager': {
        'requisitions.*', 'solicitations.*', 'bids.*', 'evaluations.*',
        'contracts.*', 'suppliers.*', 'procurement_planning.*',
    },
    'finance_officer': {
        'finance.*', 'contracts.view', 'reporting.view',
    },
    'budget_controller': {
        'finance.*', 'reporting.view',
    },
    'department_head': {
        'requisitions.*', 'reports.view', 'procurement_planning.view',
    },
    'user_dept_staff': {
        'requisitions.create', 'requisitions.view',
    },
    'evaluation_committee_member': {
        'evaluations.score', 'evaluations.view',
    },
    'evaluation_committee_chair': {
        'evaluations.*', 'bids.view',
    },
    'contract_manager': {
        'contracts.*', 'reporting.view',
    },
    'supplier_relationship_manager': {
        'suppliers.*',
    },
    'supplier_user': {
        'bids.submit', 'bids.view', 'contracts.sign', 'contracts.view',
        'finance.invoices.view',
    },
    'auditor': {
        '*.view', '*.read', 'audit-logs.*',
    },
    'zppa_reporting_officer': {
        'reporting.*', 'contracts.view',
    },
    'public_portal_viewer': {
        'public.*',
    },
}


def _module_from_path(path):
    path = path.lstrip('/')
    parts = path.split('/')
    if parts:
        return parts[0]
    return ''


def _action_from_method(method):
    method_map = {
        'GET': 'view',
        'POST': 'create',
        'PUT': 'update',
        'PATCH': 'update',
        'DELETE': 'delete',
    }
    return method_map.get(method, 'view')


def _check_permission(user, module, action):
    if not user or not user.is_authenticated:
        return False
    role = getattr(user, 'role', '')
    permissions = ROLE_PERMISSION_MAP.get(role, set())
    for perm in permissions:
        if perm == '*':
            return True
        if perm == '{}.*'.format(module):
            return True
        if perm == '*.{}'.format(action):
            return True
        mod, _, act = perm.partition('.')
        if mod == module and act == '*':
            return True
        if mod == module and act == action:
            return True
        if mod == module and act == 'view' and action in ('view', 'read'):
            return True
        if mod == '*' and act == action:
            return True
    return False


SAFE_PATHS = (
    '/auth/login',
    '/auth/mfa-login',
    '/auth/logout',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/api/public',
    '/public/',
    '/swagger',
    '/redoc',
    '/admin',
)


class RBACEnforcementMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, 'DEBUG', False) and not getattr(settings, 'ENFORCE_RBAC', True):
            return self.get_response(request)

        path = request.path_info
        if any(path.startswith(p) for p in SAFE_PATHS):
            return self.get_response(request)

        if request.method in SAFE_METHODS:
            return self.get_response(request)

        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return self.get_response(request)

        module = _module_from_path(path)
        action = _action_from_method(request.method)

        if not _check_permission(user, module, action):
            from django.http import JsonResponse
            return JsonResponse(
                {'error': 'You do not have permission to perform this action',
                 'required_role': f'Access to {module}.{action} denied'},
                status=403,
            )

        return self.get_response(request)


class AuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.method in SAFE_METHODS:
            return response
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return response
        path = request.path_info
        if any(path.startswith(p) for p in SAFE_PATHS):
            return response
        from .audit import log_audit_action
        ip = request.META.get('REMOTE_ADDR', '')
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if x_forwarded:
            ip = x_forwarded.split(',')[0].strip()
        if response.status_code < 400:
            module = _module_from_path(path)
            action = _action_from_method(request.method)
            log_audit_action(
                user=user,
                action=action,
                module=module,
                record_id='',
                ip_address=ip,
            )
        return response

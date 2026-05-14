from django.core.management.base import BaseCommand
from accounts.models import Permission, Role, RolePermission

MODULES = [
    'requisitions', 'solicitations', 'bids', 'evaluations', 'contracts',
    'finance', 'suppliers', 'procurement_planning', 'method_selection',
    'reporting', 'integrations', 'master_data', 'system_config', 'users',
]
ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'export', 'import']
RESOURCE_TYPES = ['own', 'department', 'all']

PERMISSION_MATRIX = {
    'system_admin': {},
    'director_general': {
        'requisitions': ['read', 'approve', 'export'],
        'solicitations': ['read', 'approve', 'export'],
        'bids': ['read', 'export'],
        'evaluations': ['read', 'approve'],
        'contracts': ['read', 'approve', 'export'],
        'finance': ['read', 'export'],
        'suppliers': ['read'],
        'procurement_planning': ['read', 'approve'],
        'method_selection': ['read', 'approve'],
        'reporting': ['read', 'create', 'export'],
        'users': ['read'],
    },
    'director_procurement': {
        'requisitions': ['read', 'approve', 'export'],
        'solicitations': ['read', 'export'],
        'bids': ['read', 'export'],
        'evaluations': ['read', 'approve'],
        'contracts': ['create', 'read', 'update', 'approve', 'export'],
        'finance': ['read', 'export'],
        'suppliers': ['read', 'update'],
        'procurement_planning': ['create', 'read', 'update', 'approve'],
        'method_selection': ['create', 'read', 'update', 'approve'],
        'reporting': ['read', 'create', 'export'],
        'master_data': ['read', 'update'],
        'users': ['read'],
    },
    'zpc_member': {
        'evaluations': ['read', 'approve'],
        'contracts': ['read', 'approve'],
        'reporting': ['read', 'export'],
    },
    'procurement_manager': {
        'requisitions': ['read'],
        'solicitations': ['read', 'approve'],
        'bids': ['read', 'update'],
        'evaluations': ['read'],
        'contracts': ['create', 'read', 'update'],
        'suppliers': ['read'],
        'procurement_planning': ['create', 'read', 'update'],
        'method_selection': ['create', 'read', 'update'],
        'reporting': ['read', 'create', 'export'],
    },
    'procurement_officer': {
        'requisitions': ['read'],
        'solicitations': ['create', 'read', 'update'],
        'bids': ['read'],
        'evaluations': ['read'],
        'contracts': ['create', 'read', 'update'],
        'suppliers': ['read'],
        'procurement_planning': ['read'],
        'method_selection': ['read'],
        'reporting': ['read'],
    },
    'budget_controller': {
        'finance': ['create', 'read', 'update', 'approve', 'export'],
        'requisitions': ['read', 'approve'],
        'contracts': ['read'],
        'procurement_planning': ['read', 'approve'],
    },
    'finance_officer': {
        'finance': ['create', 'read', 'update', 'approve', 'export'],
        'requisitions': ['read'],
        'contracts': ['read'],
    },
    'department_head': {
        'requisitions': ['read', 'approve'],
        'solicitations': ['read'],
        'contracts': ['read'],
        'reporting': ['read'],
        'procurement_planning': ['read', 'approve'],
    },
    'user_dept_staff': {
        'requisitions': ['create', 'read', 'update'],
        'procurement_planning': ['read'],
    },
    'evaluation_committee_chair': {
        'evaluations': ['read', 'create', 'update', 'approve', 'export'],
        'bids': ['read'],
    },
    'evaluation_committee_member': {
        'evaluations': ['read', 'create', 'update'],
        'bids': ['read'],
    },
    'contract_manager': {
        'contracts': ['create', 'read', 'update', 'export'],
        'evaluations': ['read'],
    },
    'supplier_relationship_manager': {
        'suppliers': ['create', 'read', 'update', 'export'],
        'contracts': ['read'],
    },
    'supplier_user': {
        'bids': ['create', 'read', 'update'],
        'contracts': ['read'],
        'suppliers': ['read'],
    },
    'auditor': {
        'requisitions': ['read', 'export'],
        'solicitations': ['read', 'export'],
        'bids': ['read', 'export'],
        'evaluations': ['read', 'export'],
        'contracts': ['read', 'export'],
        'finance': ['read', 'export'],
        'suppliers': ['read', 'export'],
        'procurement_planning': ['read', 'export'],
        'method_selection': ['read', 'export'],
        'reporting': ['read', 'export'],
        'users': ['read'],
        'integrations': ['read'],
        'master_data': ['read'],
        'system_config': ['read'],
    },
    'zppa_reporting_officer': {
        'reporting': ['read', 'create', 'export'],
        'solicitations': ['read'],
        'contracts': ['read'],
    },
    'integration_manager': {
        'integrations': ['create', 'read', 'update', 'delete'],
        'master_data': ['read', 'update'],
        'system_config': ['read'],
    },
    'public_portal_viewer': {
        'solicitations': ['read'],
        'reporting': ['read'],
    },
}


class Command(BaseCommand):
    help = 'Seed permissions and assign to roles'

    def handle(self, *args, **options):
        for module in MODULES:
            for action in ACTIONS:
                for resource_type in RESOURCE_TYPES:
                    Permission.objects.get_or_create(
                        module=module,
                        action=action,
                        resource_type=resource_type,
                    )
        self.stdout.write(self.style.SUCCESS(f'Created {len(MODULES) * len(ACTIONS) * len(RESOURCE_TYPES)} permissions'))

        for role_name, modules in PERMISSION_MATRIX.items():
            role = Role.objects.filter(role_name=role_name).first()
            if not role:
                continue
            if role_name == 'system_admin':
                all_perms = Permission.objects.all()
                for perm in all_perms:
                    RolePermission.objects.get_or_create(role=role, permission=perm)
                self.stdout.write(self.style.SUCCESS(f'Assigned {all_perms.count()} permissions to {role_name}'))
            else:
                count = 0
                for mod, actions in modules.items():
                    for act in actions:
                        perm = Permission.objects.filter(module=mod, action=act).first()
                        if not perm:
                            perm = Permission.objects.get_or_create(module=mod, action=act, resource_type='own')[0]
                        _, created = RolePermission.objects.get_or_create(role=role, permission=perm)
                        if created:
                            count += 1
                self.stdout.write(self.style.SUCCESS(f'Assigned permissions to {role_name}'))

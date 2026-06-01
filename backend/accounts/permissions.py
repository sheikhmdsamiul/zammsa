from rest_framework.permissions import BasePermission


class IsSystemAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'system_admin'


class IsProcurementOfficer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            'procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin',
        )


class IsFinanceOfficer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            'finance_officer', 'budget_controller', 'system_admin',
        )


class IsZPCMember(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'zpc_member'


class IsDirectorGeneral(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'director_general'


class IsDepartmentHead(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            'department_head', 'director_general', 'system_admin',
        )


class IsSupplierUser(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'supplier_user'


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role in (
            'system_admin', 'director_procurement', 'director_general',
        )


class CanManageEvaluationCommittees(BasePermission):
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.is_authenticated

        return request.user.is_authenticated and request.user.role in (
            'procurement_officer',
            'procurement_manager',
            'director_procurement',
            'system_admin',
        )

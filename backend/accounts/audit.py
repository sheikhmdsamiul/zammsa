from django.utils import timezone
from .models import AuditLog


def log_audit_action(
    user,
    action,
    module,
    record_id='',
    old_value=None,
    new_value=None,
    ip_address=None,
):
    if not user or not user.is_authenticated:
        return
    AuditLog.objects.create(
        user=user,
        action=action,
        module=module,
        record_id=str(record_id) if record_id else '',
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address,
        timestamp=timezone.now(),
    )

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template import Context, Template
from django.utils import timezone

from accounts.models import User
from .models import Notification, NotificationTemplate

logger = logging.getLogger(__name__)


def _render_template(template_key, context):
    if not template_key:
        return None

    template = NotificationTemplate.objects.filter(template_key=template_key, is_active=True).first()
    if not template:
        return None

    render_context = Context(context or {}, autoescape=False)
    return {
        'title': Template(template.subject_template).render(render_context),
        'message': Template(template.body_template).render(render_context),
    }


def _normalize_channels(channels, email_required=False, sms_required=False):
    normalized = set(channels or ['in_app'])
    normalized.add('in_app')
    if email_required:
        normalized.add('email')
    if sms_required:
        normalized.add('sms')
    return sorted(normalized)


def deliver_notification(notification):
    update_fields = []

    if notification.email_required and notification.recipient.email:
        notification.email_attempts += 1
        update_fields.append('email_attempts')
        try:
            send_mail(
                subject=notification.title,
                message=notification.message,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
                recipient_list=[notification.recipient.email],
                fail_silently=False,
            )
            notification.email_status = 'sent'
            notification.email_sent_at = timezone.now()
            notification.email_last_error = ''
            update_fields.extend(['email_status', 'email_sent_at', 'email_last_error'])
        except Exception as exc:  # pragma: no cover - exact backend failures vary by environment
            notification.email_status = 'failed'
            notification.email_last_error = str(exc)[:2000]
            update_fields.extend(['email_status', 'email_last_error'])
            logger.warning('Notification email delivery failed: id=%s error=%s', notification.pk, exc)
    elif notification.email_required:
        notification.email_status = 'skipped'
        notification.email_last_error = 'Recipient has no email address'
        update_fields.extend(['email_status', 'email_last_error'])

    if notification.sms_required:
        notification.sms_attempts += 1
        update_fields.append('sms_attempts')
        if getattr(settings, 'SMS_GATEWAY_ENABLED', False):
            notification.sms_status = 'pending'
            notification.sms_last_error = 'SMS gateway integration is configured externally'
        else:
            notification.sms_status = 'skipped'
            notification.sms_last_error = 'SMS gateway is not enabled'
        update_fields.extend(['sms_status', 'sms_last_error'])

    if update_fields:
        notification.save(update_fields=sorted(set(update_fields)))

    return notification


def create_notification(
    recipient,
    title,
    message,
    notification_type='system',
    priority='normal',
    source_module='',
    object_id='',
    action_url='',
    metadata=None,
    email_required=False,
    sms_required=False,
    delivery_channels=None,
    template_key='',
    template_context=None,
    send_immediately=True,
):
    if not recipient or not getattr(recipient, 'is_active', True):
        return None

    rendered = _render_template(template_key, template_context or {})
    if rendered:
        title = rendered['title']
        message = rendered['message']

    channels = _normalize_channels(delivery_channels, email_required=email_required, sms_required=sms_required)
    email_required = email_required or 'email' in channels
    sms_required = sms_required or 'sms' in channels

    notification = Notification.objects.create(
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
        priority=priority,
        source_module=source_module,
        object_id=str(object_id or ''),
        action_url=action_url,
        metadata=metadata or {},
        delivery_channels=channels,
        email_required=email_required,
        email_status='pending' if email_required else 'not_required',
        sms_required=sms_required,
        sms_status='pending' if sms_required else 'not_required',
    )
    if send_immediately:
        return deliver_notification(notification)
    return notification


def notify_role(
    role,
    title,
    message,
    notification_type='workflow',
    priority='normal',
    source_module='',
    object_id='',
    action_url='',
    metadata=None,
    email_required=False,
    sms_required=False,
    delivery_channels=None,
    template_key='',
    template_context=None,
    exclude_user=None,
):
    recipients = User.objects.filter(role=role, is_active=True)
    if exclude_user:
        recipients = recipients.exclude(pk=exclude_user.pk)

    return [
        create_notification(
            recipient=user,
            title=title,
            message=message,
            notification_type=notification_type,
            priority=priority,
            source_module=source_module,
            object_id=object_id,
            action_url=action_url,
            metadata=metadata,
            email_required=email_required,
            sms_required=sms_required,
            delivery_channels=delivery_channels,
            template_key=template_key,
            template_context=template_context,
        )
        for user in recipients
    ]


def notify_roles(roles, *args, **kwargs):
    notifications = []
    for role in roles:
        notifications.extend([n for n in notify_role(role, *args, **kwargs) if n])
    return notifications


def notify_users(users, title, message, **kwargs):
    notifications = []
    seen = set()
    for user in users:
        if not user or user.pk in seen:
            continue
        seen.add(user.pk)
        notification = create_notification(user, title, message, **kwargs)
        if notification:
            notifications.append(notification)
    return notifications


def send_external_email(subject, message, recipient_email):
    if not recipient_email:
        return {'sent': False, 'error': 'Recipient email is required'}
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        return {'sent': True, 'error': ''}
    except Exception as exc:  # pragma: no cover - exact backend failures vary by environment
        logger.warning('External notification email failed: recipient=%s error=%s', recipient_email, exc)
        return {'sent': False, 'error': str(exc)[:2000]}


def send_external_bulk_email(subject, message, recipients):
    results = []
    seen = set()
    for recipient in recipients:
        email = recipient.get('email') if isinstance(recipient, dict) else recipient
        name = recipient.get('name', '') if isinstance(recipient, dict) else ''
        if not email or email in seen:
            continue
        seen.add(email)
        result = send_external_email(subject, message, email)
        results.append({
            'email': email,
            'name': name,
            'sent': result['sent'],
            'error': result.get('error', ''),
        })
    return {
        'total': len(results),
        'sent': sum(1 for item in results if item['sent']),
        'failed': sum(1 for item in results if not item['sent']),
        'recipients': results,
    }


def alert_integration_manager(title, message, metadata=None, priority='urgent', sms_required=False):
    return notify_role(
        'integration_manager',
        title,
        message,
        notification_type='system',
        priority=priority,
        source_module='integrations',
        metadata=metadata or {},
        email_required=True,
        sms_required=sms_required,
    )

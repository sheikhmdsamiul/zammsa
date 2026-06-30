from django.core import mail
from django.test import TestCase, override_settings

from accounts.models import User
from .models import Notification, NotificationTemplate
from .notifications import create_notification, notify_role


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class NotificationServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='reviewer@test.gov.zm',
            password='pass',
            employee_id='EMP-001',
            full_name='Reviewer One',
            role='department_head',
        )

    def test_create_notification_sends_email_and_records_delivery(self):
        notification = create_notification(
            self.user,
            title='Approval required',
            message='Please approve the requisition.',
            notification_type='approval',
            email_required=True,
        )

        self.assertEqual(notification.email_status, 'sent')
        self.assertIsNotNone(notification.email_sent_at)
        self.assertEqual(notification.email_attempts, 1)
        self.assertEqual(notification.delivery_channels, ['email', 'in_app'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['reviewer@test.gov.zm'])

    def test_notify_role_excludes_inactive_users(self):
        User.objects.create_user(
            email='inactive@test.gov.zm',
            password='pass',
            employee_id='EMP-002',
            full_name='Inactive Reviewer',
            role='department_head',
            is_active=False,
        )

        notifications = notify_role(
            'department_head',
            title='Submitted requisition',
            message='A requisition was submitted.',
            email_required=True,
        )

        self.assertEqual(len([n for n in notifications if n]), 1)
        self.assertEqual(Notification.objects.count(), 1)

    def test_template_key_renders_subject_and_body(self):
        NotificationTemplate.objects.create(
            template_key='approval.notice',
            subject_template='Review {{ req_number }}',
            body_template='Hello {{ name }}, review {{ req_number }}.',
            placeholders=['req_number', 'name'],
        )

        notification = create_notification(
            self.user,
            title='Fallback',
            message='Fallback',
            template_key='approval.notice',
            template_context={'req_number': 'REQ-001', 'name': 'Reviewer'},
        )

        self.assertEqual(notification.title, 'Review REQ-001')
        self.assertEqual(notification.message, 'Hello Reviewer, review REQ-001.')

    def test_sms_channel_is_recorded_as_skipped_when_gateway_disabled(self):
        notification = create_notification(
            self.user,
            title='Critical integration alert',
            message='ERP retries exhausted.',
            delivery_channels=['email', 'sms'],
        )

        self.assertTrue(notification.sms_required)
        self.assertEqual(notification.sms_status, 'skipped')
        self.assertEqual(notification.sms_attempts, 1)

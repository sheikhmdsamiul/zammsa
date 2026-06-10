from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from decimal import Decimal
import datetime

from accounts.models import User
from master_data.models import Department
from requisitions.models import Requisition, RequisitionItem


class RequisitionAttachmentAndTechnicalReviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='requester@example.com',
            password='password123',
            full_name='Requester',
            employee_id='REQ001',
            role='user_dept_staff',
        )
        self.department = Department.objects.create(
            dept_code='TEST',
            dept_name='Test Department',
            level='national',
        )
        self.requisition = Requisition.objects.create(
            department=self.department,
            requester=self.user,
            description='Test requisition',
            required_date=timezone.now().date(),
            estimated_total=Decimal('10000.00'),
        )
        self.item = RequisitionItem.objects.create(
            requisition=self.requisition,
            description='Test item',
            quantity=Decimal('10'),
            unit_price_estimate=Decimal('1000.00'),
        )
        self.submit_url = reverse('requisition-submit', kwargs={'pk': self.requisition.requisition_id})
        self.upload_url = reverse('requisition-item-upload', kwargs={'item_id': self.item.item_id})

    def test_submit_without_attachment_returns_400(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 400)
        self.assertIn('items_missing_attachment', response.data)

    def test_submit_with_all_attachments_returns_200(self):
        self.item.attachment = SimpleUploadedFile("test.pdf", b"content", content_type="application/pdf")
        self.item.save()
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 200)
        self.requisition.refresh_from_db()
        self.assertEqual(self.requisition.status, 'pending_dept_head')

    def test_technical_review_flag_set_when_item_exceeds_1M(self):
        large_item = RequisitionItem.objects.create(
            requisition=self.requisition,
            description='Large goods item',
            quantity=Decimal('10'),
            unit_price_estimate=Decimal('200000'),
        )
        large_item.attachment = SimpleUploadedFile("large.pdf", b"content", content_type="application/pdf")
        large_item.save()
        self.item.attachment = SimpleUploadedFile("test.pdf", b"content", content_type="application/pdf")
        self.item.save()
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 200)
        self.requisition.refresh_from_db()
        self.assertTrue(self.requisition.technical_review_required)

    def test_technical_review_flag_not_set_when_no_item_exceeds_1M(self):
        self.item.unit_price_estimate = Decimal('50000')
        self.item.quantity = Decimal('1')
        self.item.save()
        self.item.attachment = SimpleUploadedFile("small.pdf", b"content", content_type="application/pdf")
        self.item.save()
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 200)
        self.requisition.refresh_from_db()
        self.assertFalse(self.requisition.technical_review_required)

    def test_other_user_cannot_submit(self):
        other_user = User.objects.create_user(
            email='other@example.com',
            password='password123',
            full_name='Other User',
            employee_id='OTH001',
            role='user_dept_staff',
        )
        self.item.attachment = SimpleUploadedFile("test.pdf", b"content", content_type="application/pdf")
        self.item.save()
        self.client.force_authenticate(user=other_user)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 403)

    def test_upload_attachment_endpoint(self):
        self.client.force_authenticate(user=self.user)
        attachment = SimpleUploadedFile("upload_test.pdf", b"file upload content", content_type="application/pdf")
        response = self.client.post(self.upload_url, {'attachment': attachment}, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['filename'], 'upload_test.pdf')
        self.item.refresh_from_db()
        self.assertIsNotNone(self.item.attachment)

    def test_upload_attachment_missing_file_returns_400(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.upload_url, {}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('No file provided', response.data['error'])

    def test_upload_attachment_item_not_found_returns_404(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('requisition-item-upload', kwargs={'item_id': '00000000-0000-0000-0000-000000000000'})
        response = self.client.post(url, {}, format='multipart')
        self.assertEqual(response.status_code, 404)

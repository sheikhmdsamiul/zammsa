from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from accounts.models import User
from solicitations.models import Solicitation
from django.utils import timezone
import datetime

class SolicitationPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager_user = User.objects.create_user(
            email='manager@example.com',
            password='password123',
            full_name='Proc Manager',
            employee_id='PM001',
            role='procurement_manager'
        )
        self.officer_user = User.objects.create_user(
            email='officer@example.com',
            password='password123',
            full_name='Proc Officer',
            employee_id='PO001',
            role='procurement_officer'
        )
        self.solicitation = Solicitation.objects.create(
            title='Test Solicitation',
            sol_number='SOL-001',
            status='approved',
            method='open_tender',
            closing_date=timezone.now() + datetime.timedelta(days=30)
        )

    def test_manager_can_publish(self):
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('solicitation-publish', kwargs={'pk': self.solicitation.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.solicitation.refresh_from_db()
        self.assertEqual(self.solicitation.status, 'published')

    def test_officer_can_publish(self):
        self.client.force_authenticate(user=self.officer_user)
        url = reverse('solicitation-publish', kwargs={'pk': self.solicitation.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        
    def test_manager_can_create(self):
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('solicitation-list')
        data = {
            'title': 'New Solicitation',
            'sol_number': 'SOL-NEW',
            'method': 'open_tender',
            'description': 'Test description',
            'closing_date': (timezone.now() + datetime.timedelta(days=30)).isoformat()
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 201, f"Create failed: {response.data}")

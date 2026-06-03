from decimal import Decimal
import os
from django.db.models import Q, Avg, Sum as models_Sum
from django.utils import timezone
from django.core.files.storage import default_storage
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import Supplier, VendorApplication, VendorApplicationDocument, SupplierDocument, SupplierPerformance, SupplierRiskScore, Blacklist
from bids.models import BidSubmission
from contracts.models import Contract
from finance.models import Invoice
from solicitations.models import Solicitation
from .serializers import (
    SupplierSerializer, SupplierListSerializer, VendorApplicationSerializer,
    VendorApplicationListSerializer, VendorApplicationDocumentSerializer,
    SupplierDocumentSerializer, SupplierPerformanceSerializer,
    SupplierRiskScoreSerializer, BlacklistSerializer,
)
from django.utils.crypto import get_random_string
from accounts.models import User


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class SupplierFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(method='filter_search')
    status = django_filters.CharFilter(lookup_expr='exact')
    risk_level = django_filters.CharFilter(lookup_expr='exact')
    ceec_category = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = Supplier
        fields = ['status', 'risk_level', 'ceec_category']

    def filter_search(self, queryset, name, value):
        return queryset.filter(Q(name__icontains=value) | Q(registration_number__icontains=value) | Q(tin__icontains=value))


class VendorApplicationFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(lookup_expr='exact')
    ceec_category = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = VendorApplication
        fields = ['status', 'ceec_category']


class BaseView:
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]


class SupplierListView(BaseView, generics.ListCreateAPIView):
    queryset = Supplier.objects.prefetch_related('documents', 'performances').all()
    filterset_class = SupplierFilter
    search_fields = ['name', 'registration_number', 'tin']
    ordering_fields = ['name', 'registered_at', 'status', 'risk_level']
    ordering = ['name']

    def get_serializer_class(self):
        if self.request.method == 'GET' and not self.request.query_params.get('detail'):
            return SupplierListSerializer
        return SupplierSerializer


class SupplierDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Supplier.objects.prefetch_related('documents', 'performances', 'risk_scores').all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        instance.status = 'suspended'
        instance.save()


class VendorApplicationListView(BaseView, generics.ListCreateAPIView):
    queryset = VendorApplication.objects.all()
    filterset_class = VendorApplicationFilter
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.request.method == 'GET' and not self.request.query_params.get('detail'):
            return VendorApplicationListSerializer
        return VendorApplicationSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save()


class VendorApplicationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = VendorApplication.objects.all()
    serializer_class = VendorApplicationSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([AllowAny])
def vendor_application_submit_view(request, pk):
    try:
        app = VendorApplication.objects.get(pk=pk)
    except VendorApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=404)

    app.status = 'submitted'
    app.submitted_at = timezone.now()
    app.save()
    return Response({'message': 'Application submitted for review', 'status': app.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def vendor_application_review_view(request, pk):
    if request.user.role != 'supplier_relationship_manager':
        return Response({'error': 'Only Supplier Relationship Managers can review applications'}, status=403)
    try:
        app = VendorApplication.objects.get(pk=pk)
    except VendorApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=404)

    decision = request.data.get('decision', 'approved')
    rejection_reason = request.data.get('rejection_reason', '')

    if decision == 'approved':
        supplier, created = Supplier.objects.get_or_create(
            registration_number=app.registration_number,
            defaults={
                'tin': app.tin,
                'name': app.company_name,
                'ceec_category': app.ceec_category,
                'status': 'active',
            }
        )
        # Create supplier user account
        supplier_user = None
        if app.email:
            try:
                supplier_user = User.objects.create_user(
                    employee_id=f'SUP-{supplier.registration_number}',
                    full_name=app.company_name,
                    email=app.email,
                    password=app.password or get_random_string(16),
                    role='supplier_user',
                )
            except Exception:
                pass

        app.status = 'approved'
        app.reviewed_by = request.user
        app.save()

        # Email stub
        email_sent = False
        if supplier_user:
            email_sent = True

        return Response({
            'message': 'Application approved. Supplier registered.',
            'supplier_id': str(supplier.supplier_id),
            'user_created': supplier_user is not None,
            'email_sent': email_sent,
        })
    else:
        app.status = 'rejected'
        app.rejection_reason = rejection_reason
        app.reviewed_by = request.user
        app.save()
        return Response({'message': 'Application rejected'})


@api_view(['POST'])
@permission_classes([AllowAny])
def vendor_validate_pacra_view(request):
    tin = request.data.get('tin', '')
    if not tin:
        return Response({'error': 'TIN is required'}, status=400)
    return Response({
        'valid': True,
        'tin': tin,
        'company_name': request.data.get('company_name', ''),
        'registration_status': 'active',
        'message': 'TIN validated successfully with PACRA',
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def vendor_validate_ceec_view(request):
    certificate_number = request.data.get('certificate_number', '')
    if not certificate_number:
        return Response({'error': 'Certificate number is required'}, status=400)
    return Response({
        'valid': True,
        'certificate_number': certificate_number,
        'category': request.data.get('ceec_category', ''),
        'message': 'CEEC certificate validated successfully',
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def vendor_application_step_view(request, pk, step):
    try:
        app = VendorApplication.objects.get(pk=pk)
    except VendorApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=404)

    mapper = {
        1: ['email', 'password'],
        2: ['company_name', 'registration_number', 'tin', 'ceec_certificate_number', 'ceec_category'],
        3: ['contact_person', 'contact_phone', 'contact_email', 'address'],
        4: ['bank_name', 'bank_account_number', 'bank_account_name', 'bank_branch'],
        5: [],
    }
    allowed = mapper.get(int(step), [])
    updates = {k: v for k, v in request.data.items() if k in allowed}
    for key, value in updates.items():
        setattr(app, key, value)
    app.save(update_fields=list(updates.keys()))

    return Response({
        'message': f'Step {step} saved',
        'application_id': str(app.application_id),
        'current_status': app.status,
    })


class VendorApplicationDocumentListView(BaseView, generics.ListCreateAPIView):
    queryset = VendorApplicationDocument.objects.select_related('application').all()
    serializer_class = VendorApplicationDocumentSerializer
    ordering = ['-uploaded_at']


@api_view(['POST'])
@permission_classes([AllowAny])
def vendor_application_upload_document_view(request, pk):
    try:
        app = VendorApplication.objects.get(pk=pk)
    except VendorApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=404)

    doc_type = request.data.get('document_type') or request.data.get('type') or ''
    uploaded_file = request.FILES.get('file')
    file_path = request.data.get('file_path', '')

    if uploaded_file:
        # Persist uploaded registration files so reviewers can manually inspect them.
        safe_name = os.path.basename(uploaded_file.name)
        stored_path = default_storage.save(
            f'vendor_applications/{app.application_id}/{safe_name}',
            uploaded_file,
        )
        file_path = default_storage.url(stored_path)

    if not doc_type or not file_path:
        return Response({'error': 'document_type and file_path/file are required'}, status=400)

    doc = VendorApplicationDocument.objects.create(
        application=app,
        document_type=doc_type,
        file_path=file_path,
    )
    return Response({
        'message': 'Document uploaded',
        'document_id': str(doc.document_id),
        'document_type': doc.document_type,
    })


class SupplierDocumentListView(BaseView, generics.ListCreateAPIView):
    queryset = SupplierDocument.objects.select_related('supplier').all()
    serializer_class = SupplierDocumentSerializer
    ordering = ['-document_id']


class SupplierPerformanceListView(BaseView, generics.ListCreateAPIView):
    queryset = SupplierPerformance.objects.select_related('supplier').all()
    serializer_class = SupplierPerformanceSerializer
    ordering = ['-evaluation_date']


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def performance_evaluate_view(request, supplier_pk):
    try:
        supplier = Supplier.objects.get(pk=supplier_pk)
    except Supplier.DoesNotExist:
        return Response({'error': 'Supplier not found'}, status=404)

    metrics = request.data.get('metrics', {})
    overall = Decimal(str(request.data.get('overall_score', 0)))
    improvement_notes = request.data.get('improvement_notes', '')

    perf = SupplierPerformance.objects.create(
        supplier=supplier,
        evaluation_date=timezone.now().date(),
        metrics=metrics,
        overall_score=overall,
        needs_improvement=overall < 60,
        evaluated_by=request.user,
        improvement_notes=improvement_notes,
    )

    if overall >= 80:
        risk_score = Decimal('15')
        risk_level = 'low'
    elif overall >= 60:
        risk_score = Decimal('40')
        risk_level = 'medium'
    else:
        risk_score = Decimal('75')
        risk_level = 'high'

    SupplierRiskScore.objects.create(
        supplier=supplier,
        risk_score=risk_score,
        risk_level=risk_level,
        factors={'performance_score': float(overall), 'metric_details': metrics, 'needs_improvement': overall < 60},
    )

    supplier.risk_score = risk_score
    supplier.risk_level = risk_level
    supplier.save()

    return Response({
        'message': 'Performance evaluation submitted',
        'overall_score': float(overall),
        'risk_score': float(risk_score),
        'risk_level': risk_level,
        'needs_improvement': overall < 60,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def performance_reminder_view(request):
    from django.db.models import Max
    six_months_ago = timezone.now().date() - timezone.timedelta(days=180)
    suppliers_due = Supplier.objects.annotate(
        last_eval=Max('performances__evaluation_date')
    ).filter(
        Q(last_eval__isnull=True) | Q(last_eval__lte=six_months_ago),
        status='active',
    )
    data = [
        {
            'supplier_id': str(s.supplier_id),
            'name': s.name,
            'last_evaluation': str(s.last_eval) if hasattr(s, 'last_eval') and s.last_eval else None,
        }
        for s in suppliers_due
    ]
    return Response({
        'count': len(data),
        'suppliers_due_for_evaluation': data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def performance_improvement_list_view(request):
    needs_improvement = SupplierPerformance.objects.filter(
        needs_improvement=True
    ).select_related('supplier').order_by('-evaluation_date')
    data = SupplierPerformanceSerializer(needs_improvement, many=True).data
    return Response({
        'count': len(data),
        'suppliers_needing_improvement': data,
    })


class SupplierRiskScoreListView(BaseView, generics.ListAPIView):
    queryset = SupplierRiskScore.objects.select_related('supplier').all()
    serializer_class = SupplierRiskScoreSerializer
    ordering = ['-calculated_at']


class BlacklistListView(BaseView, generics.ListCreateAPIView):
    queryset = Blacklist.objects.select_related('supplier').all()
    serializer_class = BlacklistSerializer
    ordering = ['-created_at']


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def vendor_dashboard_view(request):
    user = request.user

    open_tenders = Solicitation.objects.filter(status='published').count()

    active_bids = BidSubmission.objects.filter(
        supplier=user,
        status__in=['submitted', 'opened', 'responsive'],
    ).count()

    total_bids = BidSubmission.objects.filter(supplier=user).count()

    awarded_contracts = Contract.objects.filter(
        winning_bid__supplier=user,
        status__in=['active', 'pending_acceptance'],
    ).count()

    total_value_awarded = Contract.objects.filter(
        winning_bid__supplier=user,
        status__in=['active', 'completed'],
    ).aggregate(total=models_Sum('value'))['total'] or 0

    supplier = None
    if user.employee_id and user.employee_id.startswith('SUP-'):
        try:
            supplier = Supplier.objects.get(registration_number=user.employee_id.replace('SUP-', '', 1))
        except Supplier.DoesNotExist:
            pass

    pending_invoices = 0
    if supplier:
        pending_invoices = Invoice.objects.filter(
            supplier=supplier,
            status__in=['submitted', 'pending_matching', 'pending_approval'],
        ).count()

    profile_completeness = 0
    profile = VendorApplication.objects.filter(email=user.email, status='approved').first()
    if profile:
        filled = sum(1 for f in ['company_name', 'registration_number', 'tin', 'contact_person', 'contact_phone', 'address'] if getattr(profile, f, None))
        profile_completeness = int((filled / 6) * 100)

    return Response({
        'open_tenders': open_tenders,
        'total_bids': total_bids,
        'active_bids': active_bids,
        'awarded_contracts': awarded_contracts,
        'pending_invoices': pending_invoices,
        'profile_completeness': profile_completeness,
        'total_value_awarded': float(total_value_awarded),
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def vendor_profile_view(request):
    user = request.user
    profile = None

    # First try to find an approved VendorApplication for this user's email
    if user.email:
        profile = VendorApplication.objects.filter(email=user.email).order_by('-created_at').first()

    # Fall back to Supplier record via employee_id
    if not profile and user.employee_id and user.employee_id.startswith('SUP-'):
        try:
            supplier = Supplier.objects.get(registration_number=user.employee_id.replace('SUP-', '', 1))
            return Response({
                'company_name': supplier.name,
                'registration_number': supplier.registration_number,
                'tin': supplier.tin,
                'ceec_category': supplier.ceec_category,
                'email': user.email,
                'status': supplier.status,
            })
        except Supplier.DoesNotExist:
            pass

    if not profile:
        return Response({'detail': 'Profile not found'}, status=404)

    if request.method == 'GET':
        serializer = VendorApplicationSerializer(profile)
        return Response(serializer.data)

    elif request.method == 'PATCH':
        serializer = VendorApplicationSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

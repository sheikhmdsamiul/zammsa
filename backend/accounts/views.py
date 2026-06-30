import pyotp
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth.hashers import make_password
from rest_framework import status, generics, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import User, AuditLog, ConflictOfInterest, MFACode, PasswordHistory
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer, UserListSerializer,
    LoginSerializer, MfaLoginSerializer, ChangePasswordSerializer,
    ForgotPasswordSerializer, ResetPasswordSerializer,
    AuditLogSerializer, ConflictOfInterestSerializer,
)
from .permissions import IsSystemAdmin, IsAdminOrReadOnly
from .utils.helpers import generate_mfa_secret, get_mfa_provisioning_uri, generate_qr_code_base64, verify_mfa_code
from system_config.notifications import create_notification, send_external_email


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class UserFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(method='filter_search')
    role = django_filters.CharFilter(lookup_expr='exact')
    is_active = django_filters.BooleanFilter()
    department = django_filters.CharFilter(lookup_expr='icontains')
    date_joined_after = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    date_joined_before = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    class Meta:
        model = User
        fields = ['role', 'is_active', 'department']

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(full_name__icontains=value) |
            Q(email__icontains=value) |
            Q(employee_id__icontains=value) |
            Q(phone__icontains=value)
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']

    if user.mfa_enabled:
        import random
        code = str(random.randint(100000, 999999))
        MFACode.objects.create(
            user=user,
            code=code,
            expires_at=timezone.now() + timezone.timedelta(minutes=5),
        )
        send_external_email(
            'Your ZAMMSA MFA code',
            f'Your ZAMMSA MFA code is {code}. It expires in 5 minutes.',
            user.email,
        )
        create_notification(
            user,
            title='MFA code sent',
            message='A multi-factor authentication code was sent to your email.',
            notification_type='system',
            priority='normal',
            source_module='accounts',
            object_id=user.pk,
            metadata={'alert_key': 'mfa_code_sent'},
        )
        return Response({
            'requires_mfa': True,
            'email': user.email,
            'message': 'MFA code sent to your email',
        })

    refresh = RefreshToken.for_user(user)
    user.reset_failed_attempts()
    user.last_login = timezone.now()
    user.save(update_fields=['last_login', 'last_login_ip'])

    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
        'must_change_password': user.must_change_password,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def mfa_login_view(request):
    serializer = MfaLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']

    refresh = RefreshToken.for_user(user)
    user.reset_failed_attempts()
    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])

    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({'message': 'Logged out successfully'})
    except Exception:
        return Response({'message': 'Logged out'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)

    user = request.user
    user.set_password(serializer.validated_data['new_password'])
    user.password_changed_at = timezone.now()
    user.must_change_password = False
    user.save()

    PasswordHistory.objects.create(user=user, password_hash=user.password)
    create_notification(
        user,
        title='Password changed',
        message='Your ZAMMSA account password was changed successfully.',
        notification_type='system',
        priority='normal',
        source_module='accounts',
        object_id=user.pk,
        metadata={'alert_key': 'password_changed'},
        email_required=True,
    )

    return Response({'message': 'Password changed successfully'})


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password_view(request):
    serializer = ForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = User.objects.get(email=serializer.validated_data['email'])
    import random
    reset_code = str(random.randint(100000, 999999))
    MFACode.objects.create(
        user=user,
        code=reset_code,
        expires_at=timezone.now() + timezone.timedelta(minutes=15),
    )
    send_external_email(
        'Your ZAMMSA password reset code',
        f'Your ZAMMSA password reset code is {reset_code}. It expires in 15 minutes.',
        user.email,
    )
    create_notification(
        user,
        title='Password reset code sent',
        message='A password reset code was sent to your email.',
        notification_type='system',
        priority='normal',
        source_module='accounts',
        object_id=user.pk,
        metadata={'alert_key': 'password_reset_code_sent'},
    )

    return Response({'message': 'Password reset code sent to your email'})


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password_view(request):
    serializer = ResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    mfa_code = MFACode.objects.filter(
        code=serializer.validated_data['token'],
        is_used=False,
    ).select_related('user').first()

    if not mfa_code or not mfa_code.is_valid():
        return Response({'error': 'Invalid or expired reset token'}, status=status.HTTP_400_BAD_REQUEST)

    user = mfa_code.user
    user.set_password(serializer.validated_data['new_password'])
    user.password_changed_at = timezone.now()
    user.must_change_password = False
    user.save()

    mfa_code.is_used = True
    mfa_code.save(update_fields=['is_used'])
    PasswordHistory.objects.create(user=user, password_hash=user.password)
    create_notification(
        user,
        title='Password reset completed',
        message='Your ZAMMSA account password was reset successfully.',
        notification_type='system',
        priority='high',
        source_module='accounts',
        object_id=user.pk,
        metadata={'alert_key': 'password_reset_completed'},
        email_required=True,
    )

    return Response({'message': 'Password reset successfully'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def mfa_setup_view(request):
    user = request.user

    if request.method == 'GET':
        secret = generate_mfa_secret()
        user.mfa_secret = secret
        user.save(update_fields=['mfa_secret'])
        uri = get_mfa_provisioning_uri(user, secret)
        qr_code = generate_qr_code_base64(uri)
        return Response({
            'secret': secret,
            'qr_code': qr_code,
            'uri': uri,
        })

    code = request.data.get('code')
    if not code:
        return Response({'error': 'Verification code is required'}, status=status.HTTP_400_BAD_REQUEST)

    if not verify_mfa_code(user.mfa_secret, code):
        return Response({'error': 'Invalid verification code'}, status=status.HTTP_400_BAD_REQUEST)

    user.mfa_enabled = True
    user.save(update_fields=['mfa_enabled'])
    return Response({'message': 'MFA enabled successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfa_verify_view(request):
    code = request.data.get('code')
    if not code:
        return Response({'error': 'Code is required'}, status=status.HTTP_400_BAD_REQUEST)

    if not verify_mfa_code(request.user.mfa_secret, code):
        return Response({'error': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'message': 'MFA verified successfully'})


class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserListSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = UserFilter
    search_fields = ['full_name', 'email', 'employee_id', 'phone']
    ordering_fields = ['full_name', 'email', 'created_at', 'last_login', 'role']
    ordering = ['-created_at']
    permission_classes = [IsAdminOrReadOnly]


class UserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsSystemAdmin]


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserUpdateSerializer
    permission_classes = [IsSystemAdmin]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class AuditLogFilter(django_filters.FilterSet):
    user = django_filters.CharFilter(field_name='user__email', lookup_expr='icontains')
    action = django_filters.CharFilter(lookup_expr='exact')
    module = django_filters.CharFilter(lookup_expr='exact')
    date_from = django_filters.DateTimeFilter(field_name='timestamp', lookup_expr='gte')
    date_to = django_filters.DateTimeFilter(field_name='timestamp', lookup_expr='lte')

    class Meta:
        model = AuditLog
        fields = ['user', 'action', 'module']


class AuditLogListView(generics.ListAPIView):
    queryset = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = AuditLogFilter
    ordering_fields = ['timestamp', 'action', 'module']
    ordering = ['-timestamp']
    permission_classes = [IsAdminOrReadOnly]


class ConflictOfInterestListCreateView(generics.ListCreateAPIView):
    queryset = ConflictOfInterest.objects.select_related('user').all()
    serializer_class = ConflictOfInterestSerializer
    pagination_class = StandardPagination
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ('system_admin', 'director_procurement', 'director_general'):
            return ConflictOfInterest.objects.select_related('user').all()
        return ConflictOfInterest.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ConflictOfInterestDetailView(generics.RetrieveUpdateAPIView):
    queryset = ConflictOfInterest.objects.all()
    serializer_class = ConflictOfInterestSerializer
    permission_classes = [IsSystemAdmin]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def export_users_view(request):
    import openpyxl
    from django.http import HttpResponse

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Users Export'
    ws.append(['Employee ID', 'Full Name', 'Email', 'Phone', 'Department', 'Role', 'Is Active', 'Last Login'])

    users = User.objects.all().values_list(
        'employee_id', 'full_name', 'email', 'phone', 'department', 'role', 'is_active', 'last_login'
    )
    for user in users:
        ws.append(list(user))

    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = 'attachment; filename=users_export.xlsx'
    wb.save(response)
    return response

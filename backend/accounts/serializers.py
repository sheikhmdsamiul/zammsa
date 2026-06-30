import uuid
from django.contrib.auth.hashers import check_password
from django.utils import timezone
from rest_framework import serializers
from .models import User, Role, Permission, UserRole, RolePermission, AuditLog, PasswordHistory, MFACode, ConflictOfInterest

ROLE_ALIASES = {
    'zppa_reporter': 'zppa_reporting_officer',
}


def normalize_role(role: str) -> str:
    return ROLE_ALIASES.get(role, role)


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    def get_role(self, obj):
        return normalize_role(obj.role)

    class Meta:
        model = User
        fields = ('id', 'employee_id', 'full_name', 'email', 'phone', 'department',
                  'role', 'is_active', 'is_staff', 'is_superuser', 'mfa_enabled',
                  'password_changed_at', 'created_at', 'updated_at', 'last_login',
                  'last_login_ip', 'must_change_password')
        read_only_fields = ('id', 'password_changed_at', 'created_at', 'updated_at',
                            'last_login', 'last_login_ip', 'is_superuser', 'is_staff')


class UserCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('employee_id', 'full_name', 'email', 'phone', 'department', 'role', 'is_active')

    def create(self, validated_data):
        temp_password = str(uuid.uuid4())[:12]
        user = User.objects.create_user(
            email=validated_data['email'],
            password=temp_password,
            employee_id=validated_data.get('employee_id'),
            full_name=validated_data.get('full_name', ''),
            phone=validated_data.get('phone', ''),
            department=validated_data.get('department', ''),
            role=validated_data.get('role', 'user_dept_staff'),
            is_active=validated_data.get('is_active', True),
            must_change_password=True,
            temp_password=temp_password,
        )
        PasswordHistory.objects.create(user=user, password_hash=user.password)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('employee_id', 'full_name', 'email', 'phone', 'department', 'role', 'is_active')


class UserListSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    def get_role(self, obj):
        return normalize_role(obj.role)

    class Meta:
        model = User
        fields = ('id', 'employee_id', 'full_name', 'email', 'phone', 'department',
                  'role', 'is_active', 'last_login', 'created_at')


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    mfa_code = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid credentials')

        if user.is_locked():
            raise serializers.ValidationError('Account is locked due to too many failed attempts. Try again later.')

        if not user.is_active:
            raise serializers.ValidationError('Account is inactive.')

        if not user.has_usable_password():
            raise serializers.ValidationError('Account has no password set. Contact administrator.')

        if not user.check_password(password):
            user.increment_failed_attempts()
            if user.is_locked():
                from system_config.notifications import create_notification, notify_role
                create_notification(
                    user,
                    title='Account locked',
                    message=f'Your account has been locked until {user.locked_until} after repeated failed login attempts.',
                    notification_type='system',
                    priority='urgent',
                    source_module='accounts',
                    object_id=user.pk,
                    metadata={'alert_key': 'account_lockout', 'locked_until': user.locked_until.isoformat() if user.locked_until else ''},
                    email_required=True,
                )
                notify_role(
                    'system_admin',
                    title=f'User account locked: {user.email}',
                    message=f'{user.full_name} ({user.email}) was locked after repeated failed login attempts.',
                    notification_type='system',
                    priority='high',
                    source_module='accounts',
                    object_id=user.pk,
                    metadata={'alert_key': 'account_lockout_admin', 'user_email': user.email},
                    email_required=True,
                )
            raise serializers.ValidationError('Invalid credentials')

        data['user'] = user
        return data


class MfaLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)

    def validate(self, data):
        try:
            user = User.objects.get(email=data['email'])
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid credentials')

        if not user.mfa_enabled:
            raise serializers.ValidationError('MFA is not enabled for this account')

        mfa_code = MFACode.objects.filter(user=user, code=data['code'], is_used=False).first()
        if not mfa_code or not mfa_code.is_valid():
            raise serializers.ValidationError('Invalid or expired MFA code')

        mfa_code.is_used = True
        mfa_code.save(update_fields=['is_used'])
        data['user'] = user
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect')
        return value

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError('Passwords do not match')
        if data['old_password'] == data['new_password']:
            raise serializers.ValidationError('New password cannot be the same as old password')
        for history in PasswordHistory.objects.filter(user=self.context['request'].user)[:5]:
            if check_password(data['new_password'], history.password_hash):
                raise serializers.ValidationError('Cannot reuse a recent password')
        return data


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value, is_active=True).exists():
            raise serializers.ValidationError('No active account found with this email')
        return value


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError('Passwords do not match')
        return data


class MfaSetupSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6)

    def validate_code(self, value):
        user = self.context['request'].user
        mfa_code = MFACode.objects.filter(user=user, code=value, is_used=False).first()
        if not mfa_code or not mfa_code.is_valid():
            raise serializers.ValidationError('Invalid or expired verification code')
        mfa_code.is_used = True
        mfa_code.save(update_fields=['is_used'])
        return value


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = AuditLog
        fields = ('id', 'user', 'user_email', 'user_name', 'action', 'module',
                  'record_id', 'old_value', 'new_value', 'ip_address', 'timestamp')
        read_only_fields = fields


class ConflictOfInterestSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = ConflictOfInterest
        fields = ('id', 'user', 'user_name', 'procurement_id', 'declaration_type',
                  'declared_conflict', 'resolution', 'declared_at', 'resolved_at', 'resolved_by')
        read_only_fields = ('id', 'declared_at', 'resolved_at', 'resolved_by')


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = '__all__'

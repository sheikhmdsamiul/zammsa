from rest_framework import serializers
from .models import SystemSetting, NotificationTemplate, Notification, ThresholdRule, PreferenceRule, WorkflowStage, ScheduledTask, IntegrationEndpoint


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = '__all__'


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = '__all__'


class NotificationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='notification_id', read_only=True)
    read = serializers.BooleanField(source='is_read', read_only=True)
    recipient_name = serializers.CharField(source='recipient.full_name', read_only=True)

    class Meta:
        model = Notification
        fields = (
            'id', 'notification_id', 'recipient', 'recipient_name', 'title', 'message',
            'notification_type', 'priority', 'source_module', 'object_id', 'action_url',
            'metadata', 'delivery_channels', 'email_required', 'email_status',
            'email_attempts', 'email_sent_at', 'email_last_error', 'sms_required',
            'sms_status', 'sms_attempts', 'sms_sent_at', 'sms_last_error',
            'read', 'read_at', 'created_at',
        )
        read_only_fields = (
            'notification_id', 'recipient', 'email_status', 'email_attempts',
            'email_sent_at', 'email_last_error', 'sms_status', 'sms_attempts',
            'sms_sent_at', 'sms_last_error', 'read_at', 'created_at',
        )


class ThresholdRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ThresholdRule
        fields = '__all__'


class PreferenceRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreferenceRule
        fields = '__all__'


class WorkflowStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowStage
        fields = '__all__'


class ScheduledTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduledTask
        fields = '__all__'
        read_only_fields = ('last_run', 'next_run', 'last_status')


class IntegrationEndpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationEndpoint
        fields = '__all__'

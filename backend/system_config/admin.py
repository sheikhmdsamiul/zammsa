from django.contrib import admin
from .models import SystemSetting, NotificationTemplate, Notification, ThresholdRule, PreferenceRule, WorkflowStage, ScheduledTask, IntegrationEndpoint


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'recipient', 'notification_type', 'priority', 'email_status', 'sms_status', 'read_at', 'created_at')
    list_filter = ('notification_type', 'priority', 'email_status', 'sms_status', 'created_at')
    search_fields = ('title', 'message', 'recipient__email', 'recipient__full_name', 'source_module', 'object_id')
    readonly_fields = ('notification_id', 'email_attempts', 'email_sent_at', 'email_last_error', 'sms_attempts', 'sms_sent_at', 'sms_last_error', 'created_at')

admin.site.register(SystemSetting)
admin.site.register(NotificationTemplate)
admin.site.register(ThresholdRule)
admin.site.register(PreferenceRule)
admin.site.register(WorkflowStage)
admin.site.register(ScheduledTask)
admin.site.register(IntegrationEndpoint)

from django.urls import path
from . import views

urlpatterns = [
    path('settings/', views.SystemSettingListView.as_view(), name='setting-list'),
    path('settings/<uuid:pk>/', views.SystemSettingDetailView.as_view(), name='setting-detail'),
    path('notification-templates/', views.NotificationTemplateListView.as_view(), name='notification-template-list'),
    path('notification-templates/<uuid:pk>/', views.NotificationTemplateDetailView.as_view(), name='notification-template-detail'),
    path('notifications/', views.NotificationListView.as_view(), name='notification-list'),
    path('notifications/summary/', views.notification_summary, name='notification-summary'),
    path('notifications/mark-all-read/', views.notification_mark_all_read, name='notification-mark-all-read'),
    path('notifications/clear-all/', views.notification_clear_all, name='notification-clear-all'),
    path('notifications/<uuid:pk>/mark-read/', views.notification_mark_read, name='notification-mark-read'),
    path('notifications/<uuid:pk>/delete/', views.notification_delete, name='notification-delete'),
    path('threshold-rules/', views.ThresholdRuleListView.as_view(), name='threshold-rule-list'),
    path('threshold-rules/<uuid:pk>/', views.ThresholdRuleDetailView.as_view(), name='threshold-rule-detail'),
    path('preference-rules/', views.PreferenceRuleListView.as_view(), name='preference-rule-list'),
    path('preference-rules/<uuid:pk>/', views.PreferenceRuleDetailView.as_view(), name='preference-rule-detail'),
    path('workflow-stages/', views.WorkflowStageListView.as_view(), name='workflow-stage-list'),
    path('workflow-stages/<uuid:pk>/', views.WorkflowStageDetailView.as_view(), name='workflow-stage-detail'),
    path('scheduled-tasks/', views.ScheduledTaskListView.as_view(), name='scheduled-task-list'),
    path('scheduled-tasks/<uuid:pk>/', views.ScheduledTaskDetailView.as_view(), name='scheduled-task-detail'),
    path('integration-endpoints/', views.IntegrationEndpointListView.as_view(), name='integration-endpoint-list'),
    path('integration-endpoints/<uuid:pk>/', views.IntegrationEndpointDetailView.as_view(), name='integration-endpoint-detail'),
]

from django.urls import path
from . import views

urlpatterns = [
    path('', views.SupplierListView.as_view(), name='supplier-list'),
    path('dashboard/', views.vendor_dashboard_view, name='vendor-dashboard'),
    path('profile/', views.vendor_profile_view, name='vendor-profile'),
    path('<uuid:pk>/', views.SupplierDetailView.as_view(), name='supplier-detail'),
    path('applications/', views.VendorApplicationListView.as_view(), name='application-list'),
    path('applications/<uuid:pk>/', views.VendorApplicationDetailView.as_view(), name='application-detail'),
    path('applications/<uuid:pk>/submit/', views.vendor_application_submit_view, name='application-submit'),
    path('applications/<uuid:pk>/review/', views.vendor_application_review_view, name='application-review'),
    path('applications/<uuid:pk>/step/<int:step>/', views.vendor_application_step_view, name='application-step'),
    path('applications/<uuid:pk>/upload-document/', views.vendor_application_upload_document_view, name='application-upload-document'),
    path('application-documents/', views.VendorApplicationDocumentListView.as_view(), name='application-document-list'),
    path('validate-pacra/', views.vendor_validate_pacra_view, name='validate-pacra'),
    path('validate-ceec/', views.vendor_validate_ceec_view, name='validate-ceec'),
    path('documents/', views.SupplierDocumentListView.as_view(), name='supplier-document-list'),
    path('performances/', views.SupplierPerformanceListView.as_view(), name='performance-list'),
    path('performances/evaluate/<uuid:supplier_pk>/', views.performance_evaluate_view, name='performance-evaluate'),
    path('performances/reminder/', views.performance_reminder_view, name='performance-reminder'),
    path('performances/improvement/', views.performance_improvement_list_view, name='performance-improvement'),
    path('risk-scores/', views.SupplierRiskScoreListView.as_view(), name='risk-score-list'),
    path('blacklist/', views.BlacklistListView.as_view(), name='blacklist-list'),
]

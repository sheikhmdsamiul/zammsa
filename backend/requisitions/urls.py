from django.urls import path
from . import views

urlpatterns = [
    path('', views.RequisitionListView.as_view(), name='requisition-list'),
    path('dashboard/', views.requisition_dashboard_view, name='requisition-dashboard'),
    path('<uuid:pk>/', views.RequisitionDetailView.as_view(), name='requisition-detail'),
    path('<uuid:pk>/submit/', views.requisition_submit_view, name='requisition-submit'),
    path('<uuid:pk>/approve/', views.requisition_approve_view, name='requisition-approve'),
    path('<uuid:pk>/budget-validate/', views.requisition_budget_validate_view, name='requisition-budget-validate'),
    path('<uuid:pk>/amend/', views.requisition_amend_view, name='requisition-amend'),
    path('<uuid:pk>/diff/', views.requisition_diff_view, name='requisition-diff'),
    path('<uuid:pk>/tracking/', views.requisition_tracking_view, name='requisition-tracking'),
    path('items/', views.RequisitionItemListView.as_view(), name='requisition-item-list'),
    path('items/<uuid:item_id>/upload/', views.requisition_item_upload_attachment_view, name='requisition-item-upload'),
    path('specifications/', views.SpecificationListView.as_view(), name='specification-list'),
    path('specifications/<uuid:pk>/', views.SpecificationDetailView.as_view(), name='specification-detail'),
    path('approvals/', views.RequisitionApprovalListView.as_view(), name='approval-list'),
    path('encumbrances/', views.BudgetEncumbranceListView.as_view(), name='encumbrance-list'),
]

from django.urls import path
from . import views

urlpatterns = [
    path('templates/', views.SolicitationTemplateListView.as_view(), name='sol-template-list'),
    path('templates/preview/', views.template_preview_view, name='sol-template-preview'),

    path('templates/<uuid:pk>/', views.SolicitationTemplateDetailView.as_view(), name='sol-template-detail'),
    path('', views.SolicitationListView.as_view(), name='solicitation-list'),
    path('<uuid:pk>/', views.SolicitationDetailView.as_view(), name='solicitation-detail'),
    path('<uuid:pk>/submit/', views.solicitation_submit_view, name='solicitation-submit'),
    path('<uuid:pk>/approve/', views.solicitation_approve_view, name='solicitation-approve'),
    path('<uuid:pk>/reject/', views.solicitation_reject_view, name='solicitation-reject'),
    path('<uuid:pk>/publish/', views.solicitation_publish_view, name='solicitation-publish'),
    path('<uuid:pk>/close/', views.solicitation_close_view, name='solicitation-close'),
    path('<uuid:pk>/addendum/', views.solicitation_add_addendum_view, name='solicitation-addendum'),
    path('criteria/', views.EvaluationCriterionListView.as_view(), name='criterion-list'),
    path('criteria/<uuid:pk>/', views.EvaluationCriterionDetailView.as_view(), name='criterion-detail'),
    path('clarifications/', views.ClarificationRequestListView.as_view(), name='clarification-list'),
    path('clarifications/<uuid:pk>/', views.ClarificationRequestDetailView.as_view(), name='clarification-detail'),
    path('clarifications/<uuid:pk>/answer/', views.clarification_answer_view, name='clarification-answer'),
    path('documents/', views.SolicitationDocumentListView.as_view(), name='sol-document-list'),
    path('<uuid:solicitation_id>/documents/', views.solicitation_document_upload_view, name='sol-document-upload'),
    path('<uuid:solicitation_id>/documents/<uuid:document_id>/', views.solicitation_document_delete_view, name='sol-document-delete'),
    path('<uuid:solicitation_id>/copy-cpp-documents/', views.solicitation_copy_cpp_documents_view, name='sol-copy-cpp-docs'),
]

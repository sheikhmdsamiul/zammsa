from django.urls import path
from . import views

urlpatterns = [
    path('', views.BidSubmissionListView.as_view(), name='bid-list'),
    path('<uuid:pk>/', views.BidSubmissionDetailView.as_view(), name='bid-detail'),
    path('submit/', views.bid_submit_view, name='bid-submit'),
    path('<uuid:pk>/unseal-financial/', views.bid_unseal_financial_view, name='bid-unseal-financial'),
    path('addenda/<uuid:pk>/', views.solicitation_addenda_view, name='solicitation-addenda'),
    path('documents/', views.BidDocumentListView.as_view(), name='bid-document-list'),
    path('securities/', views.BidSecurityListView.as_view(), name='bid-security-list'),
    path('securities/<uuid:pk>/', views.BidSecurityDetailView.as_view(), name='bid-security-detail'),
    path('conferences/', views.PreBidConferenceListView.as_view(), name='conference-list'),
    path('conferences/<uuid:pk>/', views.PreBidConferenceDetailView.as_view(), name='conference-detail'),
    path('openings/', views.BidOpeningListView.as_view(), name='opening-list'),
    path('openings/<uuid:pk>/', views.BidOpeningDetailView.as_view(), name='opening-detail'),
    path('openings/start/<uuid:pk>/', views.bid_opening_start_view, name='opening-start'),
    path('openings/<uuid:opening_pk>/open-bid/<uuid:bid_pk>/', views.bid_open_single_view, name='opening-open-bid'),
    path('openings/<uuid:pk>/minutes/', views.bid_opening_minutes_view, name='opening-minutes'),
    path('openings/<uuid:pk>/finalize/', views.bid_opening_finalize_view, name='opening-finalize'),
    path('openings/<uuid:pk>/send-minutes/', views.bid_opening_send_minutes_view, name='opening-send-minutes'),
    path('openings/conduct/<uuid:pk>/', views.bid_opening_conduct_view, name='opening-conduct'),
    path('openings/<uuid:pk>/track-viewer/', views.bid_opening_track_viewer_view, name='opening-track-viewer'),
    path('public/openings/<uuid:pk>/', views.public_bid_opening_view, name='public-opening'),
]

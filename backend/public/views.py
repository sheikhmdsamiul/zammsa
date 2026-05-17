from rest_framework import generics, views
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Count, Q, F, Sum as ModelSum
from django.utils import timezone
from django.shortcuts import get_object_or_404

from solicitations.models import Solicitation
from suppliers.models import Supplier
from .models import NewsArticle, Notice, Event, FAQItem, ContactMessage
from .serializers import (
    TenderPublicSerializer, TenderPublicListSerializer,
    NewsArticleSerializer, NoticeSerializer, EventSerializer,
    FAQItemSerializer, ContactMessageSerializer,
)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_stats(request):
    now = timezone.now()
    stats = {
        'total_tenders': Solicitation.objects.count(),
        'active_tenders': Solicitation.objects.filter(
            status='published', closing_date__gte=now
        ).count(),
        'registered_suppliers': Supplier.objects.filter(status='active').count(),
        'contracts_awarded': Solicitation.objects.filter(status='awarded').count(),
        'total_value': Solicitation.objects.filter(status='awarded').aggregate(
            total=ModelSum('requisition__estimated_total')
        )['total'] or 0,
    }
    return Response(stats)


class TenderList(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = TenderPublicListSerializer

    def get_queryset(self):
        now = timezone.now()
        queryset = Solicitation.objects.select_related('requisition').prefetch_related(
            'documents', 'addenda', 'evaluation_criteria', 'clarifications'
        )
        status = self.request.query_params.get('status')
        method = self.request.query_params.get('method')
        search = self.request.query_params.get('search')
        ordering = self.request.query_params.get('ordering', '-published_at')

        if status:
            queryset = queryset.filter(status=status)
        else:
            queryset = queryset.filter(status__in=['published', 'closed', 'awarded'])

        if method:
            queryset = queryset.filter(method__icontains=method)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(sol_number__icontains=search)
            )
        return queryset.order_by(ordering)


class TenderDetail(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = TenderPublicSerializer
    lookup_field = 'solicitation_id'
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        return Solicitation.objects.select_related('requisition').prefetch_related(
            'documents', 'addenda', 'evaluation_criteria', 'clarifications'
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def track_tender_view(request, pk):
    tender = get_object_or_404(Solicitation, solicitation_id=pk)
    return Response({'success': True})


class NewsList(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = NewsArticleSerializer

    def get_queryset(self):
        queryset = NewsArticle.objects.filter(is_published=True)
        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if category:
            queryset = queryset.filter(category=category)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(summary__icontains=search)
            )
        return queryset.order_by('-published_at')


class NewsDetail(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = NewsArticleSerializer
    lookup_field = 'news_id'

    def get_queryset(self):
        return NewsArticle.objects.filter(is_published=True)


@api_view(['POST'])
@permission_classes([AllowAny])
def track_news_view(request, pk):
    article = get_object_or_404(NewsArticle, news_id=pk)
    NewsArticle.objects.filter(news_id=pk).update(view_count=F('view_count') + 1)
    return Response({'success': True})


class NoticeList(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = NoticeSerializer

    def get_queryset(self):
        queryset = Notice.objects.filter(is_published=True)
        notice_type = self.request.query_params.get('type')
        is_pinned = self.request.query_params.get('is_pinned')
        search = self.request.query_params.get('search')
        if notice_type:
            queryset = queryset.filter(notice_type=notice_type)
        if is_pinned:
            queryset = queryset.filter(is_pinned=True)
        if search:
            queryset = queryset.filter(title__icontains=search)
        return queryset.order_by('-is_pinned', '-published_at')


class NoticeDetail(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = NoticeSerializer
    lookup_field = 'notice_id'

    def get_queryset(self):
        return Notice.objects.filter(is_published=True)


@api_view(['POST'])
@permission_classes([AllowAny])
def track_notice_view(request, pk):
    notice = get_object_or_404(Notice, notice_id=pk)
    Notice.objects.filter(notice_id=pk).update(view_count=F('view_count') + 1)
    return Response({'success': True})


class EventList(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = EventSerializer

    def get_queryset(self):
        now = timezone.now()
        queryset = Event.objects.filter(is_published=True)
        upcoming = self.request.query_params.get('upcoming')
        event_type = self.request.query_params.get('type')
        if upcoming:
            queryset = queryset.filter(start_date__gte=now)
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        return queryset.order_by('start_date')


class FAQList(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = FAQItemSerializer

    def get_queryset(self):
        queryset = FAQItem.objects.filter(is_published=True)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        return queryset.order_by('order', 'created_at')


class ContactCreate(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = ContactMessageSerializer


class TenderDocumentDownload(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request, tender_id, document_id):
        from django.http import FileResponse, HttpResponseNotFound
        from solicitations.models import SolicitationDocument
        document = get_object_or_404(
            SolicitationDocument,
            solicitation_id=tender_id,
            document_id=document_id,
        )
        import os
        if os.path.exists(document.file_path):
            return FileResponse(open(document.file_path, 'rb'), as_attachment=True)
        return HttpResponseNotFound('File not found')

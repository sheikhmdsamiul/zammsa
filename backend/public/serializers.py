from rest_framework import serializers
from solicitations.models import Solicitation, EvaluationCriterion, SolicitationAddendum, ClarificationRequest, SolicitationDocument
from suppliers.models import Supplier
from .models import NewsArticle, Notice, Event, FAQItem, ContactMessage


class PublicDocumentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='document_id', read_only=True)
    filename = serializers.SerializerMethodField()
    file_type = serializers.CharField(source='document_type', read_only=True)
    file_url = serializers.SerializerMethodField()
    uploaded_at = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = SolicitationDocument
        fields = ('id', 'filename', 'file_type', 'file_url', 'uploaded_at')

    def get_filename(self, obj):
        if obj.file:
            return obj.file.name
        return obj.file_path or 'Document'

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        if obj.file_path:
            return f'/media/solicitation_documents/{obj.file_path}'
        return None


class PublicEvaluationCriterionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='criterion_id', read_only=True)
    description = serializers.CharField(source='criterion_name')
    weight = serializers.DecimalField(max_digits=5, decimal_places=2)
    minimum_pass_score = serializers.DecimalField(max_digits=5, decimal_places=2, source='minimum_threshold')

    class Meta:
        model = EvaluationCriterion
        fields = ('id', 'description', 'weight', 'minimum_pass_score')


class PublicAddendumSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='addendum_id', read_only=True)
    number = serializers.IntegerField(source='addendum_number')
    issued_at = serializers.DateTimeField(source='created_at')

    class Meta:
        model = SolicitationAddendum
        fields = ('id', 'number', 'description', 'issued_at')


class PublicClarificationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='clarification_id', read_only=True)
    asked_by = serializers.CharField(source='supplier.full_name', read_only=True)
    asked_at = serializers.DateTimeField(source='asked_at')
    answered_at = serializers.DateTimeField(source='answered_at')

    class Meta:
        model = ClarificationRequest
        fields = ('id', 'question', 'answer', 'asked_by', 'asked_at', 'answered_at')


class TenderPublicSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='solicitation_id', read_only=True)
    title = serializers.CharField()
    description = serializers.CharField()
    type = serializers.SerializerMethodField()
    tender_number = serializers.CharField(source='sol_number')
    procuring_entity = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    procurement_method = serializers.CharField(source='method')
    category = serializers.CharField(source='method')
    estimated_value = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    fee_required = serializers.BooleanField(default=False)
    fee_amount = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)
    closing_date = serializers.DateTimeField()
    opening_date = serializers.DateTimeField()
    issue_date = serializers.DateTimeField(source='published_at')
    status = serializers.CharField()
    view_count = serializers.SerializerMethodField()
    award_notice = serializers.SerializerMethodField()
    bid_opening_results = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    evaluation_method = serializers.CharField(default=None)
    financial_weight = serializers.IntegerField(default=None)

    bid_security_required = serializers.BooleanField(default=False)
    bid_security_type = serializers.CharField(default='')
    submission_format = serializers.CharField(default='single')
    pre_bid_date = serializers.DateField(required=False, allow_null=True)
    pre_bid_venue = serializers.CharField(default='')
    contact_person = serializers.CharField(default='')
    contact_phone = serializers.CharField(default='')
    contact_email = serializers.CharField(default='')
    minimum_technical_threshold = serializers.IntegerField(required=False, allow_null=True)
    clarification_cutoff = serializers.DateTimeField(required=False, allow_null=True)
    citizen_preference = serializers.BooleanField(default=True)
    delivery_location = serializers.SerializerMethodField()

    documents = PublicDocumentSerializer(many=True, read_only=True)
    evaluation_criteria = PublicEvaluationCriterionSerializer(many=True, read_only=True)
    addenda = PublicAddendumSerializer(many=True, read_only=True)
    clarifications = PublicClarificationSerializer(many=True, read_only=True)

    class Meta:
        model = Solicitation
        fields = (
            'id', 'title', 'description', 'type', 'tender_number',
            'procuring_entity', 'department', 'procurement_method', 'category',
            'estimated_value', 'currency', 'fee_required', 'fee_amount',
            'closing_date', 'opening_date', 'issue_date', 'status', 'view_count',
            'documents', 'addenda', 'clarifications', 'evaluation_criteria',
            'award_notice', 'bid_opening_results', 'bid_security_rate',
            'bid_validity_days', 'created_at', 'items',
            'evaluation_method', 'financial_weight',
            'bid_security_required', 'bid_security_type', 'submission_format',
            'pre_bid_date', 'pre_bid_venue', 'contact_person', 'contact_phone',
            'contact_email', 'minimum_technical_threshold', 'clarification_cutoff',
            'citizen_preference', 'delivery_location',
        )

    def get_delivery_location(self, obj):
        if hasattr(obj, 'requisition') and obj.requisition:
            return obj.requisition.delivery_location or ''
        return ''

    def get_items(self, obj):
        if hasattr(obj, 'requisition') and obj.requisition:
            return [
                {
                    'description': item.description,
                    'quantity': float(item.quantity),
                    'unit': item.unit_of_measure.uom_name if item.unit_of_measure else '',
                    'unit_price': float(item.unit_price_estimate) if item.unit_price_estimate else 0,
                    'total_estimate': float(item.total_estimate) if item.total_estimate else 0,
                }
                for item in obj.requisition.items.all()
            ]
        return []

    def get_type(self, obj):
        method_lower = (obj.method or '').lower()
        if 'rfq' in method_lower or 'simplified' in method_lower or 'direct' in method_lower:
            return 'rfq'
        if 'rfp' in method_lower or 'proposal' in method_lower:
            return 'rfp'
        if 'rfi' in method_lower:
            return 'rfi'
        return 'rfb'

    def get_procuring_entity(self, obj):
        return 'ZAMMSA - Zambia Medicines and Medical Supplies Agency'

    def get_department(self, obj):
        if hasattr(obj, 'requisition') and obj.requisition and obj.requisition.department:
            return obj.requisition.department.dept_name
        return ''

    def get_estimated_value(self, obj):
        if obj.estimated_value is not None:
            return float(obj.estimated_value)
        if hasattr(obj, 'requisition') and obj.requisition:
            return float(obj.requisition.estimated_total) if obj.requisition.estimated_total else 0
        return 0

    def get_currency(self, obj):
        return 'ZMW'

    def get_view_count(self, obj):
        return 0

    def get_award_notice(self, obj):
        return None

    def get_bid_opening_results(self, obj):
        return None


class TenderPublicListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='solicitation_id', read_only=True)
    title = serializers.CharField()
    type = serializers.SerializerMethodField()
    tender_number = serializers.CharField(source='sol_number')
    procuring_entity = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    procurement_method = serializers.CharField(source='method')
    category = serializers.CharField(source='method')
    estimated_value = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    fee_required = serializers.BooleanField(default=False)
    fee_amount = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)
    closing_date = serializers.DateTimeField()
    opening_date = serializers.DateTimeField()
    issue_date = serializers.DateTimeField(source='published_at')
    status = serializers.CharField()
    view_count = serializers.SerializerMethodField()

    class Meta:
        model = Solicitation
        fields = (
            'id', 'title', 'type', 'tender_number', 'procuring_entity',
            'department', 'procurement_method', 'category', 'estimated_value',
            'currency', 'fee_required', 'fee_amount', 'closing_date',
            'opening_date', 'issue_date', 'status', 'view_count',
        )

    def get_type(self, obj):
        method_lower = (obj.method or '').lower()
        if 'rfq' in method_lower or 'simplified' in method_lower or 'direct' in method_lower:
            return 'rfq'
        if 'rfp' in method_lower or 'proposal' in method_lower:
            return 'rfp'
        if 'rfi' in method_lower:
            return 'rfi'
        return 'rfb'

    def get_procuring_entity(self, obj):
        return 'ZAMMSA - Zambia Medicines and Medical Supplies Agency'

    def get_department(self, obj):
        if hasattr(obj, 'requisition') and obj.requisition and obj.requisition.department:
            return obj.requisition.department.dept_name
        return ''

    def get_estimated_value(self, obj):
        if obj.estimated_value is not None:
            return float(obj.estimated_value)
        if hasattr(obj, 'requisition') and obj.requisition:
            return float(obj.requisition.estimated_total) if obj.requisition.estimated_total else 0
        return 0

    def get_currency(self, obj):
        return 'ZMW'

    def get_view_count(self, obj):
        return 0


class NewsArticleSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='news_id', read_only=True)
    slug = serializers.CharField()
    summary = serializers.CharField()
    content = serializers.CharField()
    category = serializers.CharField()
    featured_image = serializers.SerializerMethodField()
    author = serializers.CharField()
    published_at = serializers.DateTimeField()
    view_count = serializers.IntegerField()
    is_featured = serializers.BooleanField()
    tags = serializers.JSONField()

    class Meta:
        model = NewsArticle
        fields = ('id', 'title', 'slug', 'summary', 'content', 'category',
                  'featured_image', 'author', 'published_at', 'view_count',
                  'is_featured', 'tags')

    def get_featured_image(self, obj):
        if obj.featured_image:
            return obj.featured_image.url
        return ''


class NoticeSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='notice_id', read_only=True)
    title = serializers.CharField()
    content = serializers.CharField()
    type = serializers.CharField(source='notice_type')
    document = serializers.SerializerMethodField()
    is_pinned = serializers.BooleanField()
    view_count = serializers.IntegerField()
    published_at = serializers.DateTimeField()

    class Meta:
        model = Notice
        fields = ('id', 'title', 'content', 'type', 'document',
                  'is_pinned', 'view_count', 'published_at')

    def get_document(self, obj):
        if obj.document:
            return {'id': str(obj.notice_id), 'filename': obj.document.name, 'file_type': 'document', 'uploaded_at': obj.created_at.isoformat()}
        return None


class EventSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='event_id', read_only=True)
    title = serializers.CharField()
    description = serializers.CharField()
    type = serializers.CharField(source='event_type')
    location = serializers.CharField()
    start_date = serializers.DateTimeField()
    end_date = serializers.DateTimeField()
    registration_link = serializers.URLField(source='registration_link', allow_null=True)
    is_featured = serializers.BooleanField()

    class Meta:
        model = Event
        fields = ('id', 'title', 'description', 'type', 'location',
                  'start_date', 'end_date', 'registration_link', 'is_featured')


class FAQItemSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='faq_id', read_only=True)
    question = serializers.CharField()
    answer = serializers.CharField()
    category = serializers.CharField()
    order = serializers.IntegerField()

    class Meta:
        model = FAQItem
        fields = ('id', 'question', 'answer', 'category', 'order')


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ('name', 'email', 'subject', 'message')

    def create(self, validated_data):
        return ContactMessage.objects.create(**validated_data)

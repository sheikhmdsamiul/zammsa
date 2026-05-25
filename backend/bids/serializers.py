from rest_framework import serializers
from .models import BidSubmission, BidDocument, BidSecurity, BidOpening, BidOpeningDetail, PreBidConference


class BidDocumentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='document_id', read_only=True)
    filename = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = BidDocument
        fields = '__all__'
        read_only_fields = ('document_id', 'uploaded_at')

    def get_filename(self, obj):
        return obj.file_path.split('/')[-1] if '/' in obj.file_path else obj.file_path

    def get_file_url(self, obj):
        if not obj.file_path:
            return ''
        request = self.context.get('request')
        if obj.file_path.startswith('http://') or obj.file_path.startswith('https://'):
            return obj.file_path
        if request:
            return request.build_absolute_uri(f'/media/{obj.file_path}')
        return f'/media/{obj.file_path}'


class BidSecuritySerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='security_id', read_only=True)

    class Meta:
        model = BidSecurity
        fields = '__all__'
        read_only_fields = ('security_id',)


class BidSubmissionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='bid_id', read_only=True)
    vendor = serializers.UUIDField(source='supplier_id', read_only=True)
    vendor_name = serializers.CharField(source='supplier.full_name', read_only=True)
    bid_number = serializers.CharField(source='submission_id', read_only=True)
    bid_amount = serializers.DecimalField(source='bid_price', max_digits=20, decimal_places=2, read_only=True, allow_null=True)
    bid_documents = BidDocumentSerializer(many=True, read_only=True)
    bid_securities = BidSecuritySerializer(many=True, read_only=True)
    documents = BidDocumentSerializer(many=True, source='bid_documents', read_only=True)
    supplier_name = serializers.CharField(source='supplier.full_name', read_only=True)
    solicitation_title = serializers.CharField(source='solicitation.title', read_only=True)
    solicitation_number = serializers.CharField(source='solicitation.sol_number', read_only=True)
    solicitation_type = serializers.CharField(source='solicitation.method', read_only=True)
    closing_date = serializers.DateTimeField(source='solicitation.closing_date', read_only=True)

    class Meta:
        model = BidSubmission
        fields = '__all__'
        read_only_fields = ('bid_id', 'submission_id', 'receipt_number', 'submission_timestamp', 'submitted_at', 'created_at', 'updated_at')

    def create(self, validated_data):
        for f in ('bid_amount', 'bid_number', 'vendor', 'vendor_name', 'receipt_number'):
            self.initial_data.pop(f, None)
        currency = self.initial_data.get('currency')
        if currency and 'currency' not in validated_data:
            validated_data['currency'] = currency
        return super().create(validated_data)


class BidSubmissionListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='bid_id', read_only=True)
    vendor_name = serializers.CharField(source='supplier.full_name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.full_name', read_only=True)
    bid_number = serializers.CharField(source='submission_id', read_only=True)
    bid_amount = serializers.DecimalField(source='bid_price', max_digits=20, decimal_places=2, read_only=True, allow_null=True)
    solicitation_title = serializers.CharField(source='solicitation.title', read_only=True)
    solicitation_number = serializers.CharField(source='solicitation.sol_number', read_only=True)
    solicitation_type = serializers.CharField(source='solicitation.method', read_only=True)
    closing_date = serializers.DateTimeField(source='solicitation.closing_date', read_only=True)

    class Meta:
        model = BidSubmission
        fields = ('id', 'bid_id', 'submission_id', 'receipt_number', 'bid_number', 'vendor_name', 'supplier_name', 'bid_price', 'bid_amount', 'currency', 'status', 'is_late', 'financial_envelope_encrypted', 'addenda_acknowledged', 'submitted_at', 'solicitation_title', 'solicitation_number', 'solicitation_type', 'closing_date')


class BidOpeningDetailSerializer(serializers.ModelSerializer):
    bid_submission_id = serializers.CharField(source='bid.submission_id', read_only=True)
    bidder = serializers.CharField(source='bidder_name', read_only=True)
    bid_price = serializers.DecimalField(source='bid.bid_price', max_digits=20, decimal_places=2, read_only=True)
    bid_security_verified = serializers.BooleanField(source='bid.security_verified', read_only=True)
    bid_security_amount = serializers.DecimalField(source='bid.security_amount', max_digits=20, decimal_places=2, read_only=True, allow_null=True)
    supplier_name = serializers.CharField(source='bid.supplier.full_name', read_only=True)

    class Meta:
        model = BidOpeningDetail
        fields = '__all__'
        read_only_fields = ('detail_id', 'bidder_name')


class BidOpeningSerializer(serializers.ModelSerializer):
    opening_details = BidOpeningDetailSerializer(many=True, read_only=True)
    conducted_by_name = serializers.CharField(source='conducted_by.full_name', read_only=True)
    solicitation_title = serializers.CharField(source='solicitation.title', read_only=True)
    solicitation_number = serializers.CharField(source='solicitation.sol_number', read_only=True)
    total_bids = serializers.SerializerMethodField()
    opened_count = serializers.SerializerMethodField()

    class Meta:
        model = BidOpening
        fields = '__all__'
        read_only_fields = ('opening_id',)

    def get_total_bids(self, obj):
        return obj.solicitation.bids.filter(status='submitted').count()

    def get_opened_count(self, obj):
        return obj.opening_details.count()


class PreBidConferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreBidConference
        fields = '__all__'

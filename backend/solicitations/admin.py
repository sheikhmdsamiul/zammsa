import json
from django.contrib import admin
from django.utils.html import format_html
from .models import (
    SolicitationTemplate, Solicitation, EvaluationCriterion,
    SolicitationAddendum, ClarificationRequest, SolicitationDocument,
)


@admin.register(SolicitationTemplate)
class SolicitationTemplateAdmin(admin.ModelAdmin):
    # ── List view ──────────────────────────────────────────────────────────
    list_display = (
        'template_name', 'template_type_badge', 'procurement_type',
        'version', 'active_badge', 'zppa_badge', 'requires_cpp',
        'clause_count', 'updated_at',
    )
    list_filter = (
        'template_type', 'procurement_type',
        'is_zppa_template', 'is_active', 'requires_cpp',
    )
    search_fields = ('template_name', 'version', 'template_description')
    ordering = ('template_name', 'version')
    list_per_page = 25
    date_hierarchy = 'created_at'

    # ── Detail view ─────────────────────────────────────────────────────────
    readonly_fields = (
        'template_id', 'created_at', 'updated_at',
        'mandatory_clauses_pretty',
    )

    fieldsets = (
        ('Template Identity', {
            'fields': (
                'template_id', 'template_name', 'template_description',
                'template_type', 'procurement_type', 'method',
                'version',
            ),
        }),
        ('Status & Compliance', {
            'fields': (
                'is_active', 'is_zppa_template', 'requires_cpp',
            ),
        }),
        ('Governance', {
            'fields': (
                'applicable_value_range', 'auto_populate_fields',
            ),
            'description': (
                'applicable_value_range — JSON: {"min": 0, "max": 5000000}<br>'
                'auto_populate_fields — JSON list, e.g. ["method", "estimated_value"]'
            ),
        }),
        ('Template Content', {
            'fields': ('template_content',),
            'classes': ('wide',),
        }),
        ('Mandatory Clauses (FR-SOL-02)', {
            'fields': ('mandatory_clauses', 'mandatory_clauses_pretty'),
            'description': (
                'Each clause must have: <code>clause_id</code>, '
                '<code>clause_text</code>, and <code>is_locked</code> (true/false).'
            ),
        }),
        ('Audit Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    # ── Custom display columns ───────────────────────────────────────────────
    @admin.display(description='Type', ordering='template_type')
    def template_type_badge(self, obj):
        colours = {'itb': '#1d4ed8', 'rfp': '#7c3aed', 'rfq': '#0891b2'}
        colour = colours.get(obj.template_type, '#374151')
        label = obj.get_template_type_display()
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:9999px;font-size:11px;font-weight:600;">{}</span>',
            colour, label,
        )

    @admin.display(description='Active', boolean=False, ordering='is_active')
    def active_badge(self, obj):
        if obj.is_active:
            return format_html('<span style="color:#16a34a;font-weight:600;">● Active</span>')
        return format_html('<span style="color:#dc2626;font-weight:600;">○ Retired</span>')

    @admin.display(description='ZPPA', boolean=False, ordering='is_zppa_template')
    def zppa_badge(self, obj):
        if obj.is_zppa_template:
            return format_html(
                '<span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;'
                'border-radius:9999px;font-size:11px;font-weight:600;">ZPPA ✓</span>'
            )
        return format_html('<span style="color:#9ca3af;">—</span>')

    @admin.display(description='Clauses')
    def clause_count(self, obj):
        count = len(obj.mandatory_clauses) if isinstance(obj.mandatory_clauses, list) else 0
        locked = sum(1 for c in (obj.mandatory_clauses or []) if c.get('is_locked'))
        return format_html(
            '<span title="{} locked">{} ({} locked)</span>', locked, count, locked
        )

    @admin.display(description='Mandatory Clauses (Formatted)')
    def mandatory_clauses_pretty(self, obj):
        if not obj.mandatory_clauses:
            return '—'
        try:
            pretty = json.dumps(obj.mandatory_clauses, indent=2)
            return format_html('<pre style="font-size:12px;max-height:300px;overflow:auto;">{}</pre>', pretty)
        except Exception:
            return str(obj.mandatory_clauses)


# ── Remaining models — simple registrations ──────────────────────────────────
admin.site.register(Solicitation)
admin.site.register(EvaluationCriterion)
admin.site.register(SolicitationAddendum)
admin.site.register(ClarificationRequest)
admin.site.register(SolicitationDocument)

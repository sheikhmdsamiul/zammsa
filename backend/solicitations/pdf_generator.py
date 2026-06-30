import hashlib
import logging
import os
import uuid
from datetime import datetime
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.template.loader import render_to_string
from django.utils import timezone

from .models import Solicitation, SolicitationDocument
from .template_engine import merge_template, compute_document_hash, build_template_context

logger = logging.getLogger(__name__)

DEFAULT_PDF_OPTIONS = {
    'page-size': 'A4',
    'margin-top': '15mm',
    'margin-right': '12mm',
    'margin-bottom': '20mm',
    'margin-left': '12mm',
    'encoding': 'UTF-8',
    'no-outline': None,
    'enable-local-file-access': None,
}


def generate_solicitation_pdf(solicitation, watermark_draft=True):
    """Generate a full solicitation PDF document from template + data.

    Returns a dict with:
        - pdf_bytes: raw PDF content
        - file_name: suggested file name
        - document_hash: SHA-256 hex digest
    """
    from solicitations.models import SolicitationTemplate

    template = _resolve_template(solicitation)
    if not template:
        logger.error('No active template found for solicitation %s (method=%s)',
                      solicitation.sol_number, solicitation.method)
        return None

    merged_html = merge_template(solicitation, template.template_content)

    full_html = _build_full_html(
        solicitation=solicitation,
        content_html=merged_html,
        template=template,
        watermark_draft=watermark_draft,
    )

    try:
        import pdfkit
        pdf_bytes = pdfkit.from_string(full_html, False, options=DEFAULT_PDF_OPTIONS)
    except Exception as exc:
        logger.error('PDF generation failed for %s: %s', solicitation.sol_number, exc)
        return None

    doc_hash = compute_document_hash(pdf_bytes)
    safe_title = ''.join(c if c.isalnum() or c in ' -_' else '_' for c in solicitation.title)[:60]
    file_name = f'SOL-{solicitation.sol_number}-{safe_title}.pdf'

    return {
        'pdf_bytes': pdf_bytes,
        'file_name': file_name,
        'document_hash': doc_hash,
    }


def save_solicitation_pdf(solicitation, overrides=None):
    """Generate and save the PDF, creating a SolicitationDocument record.

    Returns the SolicitationDocument instance or None on failure.
    """
    status = solicitation.status
    is_draft = status in ('draft', 'pending_approval')

    result = generate_solicitation_pdf(solicitation, watermark_draft=is_draft)
    if not result:
        return None

    pdf_bytes = result['pdf_bytes']
    file_name = result['file_name']
    doc_hash = result['document_hash']

    doc = SolicitationDocument.objects.create(
        solicitation=solicitation,
        document_type='bidding_document',
        file_path=file_name,
        is_public=True,
    )
    doc.file.save(file_name, ContentFile(pdf_bytes))
    doc.file_path = doc.file.name
    doc.save(update_fields=['file_path'])

    if overrides:
        for key, val in overrides.items():
            setattr(doc, key, val)
            doc.save(update_fields=[key])

    solicitation.publication_proofs = {
        **solicitation.publication_proofs,
        'document_hash': doc_hash,
        'document_generated_at': timezone.now().isoformat(),
    }
    Solicitation.objects.filter(pk=solicitation.pk).update(
        publication_proofs=solicitation.publication_proofs
    )

    return doc


def generate_addendum_pdf(solicitation, addendum, original_text='', revised_text=''):
    """Generate an addendum PDF."""
    ctx = build_template_context(solicitation)
    ctx['addendum_number'] = str(addendum.addendum_number)
    ctx['addendum_description'] = addendum.description or ''
    ctx['addendum_reason'] = addendum.reason or ''
    ctx['addendum_issue_date'] = addendum.created_at.strftime('%d %B %Y') if addendum.created_at else ''
    ctx['addendum_original_text'] = original_text
    ctx['addendum_revised_text'] = revised_text
    ctx['addendum_extended_closing'] = addendum.extended_closing_date.strftime('%d %B %Y at %H:%M') if addendum.extended_closing_date else 'Not extended'

    addendum_html_path = os.path.join(settings.BASE_DIR, 'solicitations', 'templates', 'solicitations', 'addendum_pdf.html')

    if os.path.exists(addendum_html_path):
        html = render_to_string('solicitations/addendum_pdf.html', ctx)
    else:
        html = _build_addendum_html_fallback(ctx)

    try:
        import pdfkit
        pdf_bytes = pdfkit.from_string(html, False, options=DEFAULT_PDF_OPTIONS)
    except Exception as exc:
        logger.error('Addendum PDF generation failed: %s', exc)
        return None

    doc_hash = compute_document_hash(pdf_bytes)
    file_name = f'ADD-{solicitation.sol_number}-No{addendum.addendum_number}.pdf'

    doc = SolicitationDocument.objects.create(
        solicitation=solicitation,
        document_type='addendum',
        file_path=file_name,
        is_public=True,
    )
    doc.file.save(file_name, ContentFile(pdf_bytes))
    doc.file_path = doc.file.name
    doc.save(update_fields=['file_path'])

    return doc


def _resolve_template(solicitation):
    """Find the best matching template for this solicitation."""
    from .models import SolicitationTemplate

    method_map = {
        'open_tender': 'itb',
        'international': 'itb',
        'limited': 'itb',
        'simplified': 'rfq',
        'direct': 'rfq',
        'proposal': 'rfp',
    }

    lookup_method = method_map.get(solicitation.method, solicitation.method)

    template = SolicitationTemplate.objects.filter(
        method__iexact=lookup_method,
        is_active=True,
    ).first()

    if not template:
        template = SolicitationTemplate.objects.filter(
            method__iexact=solicitation.method,
            is_active=True,
        ).first()

    return template


def _build_full_html(solicitation, content_html, template, watermark_draft=True):
    """Wrap merged template content in a full PDF-ready HTML document."""
    watermark_style = ''
    watermark_tag = ''
    if watermark_draft:
        watermark_style = (
            '.watermark{position:fixed;top:50%;left:50%;'
            'transform:translate(-50%,-50%) rotate(-30deg);'
            'font-size:180px;font-weight:900;color:rgba(220,38,38,0.06);'
            'pointer-events:none;z-index:0;text-transform:uppercase;'
            'font-family:Arial,sans-serif;}'
        )
        watermark_tag = '<div class="watermark">DRAFT</div>'

    ctx = build_template_context(solicitation)
    status_badge = solicitation.status.replace('_', ' ').title()

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
@page{{size:A4;margin:0;}}
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{font-family:"Georgia","Times New Roman",serif;background:#fff;color:#1f2937;line-height:1.7;font-size:12pt;}}
.page{{max-width:100%;padding:0;}}
.header-bar{{background:#1e3a5f;color:white;padding:24px 36px;}}
.header-bar h1{{font-size:20pt;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;}}
.header-bar .sub{{font-size:10pt;opacity:0.8;margin-top:4px;}}
.header-bar .ref{{font-size:11pt;margin-top:8px;font-weight:700;}}
.header-bar .badge{{display:inline-block;margin-top:8px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);padding:4px 14px;border-radius:20px;font-size:9pt;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;}}
.content{{padding:36px;}}
.content h2{{font-size:16pt;font-weight:700;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb;color:#1e3a5f;}}
.content h3{{font-size:13pt;font-weight:700;margin:20px 0 8px;color:#1e3a5f;}}
.content p{{margin-bottom:12px;text-align:justify;}}
.content ul{{padding-left:24px;margin-bottom:12px;}}
.content ul li{{margin-bottom:6px;}}
.content table{{width:100%;border-collapse:collapse;margin:12px 0;font-size:10pt;}}
.content th{{background:#f3f4f6;padding:8px 10px;border:1px solid #d1d5db;text-align:left;font-weight:700;}}
.content td{{padding:8px 10px;border:1px solid #d1d5db;}}
.page-footer{{padding:12px 36px;border-top:1px solid #e5e7eb;text-align:center;font-size:8pt;color:#9ca3af;}}
.footer-left{{float:left;}}
.footer-right{{float:right;}}
.doc-hash{{font-family:monospace;font-size:7pt;color:#9ca3af;word-break:break-all;margin-top:4px;}}
.section-locked{{border-left:4px solid #ef4444;padding-left:12px;margin:16px 0;}}
.section-filled{{border-left:4px solid #10b981;padding-left:12px;margin:16px 0;}}
.section-auto{{border-left:4px solid #3b82f6;padding-left:12px;margin:16px 0;}}
{watermark_style}
</style>
</head>
<body>
{watermark_tag}
<div class="page">
<div class="header-bar">
<h1>{template.template_name}</h1>
<p class="sub">Zambia Medicines and Medical Supplies Agency (ZAMMSA)</p>
<p class="ref">Reference: {solicitation.sol_number} | Status: {status_badge}</p>
<span class="badge">Version {template.version}{' - ZPPA-Approved' if template.is_zppa_template else ''}</span>
</div>
<div class="content">
{content_html}
</div>
<div class="page-footer">
<div><span class="footer-left">ZAMMSA Procurement System</span><span class="footer-right">Page 1 of 1</span></div>
</div>
</div>
</body>
</html>'''


def _build_addendum_html_fallback(ctx):
    """Fallback addendum HTML if template file doesn't exist."""
    return f'''<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
body{{font-family:Georgia,serif;padding:40px;color:#1f2937;}}
h1{{color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:10px;}}
h2{{color:#1e3a5f;margin-top:24px;}}
table{{width:100%;border-collapse:collapse;margin:16px 0;}}
th,td{{padding:8px;border:1px solid #d1d5db;text-align:left;}}
th{{background:#f3f4f6;}}
.highlight{{background:#fef3c7;padding:16px;border-left:4px solid #f59e0b;margin:16px 0;}}
</style></head>
<body>
<h1>ADDENDUM No. {ctx.get('addendum_number', '')}</h1>
<p><strong>Solicitation:</strong> {ctx.get('sol_number', '')}</p>
<p><strong>Title:</strong> {ctx.get('title', '')}</p>
<p><strong>Issue Date:</strong> {ctx.get('addendum_issue_date', '')}</p>
<hr>
<h2>Description</h2>
<p>{ctx.get('addendum_description', '')}</p>
<h2>Reason</h2>
<p>{ctx.get('addendum_reason', '')}</p>
{'' if not ctx.get('addendum_original_text') else f'<h2>Original Text</h2><div class="highlight">{ctx["addendum_original_text"]}</div>'}
{'' if not ctx.get('addendum_revised_text') else f'<h2>Revised Text</h2><div class="highlight">{ctx["addendum_revised_text"]}</div>'}
<h2>Extended Closing Date</h2>
<p>{ctx.get('addendum_extended_closing', '')}</p>
<hr>
<p><em>This addendum forms part of the solicitation documents. Bidders must acknowledge receipt.</em></p>
<p style="margin-top:24px;font-size:10px;color:#9ca3af;">ZAMMSA Procurement System — Generated Document</p>
</body>
</html>'''

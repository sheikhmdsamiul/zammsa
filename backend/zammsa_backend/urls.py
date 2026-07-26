from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.db import connections
from django.core.cache import cache
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions


def health_check(request):
    db_ok = True
    try:
        connections['default'].cursor().execute('SELECT 1')
    except Exception:
        db_ok = False
    cache_ok = True
    try:
        cache.set('health_check', 'ok', 1)
    except Exception:
        cache_ok = False
    return JsonResponse({
        'status': 'healthy' if (db_ok and cache_ok) else 'degraded',
        'database': 'ok' if db_ok else 'error',
        'cache': 'ok' if cache_ok else 'error',
        'version': '1.0.0',
    })


def api_404_handler(request, exception=None):
    return JsonResponse({'error': 'Not found', 'detail': f'The requested URL was not found on this server.'}, status=404)


schema_view = get_schema_view(
    openapi.Info(
        title='ZAMMSA Procurement API',
        default_version='v1',
        description='Zambia Medicines and Medical Supplies Agency - Procurement System API',
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/health/', health_check),
    path('api/v1/', include('accounts.urls')),
    path('api/v1/master-data/', include('master_data.urls')),
    path('api/v1/system-config/', include('system_config.urls')),
    path('api/v1/procurement-planning/', include('procurement_planning.urls')),
    path('api/v1/requisitions/', include('requisitions.urls')),
    path('api/v1/method-selection/', include('method_selection.urls')),
    path('api/v1/solicitations/', include('solicitations.urls')),
    path('api/v1/bids/', include('bids.urls')),
    path('api/v1/evaluations/', include('evaluations.urls')),
    path('api/v1/contracts/', include('contracts.urls')),
    path('api/v1/finance/', include('finance.urls')),
    path('api/v1/suppliers/', include('suppliers.urls')),
    path('api/v1/reporting/', include('reporting.urls')),
    path('api/v1/integrations/', include('integrations.urls')),
    path('api/v1/public/', include('public.urls')),
    path('api/v1/swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('api/v1/redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    re_path(r'^api/v1/', api_404_handler),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler404 = api_404_handler

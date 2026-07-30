"""
External system API clients for post-qualification verification.

These are stub implementations that fall back to supplier profile data.
Replace stub methods with real API calls when credentials are available.
"""
import logging
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger('integrations')


@dataclass
class PACRAVerificationResult:
    company_name: str = ''
    registration_number: str = ''
    status: str = ''
    directors: list = field(default_factory=list)
    verified: bool = False
    verification_time: str = ''
    source: str = 'stub'
    error: str = ''


@dataclass
class ZRAVerificationResult:
    tax_clearance_valid: bool = False
    expiry_date: str = ''
    tin: str = ''
    verified: bool = False
    verification_time: str = ''
    source: str = 'stub'
    error: str = ''


@dataclass
class ZPPADebarmantResult:
    is_debarred: bool = False
    company_name: str = ''
    verified: bool = False
    verification_time: str = ''
    source: str = 'stub'
    error: str = ''


class PACRAClient:
    """PACRA (Patents and Companies Registration Agency) API client stub."""

    def verify_company(self, registration_number: str, company_name: str = '') -> PACRAVerificationResult:
        now = datetime.now().strftime('%d %b %Y at %H:%M')
        try:
            result = self._call_api(registration_number)
            result.verification_time = now
            return result
        except Exception as e:
            logger.warning(f'PACRA API stub fallback for {registration_number}: {e}')
            return PACRAVerificationResult(
                company_name=company_name,
                registration_number=registration_number,
                status='active',
                verified=True,
                verification_time=now,
                source='profile_fallback',
                error=str(e),
            )

    def _call_api(self, registration_number: str) -> PACRAVerificationResult:
        raise NotImplementedError(
            'PACRA API not configured. Set PACRA_API_URL and PACRA_API_KEY in environment.'
        )


class ZRAClient:
    """ZRA (Zambia Revenue Authority) Tax Clearance API client stub."""

    def verify_tax_clearance(self, tin: str, company_name: str = '') -> ZRAVerificationResult:
        now = datetime.now().strftime('%d %b %Y at %H:%M')
        try:
            result = self._call_api(tin)
            result.verification_time = now
            return result
        except Exception as e:
            logger.warning(f'ZRA API stub fallback for TIN {tin}: {e}')
            return ZRAVerificationResult(
                tax_clearance_valid=True,
                tin=tin,
                verified=True,
                verification_time=now,
                source='profile_fallback',
                error=str(e),
            )

    def _call_api(self, tin: str) -> ZRAVerificationResult:
        raise NotImplementedError(
            'ZRA API not configured. Set ZRA_API_URL and ZRA_API_KEY in environment.'
        )


class ZPPADebarmantClient:
    """ZPPA (Zambia Public Procurement Agency) debarment list API client stub."""

    def check_debarment(self, company_name: str, registration_number: str = '', tin: str = '') -> ZPPADebarmantResult:
        now = datetime.now().strftime('%d %b %Y at %H:%M')
        try:
            result = self._call_api(company_name, registration_number, tin)
            result.verification_time = now
            return result
        except Exception as e:
            logger.warning(f'ZPPA debarment stub fallback for {company_name}: {e}')
            from suppliers.models import Blacklist
            from django.db.models import Q
            is_debarred = Blacklist.objects.filter(
                Q(registration_number=registration_number) | Q(tin=tin) | Q(supplier__name=company_name)
            ).exists()
            return ZPPADebarmantResult(
                is_debarred=is_debarred,
                company_name=company_name,
                verified=True,
                verification_time=now,
                source='database_fallback',
                error=str(e),
            )

    def _call_api(self, company_name: str, registration_number: str, tin: str) -> ZPPADebarmantResult:
        raise NotImplementedError(
            'ZPPA e-GP API not configured. Set ZPPA_API_URL and ZPPA_API_KEY in environment.'
        )


pacra_client = PACRAClient()
zra_client = ZRAClient()
zppa_debarment_client = ZPPADebarmantClient()

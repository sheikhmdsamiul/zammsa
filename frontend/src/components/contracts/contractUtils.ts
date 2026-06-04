import { Contract } from '../../types';

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  po: 'Purchase Order',
  exc: 'Framework Contract',
};

export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_acceptance', label: 'Pending acceptance' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
] as const;

export function formatContractValue(value?: number | string | null, currency = 'ZMW') {
  if (value == null || value === '') return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '—';
  return `${currency === 'ZMW' ? 'K ' : ''}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-ZM', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function isStandstillExpired(contract: Contract) {
  if (!contract.waiting_period_end) return false;
  const end = contract.waiting_period_end.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return today >= end;
}

export function standstillProgress(contract: Contract) {
  if (!contract.award_notice_published || !contract.waiting_period_start || !contract.waiting_period_end) {
    return 0;
  }
  const start = new Date(contract.waiting_period_start).getTime();
  const end = new Date(contract.waiting_period_end).getTime();
  const now = Date.now();
  if (end <= start) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

export type WorkflowStep = {
  key: string;
  label: string;
  state: 'complete' | 'current' | 'upcoming' | 'blocked';
};

export function getWorkflowSteps(contract: Contract): WorkflowStep[] {
  const s = contract.status;
  const standstillDone = contract.award_notice_published && isStandstillExpired(contract);
  const signed = contract.signed_by_vendor && contract.signed_by_authority;
  const securityDone =
    !contract.requires_performance_bond ||
    (contract.performance_security_validated && contract.performance_security_uploaded);
  const isActiveOrBeyond = ['active', 'completed', 'terminated', 'closed', 'archived'].includes(s);

  const step = (key: string, label: string, complete: boolean, current: boolean): WorkflowStep => ({
    key,
    label,
    state: complete ? 'complete' : current ? 'current' : 'upcoming',
  });

  return [
    step('draft', 'Generated', s !== 'draft' || !!contract.contract_number, s === 'draft'),
    step(
      'standstill',
      'Standstill',
      standstillDone || isActiveOrBeyond,
      s === 'draft' && contract.award_notice_published && !standstillDone,
    ),
    step(
      'signing',
      'Signing',
      signed || isActiveOrBeyond,
      (s === 'draft' || s === 'pending_acceptance') && standstillDone && !signed,
    ),
    ...(contract.requires_performance_bond
      ? [
          step(
            'security',
            'Performance security',
            securityDone || s === 'active' || isActiveOrBeyond,
            s === 'pending_acceptance' && signed && !securityDone,
          ),
        ]
      : []),
    step('active', 'Active', ['active', 'completed', 'terminated', 'closed', 'archived'].includes(s), s === 'active'),
    step(
      'closure',
      'Closed',
      ['closed', 'archived'].includes(s),
      ['completed', 'terminated'].includes(s),
    ),
  ];
}

export function getNextAction(contract: Contract): { title: string; description: string; path?: string; tone: 'info' | 'warning' | 'success' } | null {
  if (contract.appeal_pending) {
    return {
      title: 'Appeal pending',
      description: 'Contract actions are paused until the appeal is resolved.',
      path: `/contracts/${contract.id}/standstill`,
      tone: 'warning',
    };
  }
  if (contract.status === 'draft' && !contract.award_notice_published) {
    return {
      title: 'Publish award notice',
      description: 'Start the mandatory standstill period before signing.',
      path: `/contracts/${contract.id}/standstill`,
      tone: 'info',
    };
  }
  if (contract.status === 'draft' && contract.award_notice_published && !isStandstillExpired(contract)) {
    const days = daysUntil(contract.waiting_period_end);
    return {
      title: 'Standstill in progress',
      description: days != null ? `${Math.max(0, days)} day(s) remaining until signing can begin.` : 'Waiting period has not expired.',
      path: `/contracts/${contract.id}/standstill`,
      tone: 'info',
    };
  }
  if (
    (contract.status === 'draft' || contract.status === 'pending_acceptance') &&
    isStandstillExpired(contract) &&
    !contract.signed_by_vendor
  ) {
    return {
      title: 'Awaiting supplier signature',
      description: 'Supplier must sign the contract in the vendor portal.',
      path: `/contracts/${contract.id}/signing`,
      tone: 'warning',
    };
  }
  if (contract.signed_by_vendor && !contract.signed_by_authority) {
    return {
      title: 'Awaiting DG countersignature',
      description: 'Director General must countersign to activate or proceed to performance security.',
      path: `/contracts/${contract.id}/signing`,
      tone: 'warning',
    };
  }
  if (
    contract.requires_performance_bond &&
    contract.status === 'pending_acceptance' &&
    !contract.performance_security_validated
  ) {
    return {
      title: 'Performance security required',
      description: contract.performance_security_uploaded
        ? 'Bond uploaded — contract manager must validate.'
        : 'Supplier must upload performance bond before contract is active.',
      path: '/contracts/performance-security',
      tone: 'warning',
    };
  }
  if (contract.status === 'active') {
    return {
      title: 'Contract active',
      description: 'Track milestones and deliverables. Supplier may submit invoices against this contract.',
      tone: 'success',
    };
  }
  if (contract.status === 'completed') {
    return {
      title: 'Complete closure checklist',
      description: 'Finalize inspections, payments, and archive when ready.',
      path: `/contracts/${contract.id}/closure`,
      tone: 'info',
    };
  }
  if (contract.status === 'closed') {
    return {
      title: 'Ready to archive',
      description: 'Move contract records to archive after retention review.',
      path: `/contracts/${contract.id}/archive`,
      tone: 'info',
    };
  }
  return null;
}

export type SigningStep = {
  key: string;
  label: string;
  who: string;
  state: 'complete' | 'current' | 'waiting' | 'blocked';
  detail?: string;
};

export function canSupplierSign(contract: Contract): boolean {
  if (contract.signed_by_vendor) return false;
  if (contract.appeal_pending) return false;
  if (!contract.award_notice_published) return false;
  return isStandstillExpired(contract);
}

export function canDGCountersign(contract: Contract): boolean {
  if (!contract.signed_by_vendor || contract.signed_by_authority) return false;
  if (contract.appeal_pending) return false;
  if (!isStandstillExpired(contract)) return false;
  return true;
}

export function canUploadPerformanceSecurity(contract: Contract): boolean {
  if (!contract.performance_security_required && !contract.requires_performance_bond) return false;
  if (!contract.signed_by_vendor) return false;
  if (contract.performance_security_validated) return false;
  return true;
}

export function canValidatePerformanceSecurity(contract: Contract): boolean {
  if (!contract.performance_security_uploaded) return false;
  if (contract.performance_security_validated) return false;
  return !!(contract.performance_security_required || contract.requires_performance_bond);
}

export function getSigningSteps(contract: Contract): SigningStep[] {
  const bondRequired = contract.requires_performance_bond || contract.performance_security_required;

  return [
    {
      key: 'standstill',
      label: 'Standstill complete',
      who: 'Procurement',
      state: contract.award_notice_published && isStandstillExpired(contract)
        ? 'complete'
        : contract.award_notice_published
          ? 'current'
          : 'waiting',
      detail: contract.award_notice_published
        ? isStandstillExpired(contract)
          ? 'Ready for signatures'
          : `Ends ${formatDate(contract.waiting_period_end)}`
        : 'Award notice not published',
    },
    {
      key: 'supplier',
      label: 'Supplier signature',
      who: 'Supplier (vendor portal)',
      state: contract.signed_by_vendor
        ? 'complete'
        : canSupplierSign(contract)
          ? 'current'
          : 'waiting',
      detail: contract.signed_by_vendor
        ? formatDate(contract.signed_vendor_date)
        : 'Awaiting supplier',
    },
    {
      key: 'dg',
      label: 'DG countersignature',
      who: 'Director General',
      state: contract.signed_by_authority
        ? 'complete'
        : canDGCountersign(contract)
          ? 'current'
          : contract.signed_by_vendor
            ? 'waiting'
            : 'blocked',
      detail: contract.signed_by_authority
        ? formatDate(contract.signed_authority_date)
        : 'Awaiting DG',
    },
    ...(bondRequired
      ? [
          {
            key: 'bond_upload',
            label: 'Performance bond upload',
            who: 'Supplier (vendor portal)',
            state: contract.performance_security_uploaded
              ? 'complete'
              : contract.signed_by_authority
                ? 'current'
                : 'waiting',
            detail: contract.performance_security_uploaded ? 'Uploaded' : 'Pending upload',
          } as SigningStep,
          {
            key: 'bond_validate',
            label: 'Bond validation',
            who: 'Contract Manager',
            state: contract.performance_security_validated
              ? 'complete'
              : contract.performance_security_uploaded
                ? 'current'
                : 'waiting',
            detail: contract.performance_security_validated ? 'Validated' : 'Pending validation',
          } as SigningStep,
        ]
      : []),
    {
      key: 'active',
      label: 'Contract active',
      who: 'System',
      state:
        contract.status === 'active' ||
        (contract.signed_by_authority && !bondRequired)
          ? 'complete'
          : contract.performance_security_validated
            ? 'complete'
            : 'waiting',
      detail: contract.status === 'active' ? 'Active' : 'Pending activation',
    },
  ];
}

export function getListProgressHint(row: {
  status: string;
  award_notice_published?: boolean;
  waiting_period_end?: string | null;
  signed_by_vendor?: boolean;
  signed_by_authority?: boolean;
  performance_security_required?: boolean;
  performance_security_validated?: boolean;
}) {
  if (row.status === 'draft' && !row.award_notice_published) return 'Awaiting award notice';
  if (row.status === 'draft' && row.award_notice_published && row.waiting_period_end) {
    const d = daysUntil(row.waiting_period_end);
    if (d != null && d > 0) return `Standstill (${d}d left)`;
    if (d != null && d <= 0) return 'Standstill complete';
  }
  if ((row.status === 'draft' || row.status === 'pending_acceptance') && !row.signed_by_vendor) return 'Awaiting supplier sign';
  if (row.signed_by_vendor && !row.signed_by_authority) return 'Awaiting DG sign';
  if (row.performance_security_required && !row.performance_security_validated) return 'Security pending';
  return null;
}

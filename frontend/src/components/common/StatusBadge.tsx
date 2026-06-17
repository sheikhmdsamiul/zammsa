import React from 'react';

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  submitted: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
  pending_dept_head: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  pending_finance: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  pending_matching: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  finance_reviewed: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
  pending_approval: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  pending_dg: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  pending_zpc: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  fully_approved: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  completed: { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-500' },
  terminated: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
  cancelled: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  published: { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500' },
  closed: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  awarded: { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-500' },
  pending_acceptance: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  archived: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  payment_failed: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
  processing: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
  sent: { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500' },
  confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  verified: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  failed: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
  overdue: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
  needs_improvement: { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
  assessed: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
  waived: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  waived_in_part: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
};

interface Props {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<Props> = ({ status, className = '' }) => {
  const style = statusStyles[status] || statusStyles.draft;
  const labelMap: Record<string, string> = {
    pending_matching: 'Discrepancy - Requires Review',
    finance_reviewed: 'Finance Reviewed',
    pending_approval: 'Ready for Approval',
    fully_approved: 'Fully Approved',
    payment_failed: 'Payment Failed',
    pending_acceptance: 'Pending Acceptance',
    pending_dept_head: 'Pending Department Head',
    pending_finance: 'Pending Finance',
    pending_dg: 'Pending Director General',
    pending_zpc: 'Pending ZPC',
  };
  const label = labelMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-tight ${style.bg} ${style.text} ${className}`}
    >
      <span className={`w-1 h-1 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
};

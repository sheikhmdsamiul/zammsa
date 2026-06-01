import React from 'react';

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
  submitted: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  pending_dept_head: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  pending_finance: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  pending_matching: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  pending_approval: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  pending_dg: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  pending_zpc: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400' },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  completed: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-400' },
  terminated: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
  published: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-400' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
  awarded: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  processing: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  sent: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-400' },
  confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  verified: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  failed: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400' },
  overdue: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  needs_improvement: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  assessed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  waived: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  waived_in_part: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
};

interface Props {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<Props> = ({ status, className = '' }) => {
  const style = statusStyles[status] || statusStyles.draft;
  
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${style.bg} ${style.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
    </span>
  );
};

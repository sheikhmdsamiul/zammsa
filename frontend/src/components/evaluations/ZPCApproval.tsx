import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, DocumentTextIcon, ClockIcon,
} from '@heroicons/react/outline';

const ZPCApproval: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionModal, setActionModal] = useState<{ berId: string; action: 'approve' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');

  const { data: bers, isLoading } = useQuery({
    queryKey: ['zpc-ber-list'],
    queryFn: () => evaluationsApi.listBERs({ status: 'submitted' }),
  });

  const { data: allBers } = useQuery({
    queryKey: ['all-ber-list'],
    queryFn: () => evaluationsApi.listBERs({ page_size: 100 }),
  });

  const approveMutation = useMutation({
    mutationFn: (reportId: string) => evaluationsApi.approveBER(reportId, { comment }),
    onSuccess: () => {
      toast.success('BER approved');
      queryClient.invalidateQueries({ queryKey: ['zpc-ber-list'] });
      setActionModal(null);
      setComment('');
    },
    onError: () => toast.error('Failed to approve BER'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ reportId, reason }: { reportId: string; reason: string }) =>
      evaluationsApi.rejectBER(reportId, { reason }),
    onSuccess: () => {
      toast.success('BER rejected');
      queryClient.invalidateQueries({ queryKey: ['zpc-ber-list'] });
      setActionModal(null);
      setComment('');
    },
    onError: () => toast.error('Failed to reject BER'),
  });

  const pending = (bers?.results || []).filter((b: any) => b.status === 'submitted').length;
  const approved = (allBers?.results || []).filter((b: any) => b.status === 'approved').length;
  const rejected = (allBers?.results || []).filter((b: any) => b.status === 'rejected').length;
  const total = allBers?.count || 0;

  const columns = [
    { key: 'id', label: 'BER #', render: (_: any, row: any) => (
      <span className="font-mono text-xs font-medium">{row.id?.slice(0, 8)}</span>
    )},
    { key: 'solicitation', label: 'Solicitation', render: (v: string, row: any) => (
      <div>
        <p className="text-sm font-medium">{row.solicitation_title || v?.slice(0, 8) || '-'}</p>
        <p className="text-xs text-gray-400">{row.solicitation_number || ''}</p>
      </div>
    )},
    { key: 'recommendation', label: 'Recommendation', render: (v: string) => (
      <span className="text-sm max-w-[150px] block truncate">{v || '-'}</span>
    )},
    { key: 'prepared_by', label: 'Prepared By', render: (v: string, row: any) => row.prepared_by_name || v || '-' },
    { key: 'submitted_at', label: 'Submitted', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'submitted'} /> },
    { key: 'id', label: '', render: (_: any, row: any) => (
      <div className="flex gap-1">
        {row.status === 'submitted' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setActionModal({ berId: row.id, action: 'approve' }); }}
              className="px-2 py-1 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600">
              Approve
            </button>
            <button onClick={(e) => { e.stopPropagation(); setActionModal({ berId: row.id, action: 'reject' }); }}
              className="px-2 py-1 bg-rose-500 text-white text-xs rounded-lg hover:bg-rose-600">
              Reject
            </button>
          </>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="ZPC Approval"
        description="Review and approve Bid Evaluation Reports (BERs)"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total BERs" value={total} icon={<DocumentTextIcon className="w-6 h-6" />} color="blue" />
        <StatCard label="Pending Review" value={pending} icon={<ClockIcon className="w-6 h-6" />} color="orange" />
        <StatCard label="Approved" value={approved} icon={<CheckCircleIcon className="w-6 h-6" />} color="green" />
        <StatCard label="Rejected" value={rejected} icon={<XCircleIcon className="w-6 h-6" />} color="red" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">BERs Awaiting ZPC Approval</h2>
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={bers?.results || []} />
        )}
        {(!bers?.results?.length) && !isLoading && (
          <div className="py-12 text-center text-gray-400">
            <CheckCircleIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">No BERs pending approval</p>
            <p className="text-sm mt-1">All evaluation reports have been reviewed</p>
          </div>
        )}
      </div>

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {actionModal.action === 'approve' ? 'Approve BER' : 'Reject BER'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {actionModal.action === 'approve'
                ? 'This will approve the Bid Evaluation Report and proceed to contract award.'
                : 'This will reject the Bid Evaluation Report and return it for revision.'}
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={actionModal.action === 'approve' ? 'Approval comment (optional)...' : 'Reason for rejection...'}
              rows={3}
              className="w-full border rounded-lg px-4 py-3 text-sm mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setActionModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              {actionModal.action === 'approve' ? (
                <button onClick={() => approveMutation.mutate(actionModal.berId)}
                  disabled={approveMutation.isPending}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                  {approveMutation.isPending ? 'Approving...' : 'Approve BER'}
                </button>
              ) : (
                <button onClick={() => rejectMutation.mutate({ reportId: actionModal.berId, reason: comment })}
                  disabled={rejectMutation.isPending || !comment}
                  className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject BER'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZPCApproval;

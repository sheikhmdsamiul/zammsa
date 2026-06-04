import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, DocumentTextIcon, ClockIcon,
  ShieldCheckIcon, EyeIcon,
} from '@heroicons/react/outline';

const ZPCApproval: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [actionModal, setActionModal] = useState<{ berId: string; action: 'approve' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');
  const [reviewPanel, setReviewPanel] = useState<any>(null);

  const { data: bers, isLoading } = useQuery({
    queryKey: ['zpc-ber-list'],
    queryFn: () => evaluationsApi.listBERs({ page_size: 100 }),
  });

  const approveMutation = useMutation({
    mutationFn: (reportId: string) => evaluationsApi.approveBER(reportId, { comment }),
    onSuccess: (data: any) => {
      toast.success('BER approved');
      queryClient.invalidateQueries({ queryKey: ['zpc-ber-list'] });
      setActionModal(null);
      setComment('');
      setReviewPanel(null);
      const isProcurementRole = user?.role === 'procurement_officer' || user?.role === 'procurement_manager' || user?.role === 'director_procurement';
      if (isProcurementRole) {
        const berId = data?.ber_id || data?.id;
        const solId = data?.solicitation_id || data?.solicitation;
        if (berId && solId) {
          navigate(`/contracts/generate?ber_id=${berId}&sol_id=${solId}`);
        }
      }
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
      setReviewPanel(null);
    },
    onError: () => toast.error('Failed to reject BER'),
  });

  const pending = (bers?.results || []).filter((b: any) => b.status === 'submitted').length;
  const approved = (bers?.results || []).filter((b: any) => b.status === 'approved').length;
  const rejected = (bers?.results || []).filter((b: any) => b.status === 'rejected').length;
  const total = bers?.count || 0;

  const columns = [
    { key: 'id', label: 'BER Ref', render: (_: any, row: any) => (
      <span className="font-mono text-xs font-medium">BER-{row.id?.slice(0, 8) || ''}</span>
    )},
    { key: 'solicitation', label: 'Solicitation', render: (v: string, row: any) => (
      <div>
        <p className="text-sm font-medium">{row.solicitation_title || v?.slice(0, 8) || '-'}</p>
        <p className="text-xs text-gray-400">{row.solicitation_number || ''}</p>
      </div>
    )},
    { key: 'value', label: 'Value', render: (v: string, row: any) => {
      const val = row.report_content?.winner?.price || row.report_content?.technical_evaluation?.[0]?.evaluated_price;
      return <span className="text-sm font-mono">{val ? `ZMW ${Number(val).toLocaleString()}` : '-'}</span>;
    }},
    { key: 'signed_count', label: 'Signatures', render: (v: number, row: any) => (
      <span className="text-sm">{v || 0}/{row.required_count || 0}</span>
    )},
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'submitted'} /> },
    { key: 'id', label: '', render: (_: any, row: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); setReviewPanel(row); }}
          className="px-2 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 flex items-center gap-1">
          <EyeIcon className="w-3 h-3" /> Review
        </button>
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

      {/* MFA notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-800">
        <ShieldCheckIcon className="w-5 h-5 text-amber-600 shrink-0" />
        MFA is required for ZPC approval actions. Verify your identity before proceeding.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total BERs" value={total} icon={<DocumentTextIcon className="w-6 h-6" />} color="blue" />
        <StatCard label="Pending Review" value={pending} icon={<ClockIcon className="w-6 h-6" />} color="orange" />
        <StatCard label="Approved" value={approved} icon={<CheckCircleIcon className="w-6 h-6" />} color="green" />
        <StatCard label="Rejected" value={rejected} icon={<XCircleIcon className="w-6 h-6" />} color="red" />
      </div>

      {/* BER Queue */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Bid Evaluation Reports</h2>
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={bers?.results || []} onRowClick={(row) => setReviewPanel(row)} />
        )}
        {(!bers?.results?.length) && !isLoading && (
          <div className="py-12 text-center text-gray-400">
            <CheckCircleIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">No Bid Evaluation Reports found</p>
            <p className="text-sm mt-1">BERs will appear here once they are generated and submitted</p>
          </div>
        )}
      </div>

      {/* BER Review Panel */}
      {reviewPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setReviewPanel(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">BER Review — {reviewPanel.id?.slice(0, 8)}</h2>
                <button onClick={() => setReviewPanel(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Solicitation</dt>
                    <dd className="font-semibold">{reviewPanel.solicitation_title || reviewPanel.solicitation}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Method</dt>
                    <dd className="font-semibold">QCBS (Two-Envelope)</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Submitted</dt>
                    <dd className="font-semibold">{reviewPanel.submitted_at ? new Date(reviewPanel.submitted_at).toLocaleDateString() : '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Signatures</dt>
                    <dd className="font-semibold text-emerald-600">{reviewPanel.signed_count || 0}/{reviewPanel.required_count || 0} ✅</dd>
                  </div>
                </dl>
              </div>

              {/* Quick summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Quick Summary</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Bidder</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-500">QCBS Score</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-500">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(reviewPanel.report_content?.technical_evaluation || []).map((bid: any, i: number) => (
                        <tr key={i} className={i === 0 ? 'bg-emerald-50' : ''}>
                          <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{bid.bidder_name || bid.submission_id || 'Unknown'}</td>
                          <td className="px-3 py-2 text-center font-mono font-bold">{Number(bid.combined_total_score || bid.overall_technical_score || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">
                            {i === 0
                              ? <span className="text-emerald-600 font-medium">🏆 Recommended</span>
                              : bid.passed === false || (bid.overall_technical_score || 0) < 70
                                ? <span className="text-red-600 font-medium">❌ Failed technical</span>
                                : <span className="text-gray-500">{i + 1}nd</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    if (!reviewPanel.id) return;
                    evaluationsApi.downloadBER(reviewPanel.id).then((blob: Blob) => {
                      const url = window.URL.createObjectURL(blob);
                      window.open(url, '_blank');
                      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                    }).catch(() => toast.error('Failed to load BER PDF'));
                  }}
                  className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-xs font-bold"
                >
                  View Full BER PDF
                </button>
                {reviewPanel.status === 'submitted' && (
                  <>
                    <button onClick={() => setActionModal({ berId: reviewPanel.id, action: 'approve' })}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold">
                      Approve BER
                    </button>
                    <button onClick={() => setActionModal({ berId: reviewPanel.id, action: 'reject' })}
                      className="px-4 py-2 bg-rose-500 text-white rounded-lg text-xs font-bold">
                      Reject BER
                    </button>
                  </>
                )}
                <button onClick={() => setReviewPanel(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {actionModal.action === 'approve' ? 'Approve BER' : 'Reject BER'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {actionModal.action === 'approve'
                ? 'This will approve the Bid Evaluation Report. The contract award process will begin.'
                : 'This will reject the Bid Evaluation Report and return it for revision.'}
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={actionModal.action === 'approve' ? 'Approval comment (optional)...' : 'Reason for rejection (required)...'}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm mb-4 focus:ring-2 focus:ring-zammsa-green/20"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setActionModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
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

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { ExclamationIcon, CheckCircleIcon, XIcon, ClockIcon, DocumentIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/outline';

const GROUNDS_OPTIONS = [
  { value: 'scoring_error', label: 'Scoring or Evaluation Error' },
  { value: 'procedural', label: 'Procedural Irregularity' },
  { value: 'conflict_of_interest', label: 'Conflict of Interest' },
  { value: 'eligibility', label: 'Eligibility / Qualification Error' },
  { value: 'specification', label: 'Specification Deviation' },
  { value: 'bias', label: 'Bias or Discrimination' },
  { value: 'other', label: 'Other' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  filed: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: <ClockIcon className="w-4 h-4" /> },
  under_review: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: <ExclamationIcon className="w-4 h-4" /> },
  upheld: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: <CheckCircleIcon className="w-4 h-4" /> },
  dismissed: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', icon: <XIcon className="w-4 h-4" /> },
  withdrawn: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-800', icon: <XIcon className="w-4 h-4" /> },
};

const AwardAppealManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSupplier = user?.role === 'supplier_user';
  const isInternal = !isSupplier;

  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedSolicitation, setSelectedSolicitation] = useState('');
  const [selectedBidder, setSelectedBidder] = useState('');
  const [grounds, setGrounds] = useState('');
  const [groundsDetail, setGroundsDetail] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<{ open: boolean; appeal: any }>({ open: false, appeal: null });
  const [resolutionStatus, setResolutionStatus] = useState<'upheld' | 'dismissed'>('dismissed');
  const [resolutionText, setResolutionText] = useState('');

  const { data: appealsData, isLoading } = useQuery({
    queryKey: ['award-appeals'],
    queryFn: () => evaluationsApi.listAppeals({ page_size: 50 }),
  });

  const appeals = appealsData?.results || [];

  const fileAppealMutation = useMutation({
    mutationFn: (data: { solicitation: string; bidder: string; grounds: string; grounds_detail?: string }) =>
      evaluationsApi.fileAppeal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      toast.success('Appeal filed successfully. Resolution deadline: 14 days.');
      setShowFileModal(false);
      setSelectedSolicitation('');
      setSelectedBidder('');
      setGrounds('');
      setGroundsDetail('');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to file appeal');
    },
  });

  const updateAppealMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string; resolution?: string } }) =>
      evaluationsApi.updateAppeal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      toast.success('Appeal updated');
      setResolveModal({ open: false, appeal: null });
      setResolutionText('');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to update appeal');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => evaluationsApi.withdrawAppeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      toast.success('Appeal withdrawn');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to withdraw appeal');
    },
  });

  const handleFileAppeal = () => {
    if (!selectedSolicitation || !selectedBidder || !grounds) {
      toast.error('Please fill in all required fields');
      return;
    }
    fileAppealMutation.mutate({
      solicitation: selectedSolicitation,
      bidder: selectedBidder,
      grounds,
      grounds_detail: groundsDetail,
    });
  };

  const handleResolve = () => {
    if (!resolveModal.appeal) return;
    updateAppealMutation.mutate({
      id: resolveModal.appeal.id,
      data: { status: resolutionStatus, resolution: resolutionText },
    });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Award Appeals</h1>
          <p className="text-sm text-gray-600 mt-1">
            {isSupplier
              ? 'File an appeal if you believe the award decision was incorrect. Appeals must be filed within 14 days of the award notification.'
              : 'Manage award appeals filed by unsuccessful bidders during the standstill period.'}
          </p>
        </div>
        {isSupplier && (
          <button
            onClick={() => setShowFileModal(true)}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 flex items-center gap-2"
          >
            <ExclamationIcon className="w-4 h-4" />
            File Appeal
          </button>
        )}
      </div>

      {appeals.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <ExclamationIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No appeals filed</p>
          <p className="text-sm text-gray-400 mt-1">
            {isSupplier ? 'You have not filed any award appeals.' : 'No award appeals have been filed yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appeals.map((appeal: any) => {
            const style = STATUS_STYLES[appeal.status] || STATUS_STYLES.filed;
            const isExpanded = expandedId === appeal.id;
            return (
              <div key={appeal.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                  onClick={() => setExpandedId(isExpanded ? null : appeal.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${style.bg} ${style.text}`}>
                      {style.icon}
                      {appeal.status_label || appeal.status}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{appeal.solicitation_number} — {appeal.bidder_name || appeal.submission_id}</p>
                      <p className="text-xs text-gray-500">{appeal.ground_label} • Filed {new Date(appeal.filed_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isInternal && appeal.status === 'filed' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setResolveModal({ open: true, appeal }); }}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
                      >
                        Review
                      </button>
                    )}
                    {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Solicitation:</span>
                        <p className="font-medium">{appeal.solicitation_number} — {appeal.solicitation_title}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Filed by:</span>
                        <p className="font-medium">{appeal.filed_by_name || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Deadline:</span>
                        <p className="font-medium">
                          {appeal.resolution_deadline
                            ? new Date(appeal.resolution_deadline).toLocaleDateString()
                            : '14 days from filing'}
                        </p>
                      </div>
                      {appeal.resolved_at && (
                        <div>
                          <span className="text-gray-500">Resolved:</span>
                          <p className="font-medium">{new Date(appeal.resolved_at).toLocaleDateString()} by {appeal.resolved_by_name}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Grounds for Appeal:</span>
                      <p className="text-sm mt-1">{appeal.grounds_detail || 'No details provided'}</p>
                    </div>
                    {appeal.resolution && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <span className="text-gray-500 text-sm">Resolution:</span>
                        <p className="text-sm mt-1">{appeal.resolution}</p>
                      </div>
                    )}
                    {isSupplier && ['filed', 'under_review'].includes(appeal.status) && (
                      <button
                        onClick={() => withdrawMutation.mutate(appeal.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100"
                      >
                        Withdraw Appeal
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showFileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">File Award Appeal</h2>
            <p className="text-sm text-gray-600">
              You may file an appeal if you believe the award decision was made in error. The appeal
              must be resolved before a contract can be signed.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Solicitation ID *</label>
                <input
                  type="text"
                  value={selectedSolicitation}
                  onChange={(e) => setSelectedSolicitation(e.target.value)}
                  placeholder="Enter solicitation UUID"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Bid ID *</label>
                <input
                  type="text"
                  value={selectedBidder}
                  onChange={(e) => setSelectedBidder(e.target.value)}
                  placeholder="Enter your bid submission UUID"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grounds for Appeal *</label>
                <select
                  value={grounds}
                  onChange={(e) => setGrounds(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select grounds...</option>
                  {GROUNDS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Explanation</label>
                <textarea
                  value={groundsDetail}
                  onChange={(e) => setGroundsDetail(e.target.value)}
                  rows={4}
                  placeholder="Explain why you believe the award decision was incorrect..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowFileModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleFileAppeal}
                disabled={!selectedSolicitation || !selectedBidder || !grounds || fileAppealMutation.isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {fileAppealMutation.isPending ? 'Filing...' : 'File Appeal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resolveModal.open && resolveModal.appeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Resolve Appeal</h2>
            <p className="text-sm text-gray-600">
              Review the grounds and determine whether the appeal is upheld or dismissed.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
              <p><strong>Solicitation:</strong> {resolveModal.appeal.solicitation_number}</p>
              <p><strong>Bidder:</strong> {resolveModal.appeal.bidder_name || resolveModal.appeal.submission_id}</p>
              <p><strong>Grounds:</strong> {resolveModal.appeal.ground_label}</p>
              <p className="mt-2"><strong>Detail:</strong> {resolveModal.appeal.grounds_detail || 'No details'}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Decision *</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setResolutionStatus('dismissed')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${
                      resolutionStatus === 'dismissed'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => setResolutionStatus('upheld')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${
                      resolutionStatus === 'upheld'
                        ? 'bg-red-50 border-red-300 text-red-800'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Uphold
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes *</label>
                <textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  rows={3}
                  placeholder="Provide reasoning for the decision..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setResolveModal({ open: false, appeal: null })}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolutionText || updateAppealMutation.isPending}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${
                  resolutionStatus === 'upheld' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {updateAppealMutation.isPending ? 'Saving...' : resolutionStatus === 'upheld' ? 'Uphold Appeal' : 'Dismiss Appeal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AwardAppealManagement;

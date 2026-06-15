import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { solicitationsApi } from '../../api/solicitations';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, InformationCircleIcon,
  ClockIcon, ShieldCheckIcon, LockClosedIcon, LockOpenIcon,
  DocumentTextIcon, UserCircleIcon, PaperClipIcon, DownloadIcon,
  EnvelopeIcon, ShieldExclamationIcon, ExclamationCircleIcon,
} from '@heroicons/react/outline';

const WORKFLOW_STEPS = [
  { label: 'Draft', statuses: ['draft'], getPerson: (sol: any) => sol.created_by ? `by ${getUserName(sol.created_by)}` : null },
  { label: 'Pending Approval', statuses: ['pending_approval'], getPerson: (_: any) => '→ Procurement Manager / Director' },
  { label: 'Approved', statuses: ['approved'], getPerson: (sol: any) => sol.approved_by ? `by ${getUserName(sol.approved_by)}` : null },
  { label: 'Published', statuses: ['published'], getPerson: () => null },
  { label: 'Closed', statuses: ['closed'], getPerson: () => null },
  { label: 'Awarded', statuses: ['awarded'], getPerson: () => null },
];

const PUBLISH_TARGETS = [
  { key: 'zammsa_website', label: 'ZAMMSA Website' },
  { key: 'egp_portal', label: 'e-GP Portal (ZPPA)' },
  { key: 'email_suppliers', label: 'Email Registered Suppliers' },
];

const TYPE_LABELS: Record<string, string> = {
  rfb: 'ITB — Invitation to Bid',
  rfp: 'RFP — Request for Proposals',
  rfq: 'RFQ — Request for Quotations',
  rfi: 'RFI — Request for Information',
};

function fmtDate(d: string | undefined): string {
  if (!d) return '---';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
}

function fmtDateTime(d: string | undefined): string {
  if (!d) return '---';
  try {
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(d);
  }
}

function getUserName(user: string | { full_name?: string; email?: string } | undefined): string {
  if (!user) return '---';
  if (typeof user === 'string') return user;
  return user.full_name || user.email || '---';
}

function getUserEmail(user: string | { full_name?: string; email?: string } | undefined): string | undefined {
  if (!user || typeof user === 'string') return undefined;
  return user.email;
}

const SolicitationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [addendumDesc, setAddendumDesc] = useState('');
  const [addendumReason, setAddendumReason] = useState('');
  const [addendumExtend, setAddendumExtend] = useState('');
  const [showAddendumForm, setShowAddendumForm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['zammsa_website']);
  const [showClarifyForm, setShowClarifyForm] = useState(false);

  const { data: sol, isLoading } = useQuery({
    queryKey: ['solicitation', id],
    queryFn: () => solicitationsApi.get(id!),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['solicitation', id] });

  const submitMutation = useMutation({
    mutationFn: () => solicitationsApi.submit(id!),
    onSuccess: (res) => { invalidate(); toast.success(res.message || 'Submitted for approval'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Submit failed'),
  });

  const approveMutation = useMutation({
    mutationFn: () => solicitationsApi.approve(id!),
    onSuccess: (res) => { invalidate(); toast.success(res.message || 'Approved'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Approval failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => solicitationsApi.reject(id!, comment || 'No reason provided'),
    onSuccess: (res) => { invalidate(); setComment(''); setShowRejectModal(false); toast.success(res.message || 'Returned to draft'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Reject failed'),
  });

  const publishMutation = useMutation({
    mutationFn: () => solicitationsApi.publish(id!, { targets: selectedTargets }),
    onSuccess: (res) => { invalidate(); setShowPublishModal(false); toast.success(res.message || 'Published'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Publish failed'),
  });

  const closeMutation = useMutation({
    mutationFn: () => solicitationsApi.close(id!),
    onSuccess: () => { invalidate(); toast.success('Solicitation closed'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Close failed'),
  });

  const addendumMutation = useMutation({
    mutationFn: (data: Record<string, any>) => solicitationsApi.addAddendum(id!, data),
    onSuccess: (res) => { invalidate(); setAddendumDesc(''); setAddendumReason(''); setAddendumExtend(''); setShowAddendumForm(false); toast.success(res.message || 'Addendum issued'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Addendum failed'),
  });

  const clarificationMutation = useMutation({
    mutationFn: (q: string) => solicitationsApi.submitClarification(id!, { question: q }),
    onSuccess: () => { setComment(''); setShowClarifyForm(false); invalidate(); toast.success('Question submitted'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Question failed'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!sol) return <p className="text-center text-gray-500 py-12">Solicitation not found</p>;

  const role = user?.role || '';
  const status = sol.status || '';
  const isRejectedDraft = status === 'draft' && !!sol.rejection_reason;
  const canEdit = status === 'draft' && role !== 'procurement_manager';

  const canSubmit =
    status === 'draft' &&
    ['procurement_officer', 'procurement_manager'].includes(role) &&
    !(role === 'procurement_manager' && isRejectedDraft);
  const canApprove = status === 'pending_approval' && ['procurement_manager', 'director_procurement'].includes(role);
  const canReject = status === 'pending_approval' && ['procurement_manager', 'director_procurement'].includes(role);
  const canPublish = status === 'approved' && ['procurement_officer', 'procurement_manager'].includes(role);
  const canClose = status === 'published' && ['procurement_manager', 'procurement_officer'].includes(role);
  const canOpen = status === 'closed' && ['procurement_manager', 'procurement_officer'].includes(role);
  const canAddAddendum = ['published', 'pending_approval', 'approved'].includes(status) && ['procurement_manager', 'procurement_officer'].includes(role);

  const showActions = canSubmit || canApprove || canReject || canPublish || canClose || canOpen || canAddAddendum;

  const currentWorkflowIdx = WORKFLOW_STEPS.findIndex(s => s.statuses.includes(status));

  const handleAddAddendum = () => {
    const data: Record<string, any> = { description: addendumDesc, reason: addendumReason };
    if (addendumExtend) data.extend_closing_days = parseInt(addendumExtend, 10);
    addendumMutation.mutate(data);
  };

  const handleClarify = () => {
    if (comment) clarificationMutation.mutate(comment);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-black text-gray-900">{sol.title}</h1>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                {TYPE_LABELS[sol.type] || sol.type?.toUpperCase()}
              </span>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm font-semibold text-gray-500 mt-1.5 flex items-center gap-2">
              {sol.sol_number && <><DocumentTextIcon className="w-4 h-4 text-gray-400" /> {sol.sol_number} &middot;</>}
              <UserCircleIcon className="w-4 h-4 text-gray-400" /> {sol.department_name || sol.department}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {canEdit && (
              <Link to={`/solicitations/${id}/edit`} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Edit
              </Link>
            )}
          </div>
        </div>

        {/* Action buttons row */}
        {showActions && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
            {canSubmit && (
              <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90 transition-colors disabled:opacity-50">
                <ShieldCheckIcon className="w-4 h-4" /> {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
              </button>
            )}
            {canApprove && (
              <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50">
                <CheckCircleIcon className="w-4 h-4" /> {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </button>
            )}
            {canReject && (
              <button onClick={() => setShowRejectModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors">
                <XCircleIcon className="w-4 h-4" /> Reject / Return to Draft
              </button>
            )}
            {canPublish && (
              <button onClick={() => setShowPublishModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors">
                <ShieldCheckIcon className="w-4 h-4" /> Publish
              </button>
            )}
            {canClose && (
              <button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-gray-600 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
                <LockClosedIcon className="w-4 h-4" /> {closeMutation.isPending ? 'Closing...' : 'Close'}
              </button>
            )}
            {canOpen && (
              <button onClick={() => navigate(`/bids/opening/setup`)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors">
                <LockOpenIcon className="w-4 h-4" /> Conduct Opening
              </button>
            )}
            {canAddAddendum && !showAddendumForm && (
              <button onClick={() => setShowAddendumForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-amber-700 bg-white border border-amber-300 rounded-xl hover:bg-amber-50 transition-colors">
                <InformationCircleIcon className="w-4 h-4" /> Issue Addendum
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rejection banner */}
      {sol.rejection_reason && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 flex items-start gap-3">
          <XCircleIcon className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-800">Rejection Reason</p>
            <p className="text-sm text-rose-700 mt-0.5">{sol.rejection_reason}</p>
            {sol.rejected_at && <p className="text-xs text-rose-500 mt-1">{fmtDateTime(sol.rejected_at)}</p>}
          </div>
        </div>
      )}

      {/* Publication Status */}
      {((sol.publication_targets?.length ?? 0) > 0 || sol.published_at) && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Publication Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PUBLISH_TARGETS.map(target => {
              const isPublished = sol.publication_targets?.includes(target.key);
              const proof = sol.publication_proofs?.[target.key];
              return (
                <div key={target.key} className={`p-4 rounded-2xl border-2 ${isPublished ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {isPublished ? <CheckCircleIcon className="w-4 h-4 text-emerald-600" /> : <ClockIcon className="w-4 h-4 text-gray-400" />}
                    <p className="text-sm font-bold text-gray-900">{target.label}</p>
                  </div>
                  <p className={`text-xs font-semibold ${isPublished ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {isPublished ? 'Published' : 'Not published'}
                  </p>
                  {proof?.timestamp && (
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(proof.timestamp).toLocaleString()}</p>
                  )}
                  {proof?.reference && (
                    <p className="text-[10px] text-gray-500 mt-0.5">Ref: {proof.reference}</p>
                  )}
                  {proof?.status && (
                    <p className={`text-[10px] font-medium mt-0.5 ${proof.status === 'delivered' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {proof.status}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {sol.egp_reference && <p className="text-xs text-gray-400 mt-3">e-GP Reference: {sol.egp_reference}</p>}
          {sol.published_at && <p className="text-xs text-gray-400">Published: {fmtDateTime(sol.published_at)}</p>}
          {sol.clarification_cutoff && (
            <p className="text-xs text-gray-400 mt-1">Clarification Cutoff: {fmtDateTime(sol.clarification_cutoff)}</p>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Solicitation Details</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Procurement Method</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{sol.procurement_method?.replace(/_/g, ' ') || '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CPP Reference</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.cpp_number || '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimated Value</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">K {sol.estimated_value?.toLocaleString()} {sol.currency}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Budget Code</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.budget_code || '-'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submission Format</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{sol.submission_format === 'two' ? 'Two Envelope' : sol.submission_format === 'single' ? 'Single Envelope' : '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Issue Date</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDate(sol.issue_date)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Closing Date</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(sol.closing_date)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Opening Date</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(sol.opening_date)}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Bids Received</p>
                <p className="text-lg font-black text-emerald-700 mt-0.5">{sol.total_bids ?? 0}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bid Validity</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.bid_validity_days ? `${sol.bid_validity_days} days` : '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Citizen Preference</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.citizen_preference ? 'Yes — margins apply' : 'No'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Min. Technical Threshold</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.minimum_technical_threshold ? `${sol.minimum_technical_threshold} points` : '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Evaluation Method</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">
                  {sol.evaluation_method === 'lowest_price' ? 'Lowest Evaluated Price' :
                   sol.evaluation_method === 'qcbs' ? `QCBS (${sol.financial_weight ? 100 - sol.financial_weight : 80}:${sol.financial_weight || 20})` :
                   sol.evaluation_method === 'qbs' ? 'Quality Based Selection' :
                   sol.evaluation_method === 'lcs' ? 'Least Cost Selection' :
                   sol.evaluation_method === 'fbs' ? 'Fixed Budget Selection' : '---'}
                </p>
              </div>
              {sol.pre_bid_date && (
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pre-Bid Conference</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDate(sol.pre_bid_date)}{sol.pre_bid_venue ? ` — ${sol.pre_bid_venue}` : ''}</p>
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Doc. Fee</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.document_fee_enabled ? `K${sol.document_fee_amount} per set` : 'Free'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Created</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(sol.created_at)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Updated</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(sol.updated_at)}</p>
              </div>
              {sol.published_at && (
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Published At</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtDateTime(sol.published_at)}</p>
                </div>
              )}
              {sol.created_by && (
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Created By</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{getUserName(sol.created_by)}</p>
                  {getUserEmail(sol.created_by) && (
                    <p className="text-xs font-semibold text-gray-500 mt-0.5">{getUserEmail(sol.created_by)}</p>
                  )}
                </div>
              )}
              {sol.approved_by && (
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Approved By</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{getUserName(sol.approved_by)}</p>
                  {getUserEmail(sol.approved_by) && (
                    <p className="text-xs font-semibold text-gray-500 mt-0.5">{getUserEmail(sol.approved_by)}</p>
                  )}
                </div>
              )}
              {sol.rejected_by && (
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rejected By</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{getUserName(sol.rejected_by)}</p>
                  {getUserEmail(sol.rejected_by) && (
                    <p className="text-xs font-semibold text-gray-500 mt-0.5">{getUserEmail(sol.rejected_by)}</p>
                  )}
                </div>
              )}
            </div>
            {sol.description && (
              <div className="mt-4 p-4 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Description</p>
                <p className="text-sm font-semibold text-gray-700">{sol.description}</p>
              </div>
            )}
          </div>

          {/* Non-Open Justifications */}
          {sol.non_open_justifications && sol.non_open_justifications.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Non-Open Justifications</h2>
              <div className="space-y-3">
                {sol.non_open_justifications.map((j: any) => (
                  <div key={j.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-start gap-2 mb-2">
                      <ExclamationCircleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">{j.method} - {j.reason_code}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{j.reason_text}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs font-semibold">
                      <span className={`px-2 py-0.5 rounded-full ${
                        j.status === 'approved' ? 'bg-green-100 text-green-700' :
                        j.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        j.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{j.status}</span>
                      {j.submitted_by && (
                        <span className="text-gray-500">Submitted by {getUserName(j.submitted_by)}</span>
                      )}
                      {j.zpc_approved_at && (
                        <span className="text-gray-500">Approved on {fmtDate(j.zpc_approved_at)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CPP Resource Requirements */}
          {sol.cpp_resource_requirements && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">CPP Resource Requirements</h2>
              <div className="space-y-3">
                {Object.entries(sol.cpp_resource_requirements).map(([key, value]) => (
                  <div key={key} className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">
                      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                       typeof value === 'number' ? value :
                       typeof value === 'string' ? value :
                       JSON.stringify(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bid Security */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Bid Security</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Required</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.bid_security_required ? 'Yes' : 'No'}</p>
              </div>
              {sol.bid_security_required && (
                <>
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{sol.bid_security_type?.replace(/_/g, ' ') || '---'}</p>
                  </div>
                  {sol.bid_security_rate && (
                    <div className="p-3 bg-gray-50 rounded-2xl">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rate</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.bid_security_rate}% of bid value</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact Person</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.contact_person || '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phone</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.contact_phone || '---'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{sol.contact_email || '---'}</p>
              </div>
            </div>
          </div>

          {/* Evaluation Criteria */}
          {sol.evaluation_criteria && sol.evaluation_criteria.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Evaluation Criteria</h2>
              <div className="space-y-2">
                {sol.evaluation_criteria.map((c: any) => (
                  <div key={c.criterion_id || c.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircleIcon className="w-4 h-4 text-zammsa-green shrink-0" />
                        <div>
                          <span className="text-sm font-bold text-gray-900">{c.criterion_name}</span>
                          {c.criterion_type && <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase">({c.criterion_type})</span>}
                          {c.scoring_guidance && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{c.scoring_guidance}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        {c.criterion_type === 'technical' && (
                          <>
                            <span className="text-sm font-black text-zammsa-green">{c.weight}%</span>
                            {c.max_score != null && (
                              <p className="text-[10px] text-gray-400">Max: {c.max_score}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-2">
                  <p className="text-xs font-bold text-gray-500">
                    Total: {sol.evaluation_criteria.reduce((s: number, c: any) => s + Number(c.weight), 0)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Clarifications */}
          {sol.clarification_responses?.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Clarifications</h2>
              <div className="space-y-3">
                {sol.clarification_responses.map((c: any) => (
                  <div key={c.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-start gap-2">
                      <InformationCircleIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">Q: {c.question}</p>
                        {c.answer ? (
                          <p className="text-sm text-gray-600 mt-1">A: {c.answer}</p>
                        ) : (
                          <p className="text-xs font-bold text-yellow-600 mt-1">Awaiting answer</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{fmtDate(c.asked_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {(sol.document_sets?.length > 0 || (sol.documents?.length ?? 0) > 0) && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Documents</h2>
              <div className="space-y-4">
                {sol.document_sets?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-2">Document Sets</p>
                    <div className="space-y-2">
                       {sol.document_sets.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <PaperClipIcon className="w-4 h-4 text-gray-400" />
                          <div className="flex-1 truncate min-w-0">
                            <span className="text-sm font-semibold text-gray-700">{doc.filename || doc.name || 'Document'}</span>
                            {doc.document_type && (
                              <p className="text-xs text-gray-500 mt-0.5 capitalize">{doc.document_type.replace(/_/g, ' ')}</p>
                            )}
                          </div>
                          {doc.file_url ? (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zammsa-green bg-zammsa-green/5 rounded-lg hover:bg-zammsa-green/10 transition-colors">
                              <DownloadIcon className="w-3.5 h-3.5" />
                              Download
                            </a>
                          ) : (
                            <span className="text-xs font-bold text-gray-300">No file</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(sol.documents?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-2">Additional Documents</p>
                    <div className="space-y-2">
                       {(sol.documents ?? []).map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <DocumentTextIcon className="w-4 h-4 text-zammsa-green" />
                          <div className="flex-1 truncate min-w-0">
                            <span className="text-sm font-semibold text-gray-700">{doc.filename || doc.name || 'Document'}</span>
                            {doc.document_type && (
                              <p className="text-xs text-gray-500 mt-0.5 capitalize">{doc.document_type.replace(/_/g, ' ')}</p>
                            )}
                          </div>
                          {doc.file_url ? (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zammsa-green bg-zammsa-green/5 rounded-lg hover:bg-zammsa-green/10 transition-colors">
                              <DownloadIcon className="w-3.5 h-3.5" />
                              Download
                            </a>
                          ) : (
                            <span className="text-xs font-bold text-gray-300">No file</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Workflow */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Workflow</h2>
            <div className="relative">
              {WORKFLOW_STEPS.map((step, i) => {
                const isActive = step.statuses.includes(status);
                const isPast = currentWorkflowIdx > i;
                const isCancelled = status === 'cancelled';
                const person = step.getPerson(sol);
                return (
                  <div key={i} className="flex items-start gap-3 pb-5 last:pb-0 relative">
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <div className={`absolute left-3.5 top-8 w-0.5 h-5 ${isPast ? 'bg-zammsa-green' : 'bg-gray-200'}`} />
                    )}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isPast ? 'bg-zammsa-green' :
                      isActive ? 'bg-zammsa-green ring-4 ring-zammsa-green/20' :
                      isCancelled ? 'bg-red-500' :
                      'bg-gray-100'
                    }`}>
                      {isPast ? (
                        <CheckCircleIcon className="w-4 h-4 text-white" />
                      ) : isActive ? (
                        <div className="w-2.5 h-2.5 bg-white rounded-full" />
                      ) : (
                        <div className="w-2.5 h-2.5 bg-gray-300 rounded-full" />
                      )}
                    </div>
                    <div className="pt-1">
                      <p className={`text-sm font-bold ${isActive || isPast ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                      {person && (
                        <p className={`text-[11px] font-semibold mt-0.5 ${isActive ? 'text-zammsa-green' : 'text-gray-400'}`}>{person}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {status === 'cancelled' && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl">
                  <p className="text-xs font-bold text-rose-700">This solicitation has been cancelled.</p>
                </div>
              )}
            </div>
          </div>

          {/* Addendum Form */}
          {showAddendumForm && canAddAddendum && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">New Addendum</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">Description *</label>
                  <textarea rows={2} value={addendumDesc} onChange={(e) => setAddendumDesc(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">Reason</label>
                  <input type="text" value={addendumReason} onChange={(e) => setAddendumReason(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block ml-1">Extend Closing (days) <span className="text-gray-300 font-normal normal-case">— optional; auto-set to 7 if within 7 days of closing</span></label>
                  <input type="number" min={1} value={addendumExtend} onChange={(e) => setAddendumExtend(e.target.value)} placeholder="e.g. 14" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleAddAddendum} disabled={!addendumDesc || addendumMutation.isPending} className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50">
                    {addendumMutation.isPending ? 'Issuing...' : 'Issue Addendum'}
                  </button>
                  <button onClick={() => setShowAddendumForm(false)} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Addenda List */}
          {sol.addenda && sol.addenda.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Addenda</h2>
              <div className="space-y-3">
                {sol.addenda.map((a: any) => (
                  <div key={a.id || a.addendum_id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <InformationCircleIcon className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-bold text-gray-900">Addendum #{a.number || a.addendum_number}</p>
                    </div>
                    <p className="text-sm text-gray-600">{a.description}</p>
                    {a.extended_closing_date && (
                      <p className="text-xs font-bold text-amber-600 mt-1">Extended to {fmtDateTime(a.extended_closing_date)}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{fmtDate(a.created_at || a.issued_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ask a Question */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Ask a Question</h2>
            {showClarifyForm ? (
              <div className="space-y-3">
                <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Enter your question about this solicitation..." className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20" />
                <div className="flex gap-2">
                  <button onClick={handleClarify} disabled={!comment || clarificationMutation.isPending} className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90 transition-colors disabled:opacity-50">
                    {clarificationMutation.isPending ? 'Submitting...' : 'Submit Question'}
                  </button>
                  <button onClick={() => { setShowClarifyForm(false); setComment(''); }} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowClarifyForm(true)} className="w-full px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center">
                Ask a Question
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-black text-gray-900">Reject / Return to Draft</h3>
            <p className="text-sm text-gray-500 mt-1">Provide a reason for rejection</p>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Enter rejection reason..." className="w-full mt-3 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-rose-500/20" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowRejectModal(false); setComment(''); }} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => rejectMutation.mutate()} disabled={!comment || rejectMutation.isPending} className="px-4 py-2.5 text-sm font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50">
                {rejectMutation.isPending ? 'Processing...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-black text-gray-900">Publish Solicitation</h3>
            <p className="text-sm text-gray-500 mt-1">Select publication targets</p>
            <div className="mt-4 space-y-3">
              {PUBLISH_TARGETS.map(target => (
                <label key={target.key} className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border-2 transition-all ${selectedTargets.includes(target.key) ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-100 bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    checked={selectedTargets.includes(target.key)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTargets([...selectedTargets, target.key]);
                      else setSelectedTargets(selectedTargets.filter(t => t !== target.key));
                    }}
                    className="text-zammsa-green focus:ring-zammsa-green rounded"
                  />
                  <span className="text-sm font-bold text-gray-900">{target.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowPublishModal(false); setSelectedTargets(['zammsa_website']); }} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => publishMutation.mutate()} disabled={selectedTargets.length === 0 || publishMutation.isPending} className="px-4 py-2.5 text-sm font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50">
                {publishMutation.isPending ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolicitationDetail;

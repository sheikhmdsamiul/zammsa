import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { bidsApi } from '../../api/bids';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  ExclamationIcon, CheckCircleIcon, XIcon, ClockIcon,
  ChevronDownIcon, ChevronUpIcon, ShieldCheckIcon, EyeIcon,
  DocumentTextIcon, ChatAltIcon, CalendarIcon, PaperClipIcon,
  QuestionMarkCircleIcon, CheckIcon,
} from '@heroicons/react/outline';

const GROUNDS_OPTIONS = [
  { value: 'scoring_error', label: 'Scoring or Evaluation Error' },
  { value: 'procedural', label: 'Procedural Irregularity' },
  { value: 'conflict_of_interest', label: 'Conflict of Interest' },
  { value: 'eligibility', label: 'Eligibility / Qualification Error' },
  { value: 'specification', label: 'Specification Deviation' },
  { value: 'bias', label: 'Bias or Discrimination' },
  { value: 'other', label: 'Other' },
];

const RESOLVER_ROLES = ['procurement_manager', 'director_procurement', 'zpc_member'];
const OFFICER_ROLES = ['procurement_officer', ...RESOLVER_ROLES];

const ACTION_LOG_ICONS: Record<string, string> = {
  filed: '📨',
  acknowledged: '✅',
  under_review: '🔍',
  review_notes_added: '📝',
  hearing_scheduled: '📅',
  clarification_requested: '❓',
  clarification_received: '💬',
  upheld: '🔴',
  dismissed: '🟢',
  withdrawn: '⚪',
  re_evaluation_initiated: '🔄',
};

function UrgencyBadge({ days, status }: { days: number | null; status: string }) {
  if (!['filed', 'under_review'].includes(status) || days === null) return null;
  if (days < 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
      Overdue {Math.abs(days)}d
    </span>
  );
  if (days <= 3) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
      Due in {days}d
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
      {days}d left
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    filed: 'bg-amber-50 text-amber-800 border-amber-200',
    under_review: 'bg-blue-50 text-blue-800 border-blue-200',
    upheld: 'bg-red-50 text-red-800 border-red-200',
    dismissed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    withdrawn: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  const label: Record<string, string> = {
    filed: 'Filed', under_review: 'Under Review', upheld: 'Upheld',
    dismissed: 'Dismissed', withdrawn: 'Withdrawn',
  };
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${map[status] || map.filed}`}>
      {label[status] || status}
    </span>
  );
}

function AppealTimeline({ status }: { status: string }) {
  const steps = ['filed', 'under_review', 'resolved'];
  const idx = status === 'filed' ? 0 : status === 'under_review' ? 1 : 2;
  const labels = ['Filed', 'Under Review', 'Decision'];
  return (
    <div className="flex items-center gap-2 mt-3">
      {steps.map((_, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-0.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= idx ? 'bg-zammsa-green text-white' : 'bg-gray-200 text-gray-400'}`}>
              {i + 1}
            </div>
            <span className={`text-[10px] font-semibold whitespace-nowrap ${i <= idx ? 'text-zammsa-green' : 'text-gray-400'}`}>{labels[i]}</span>
          </div>
          {i < 2 && <div className={`flex-1 h-0.5 mb-3 ${i < idx ? 'bg-zammsa-green' : 'bg-gray-200'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ─── Action History Timeline ────────────────────────────────────────────── */
function ActionHistory({ appealId }: { appealId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['appeal-action-logs', appealId],
    queryFn: () => evaluationsApi.getAppealActionLogs(appealId),
    enabled: !!appealId,
  });

  if (isLoading) return <div className="text-xs text-gray-400 py-2">Loading history...</div>;
  const logs = data?.action_logs || [];
  if (logs.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <ClockIcon className="w-3.5 h-3.5" /> Action History
      </h4>
      <div className="relative pl-4 space-y-3">
        <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-gray-200" />
        {logs.map((log: any) => (
          <div key={log.id} className="relative flex items-start gap-3">
            <div className="absolute left-[-12px] top-1 w-3 h-3 rounded-full bg-white border-2 border-blue-400 z-10" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">{ACTION_LOG_ICONS[log.action] || '📋'}</span>
                <span className="text-xs font-semibold text-gray-800">{log.action_display}</span>
                {log.performed_by_name && (
                  <span className="text-[10px] text-gray-400">by {log.performed_by_name}</span>
                )}
                <span className="text-[10px] text-gray-400">
                  {new Date(log.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {log.details && (
                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{log.details}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Evidence Viewer Panel ──────────────────────────────────────────────── */
function EvidenceViewer({ appealId }: { appealId: string }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const { data: evidence, isLoading } = useQuery({
    queryKey: ['appeal-evidence', appealId],
    queryFn: () => evaluationsApi.getAppealEvidence(appealId),
    enabled: showEvidence && !!appealId,
  });

  return (
    <div>
      <button
        onClick={() => setShowEvidence(!showEvidence)}
        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg hover:bg-indigo-100 flex items-center gap-1.5"
      >
        <EyeIcon className="w-3.5 h-3.5" />
        {showEvidence ? 'Hide Evidence' : 'View Evaluation Evidence'}
      </button>

      {showEvidence && (
        <div className="mt-3 space-y-4 border border-gray-200 rounded-xl p-4 bg-gray-50">
          {isLoading ? (
            <LoadingSpinner />
          ) : evidence ? (
            <>
              {/* appellant info */}
              {evidence.appellant && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Appellant Bid Details</h5>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><span className="text-gray-400">Bidder:</span> <strong>{evidence.appellant.bidder_name}</strong></div>
                    <div><span className="text-gray-400">Submission:</span> <strong>{evidence.appellant.submission_id}</strong></div>
                    <div><span className="text-gray-400">Amount:</span> <strong>{evidence.appellant.currency} {Number(evidence.appellant.bid_amount).toLocaleString()}</strong></div>
                  </div>
                </div>
              )}

              {/* ranking context */}
              {evidence.ranking && evidence.ranking.length > 0 && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Bid Rankings</h5>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b">
                        <th className="text-left py-1 font-semibold">Rank</th>
                        <th className="text-left py-1 font-semibold">Bidder</th>
                        <th className="text-right py-1 font-semibold">Tech</th>
                        <th className="text-right py-1 font-semibold">Financial</th>
                        <th className="text-right py-1 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.ranking.map((r: any) => (
                        <tr key={r.rank} className={`border-b ${r.is_appellant ? 'bg-amber-50 font-bold' : ''}`}>
                          <td className="py-1">#{r.rank}</td>
                          <td className="py-1">{r.bidder_name} {r.is_appellant && <span className="text-amber-600">(Appellant)</span>}</td>
                          <td className="py-1 text-right">{Number(r.technical_score).toFixed(1)}</td>
                          <td className="py-1 text-right">{Number(r.financial_score).toFixed(1)}</td>
                          <td className="py-1 text-right">{Number(r.total_score).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* technical scores for appellant */}
              {evidence.technical_scores && evidence.technical_scores.length > 0 && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Appellant Technical Scores</h5>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b">
                        <th className="text-left py-1 font-semibold">Criterion</th>
                        <th className="text-right py-1 font-semibold">Weight</th>
                        <th className="text-right py-1 font-semibold">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.technical_scores.map((ts: any) => (
                        <tr key={ts.criterion_id} className="border-b">
                          <td className="py-1">{ts.criterion_name}</td>
                          <td className="py-1 text-right">{ts.weight}%</td>
                          <td className="py-1 text-right">{ts.average_score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* COI declarations */}
              {evidence.coi_declarations && evidence.coi_declarations.length > 0 && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">COI Declarations</h5>
                  <div className="space-y-1">
                    {evidence.coi_declarations.map((coi: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className={coi.has_conflict ? 'text-red-600 font-bold' : 'text-emerald-600'}>
                          {coi.has_conflict ? 'Conflict' : 'No Conflict'}
                        </span>
                        <span className="text-gray-700">{coi.member}</span>
                        {coi.recused && <span className="text-amber-600">(Recused)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400">No evidence data available.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Internal Review Panel ──────────────────────────────────────────────── */
function InternalReviewPanel({ appeal, isResolver }: { appeal: any; isResolver: boolean }) {
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState(appeal.review_notes || '');
  const [hearingDate, setHearingDate] = useState('');
  const [clarificationQ, setClarificationQ] = useState('');
  const [clarificationR, setClarificationR] = useState('');

  const addReviewNotesMutation = useMutation({
    mutationFn: () => evaluationsApi.addReviewNotes(appeal.id, reviewNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      toast.success('Review notes saved');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to save notes'),
  });

  const setHearingMutation = useMutation({
    mutationFn: () => evaluationsApi.setHearingDate(appeal.id, hearingDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      toast.success('Hearing date scheduled');
      setHearingDate('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to schedule hearing'),
  });

  const requestClarificationMutation = useMutation({
    mutationFn: () => evaluationsApi.requestClarification(appeal.id, clarificationQ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      toast.success('Clarification request sent to bidder');
      setClarificationQ('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to send request'),
  });

  return (
    <div className="space-y-4 border-t border-gray-200 pt-4">
      <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
        Procurement Officer Review Panel
      </h4>

      {/* Review Notes */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
          <DocumentTextIcon className="w-3.5 h-3.5" /> Internal Review Notes
        </label>
        <textarea
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          rows={3}
          placeholder="Add internal review notes (not visible to the bidder)..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={() => addReviewNotesMutation.mutate()}
          disabled={!reviewNotes.trim() || addReviewNotesMutation.isPending}
          className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {addReviewNotesMutation.isPending ? 'Saving...' : 'Save Notes'}
        </button>
      </div>

      {/* Schedule Hearing */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
          <CalendarIcon className="w-3.5 h-3.5" /> Schedule Hearing
        </label>
        <div className="flex items-end gap-2">
          <input
            type="datetime-local"
            value={hearingDate}
            onChange={(e) => setHearingDate(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => setHearingMutation.mutate()}
            disabled={!hearingDate || setHearingMutation.isPending}
            className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {setHearingMutation.isPending ? 'Scheduling...' : 'Schedule'}
          </button>
        </div>
        {appeal.hearing_date && (
          <p className="mt-2 text-xs text-gray-600">
            Scheduled: <strong>{new Date(appeal.hearing_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
          </p>
        )}
      </div>

      {/* Request Clarification */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
          <QuestionMarkCircleIcon className="w-3.5 h-3.5" /> Request Clarification from Bidder
        </label>
        {appeal.clarification_requested && appeal.clarification_request && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
            <p className="text-[10px] font-bold text-blue-600 uppercase">Previous Request:</p>
            <p className="text-xs text-gray-700">{appeal.clarification_request}</p>
          </div>
        )}
        {appeal.clarification_response && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mb-2">
            <p className="text-[10px] font-bold text-emerald-600 uppercase">Bidder Response:</p>
            <p className="text-xs text-gray-700">{appeal.clarification_response}</p>
          </div>
        )}
        <textarea
          value={clarificationQ}
          onChange={(e) => setClarificationQ(e.target.value)}
          rows={3}
          placeholder="Enter your clarification question for the bidder..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={() => requestClarificationMutation.mutate()}
          disabled={!clarificationQ.trim() || requestClarificationMutation.isPending}
          className="mt-2 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          <ChatAltIcon className="w-3.5 h-3.5" />
          {requestClarificationMutation.isPending ? 'Sending...' : 'Send Clarification Request'}
        </button>
      </div>

      {/* Supporting Documents */}
      {appeal.supporting_documents && appeal.supporting_documents.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
            <PaperClipIcon className="w-3.5 h-3.5" /> Supporting Documents
          </label>
          <div className="space-y-1">
            {appeal.supporting_documents.map((doc: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <DocumentTextIcon className="w-3.5 h-3.5 text-gray-400" />
                {doc.file_url ? (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {doc.name || `Document ${idx + 1}`}
                  </a>
                ) : (
                  <span className="text-gray-700">{doc.name || `Document ${idx + 1}`}</span>
                )}
                {doc.description && <span className="text-gray-400">— {doc.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Supplier: Clarification Response Panel ─────────────────────────────── */
function SupplierClarificationPanel({ appeal }: { appeal: any }) {
  const queryClient = useQueryClient();
  const [response, setResponse] = useState('');

  const respondMutation = useMutation({
    mutationFn: () => evaluationsApi.respondClarification(appeal.id, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      toast.success('Clarification response submitted');
      setResponse('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to submit response'),
  });

  if (!appeal.clarification_requested) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <QuestionMarkCircleIcon className="w-4 h-4 text-blue-600" />
        <h4 className="text-xs font-bold text-blue-800 uppercase">Clarification Requested by Procurement Team</h4>
      </div>
      <p className="text-sm text-gray-700 bg-white rounded-lg p-2 border border-blue-100">
        {appeal.clarification_request}
      </p>

      {appeal.clarification_response ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
          <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Your Response (submitted)</p>
          <p className="text-sm text-gray-700">{appeal.clarification_response}</p>
        </div>
      ) : (
        <>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={3}
            placeholder="Provide your clarification response..."
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => respondMutation.mutate()}
            disabled={!response.trim() || respondMutation.isPending}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <CheckIcon className="w-3.5 h-3.5" />
            {respondMutation.isPending ? 'Submitting...' : 'Submit Response'}
          </button>
        </>
      )}
    </div>
  );
}

/* ─── Supplier: File Appeal Modal ──────────────────────────────────────────── */
function FileAppealModal({ onClose, initialSolId = '', initialBidId = '' }: { onClose: () => void; initialSolId?: string; initialBidId?: string }) {
  const queryClient = useQueryClient();
  const [solId, setSolId] = useState(initialSolId);
  const [bidId, setBidId] = useState(initialBidId);
  const [grounds, setGrounds] = useState('');
  const [detail, setDetail] = useState('');

  const { data: awardedSols } = useQuery({
    queryKey: ['awarded-solicitations'],
    queryFn: () => solicitationsApi.list({ status: 'awarded', page_size: 50 }),
  });

  const { data: myBids } = useQuery({
    queryKey: ['my-bids-for-appeal', solId],
    queryFn: () => bidsApi.list({ solicitation: solId, page_size: 50 }),
    enabled: !!solId,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => evaluationsApi.fileAppeal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      toast.success('Appeal filed. Resolution deadline: 14 days.');
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to file appeal'),
  });

  const sols = awardedSols?.results || [];
  const bids = (myBids?.results || []).filter((b: any) => b.status === 'unsuccessful');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">File Award Appeal</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><XIcon className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500">
          Appeals must be filed within 14 days of award notification. The Procurement Officer will review within 2 business days.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Solicitation *</label>
            <select
              value={solId}
              onChange={(e) => { setSolId(e.target.value); setBidId(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="">Select awarded solicitation...</option>
              {sols.map((s: any) => (
                <option key={s.id || s.solicitation_id} value={s.id || s.solicitation_id}>
                  {s.sol_number} — {s.title}
                </option>
              ))}
            </select>
          </div>

          {solId && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Your Bid *</label>
              {bids.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No eligible bids found for this solicitation. Only unsuccessful bids can be appealed.
                </p>
              ) : (
                <select
                  value={bidId}
                  onChange={(e) => setBidId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="">Select your bid...</option>
                  {bids.map((b: any) => (
                    <option key={b.id || b.bid_id} value={b.id || b.bid_id}>
                      {b.bid_number || b.submission_id} — {b.solicitation_title || ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Grounds for Appeal *</label>
            <select
              value={grounds}
              onChange={(e) => setGrounds(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="">Select grounds...</option>
              {GROUNDS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Detailed Explanation *</label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={4}
              placeholder="Explain specifically why you believe the award decision was incorrect, referencing relevant procurement regulations where applicable..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button
            onClick={() => mutation.mutate({ solicitation: solId, bidder: bidId, grounds, grounds_detail: detail })}
            disabled={!solId || !bidId || !grounds || !detail.trim() || mutation.isPending}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Filing...' : 'Submit Appeal'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Internal: Resolve Modal ──────────────────────────────────────────────── */
function ResolveModal({ appeal, onClose }: { appeal: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<'upheld' | 'dismissed'>('dismissed');
  const [resolution, setResolution] = useState('');
  const [upheldAction, setUpheldAction] = useState<'reopen_evaluation' | 'cancel_procurement'>('reopen_evaluation');
  const [decisionLetterFile, setDecisionLetterFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      formData.append('status', decision);
      formData.append('resolution', resolution);
      if (decision === 'upheld') {
        if (upheldAction === 'reopen_evaluation') {
          formData.append('reopen_evaluation', 'true');
        } else if (upheldAction === 'cancel_procurement') {
          formData.append('cancel_procurement', 'true');
        }
      }
      if (decisionLetterFile) {
        formData.append('decision_letter', decisionLetterFile);
      }
      return evaluationsApi.resolveAppeal(appeal.id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-committees'] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-committee'] });
      queryClient.invalidateQueries({ queryKey: ['phase-status'] });
      queryClient.invalidateQueries({ queryKey: ['coi-committee'] });
      queryClient.invalidateQueries({ queryKey: ['ber-for-solicitation'] });
      toast.success(`Appeal resolved successfully`);
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to resolve appeal'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Resolve Appeal</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><XIcon className="w-5 h-5" /></button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
          <p><span className="text-gray-500">Solicitation:</span> <strong>{appeal.solicitation_number}</strong> — {appeal.solicitation_title}</p>
          <p><span className="text-gray-500">Bidder:</span> <strong>{appeal.bidder_name}</strong> ({appeal.submission_id})</p>
          <p><span className="text-gray-500">Grounds:</span> {appeal.ground_label}</p>
          {appeal.grounds_detail && <p className="mt-1 text-gray-700 italic">"{appeal.grounds_detail}"</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Decision *</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDecision('dismissed')}
              className={`px-4 py-3 rounded-xl text-sm font-bold border-2 transition-all ${decision === 'dismissed' ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              <CheckCircleIcon className="w-5 h-5 mx-auto mb-1" />
              Dismiss Appeal
              <p className="text-[10px] font-normal mt-0.5">Award decision stands. Contract proceeds.</p>
            </button>
            <button
              onClick={() => setDecision('upheld')}
              className={`px-4 py-3 rounded-xl text-sm font-bold border-2 transition-all ${decision === 'upheld' ? 'bg-red-50 border-red-400 text-red-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              <ExclamationIcon className="w-5 h-5 mx-auto mb-1" />
              Uphold Appeal
              <p className="text-[10px] font-normal mt-0.5">Award overturned. Contract blocked.</p>
            </button>
          </div>
        </div>

        {decision === 'upheld' && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Required Procurement Action *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUpheldAction('reopen_evaluation')}
                className={`p-3 rounded-xl text-xs font-bold border-2 transition-all text-left flex flex-col justify-between ${upheldAction === 'reopen_evaluation' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                <span>Re-evaluate Bids</span>
                <span className="text-[9px] font-normal mt-1 text-gray-500">Reset solicitation phase to evaluation and cancel current contract.</span>
              </button>
              <button
                type="button"
                onClick={() => setUpheldAction('cancel_procurement')}
                className={`p-3 rounded-xl text-xs font-bold border-2 transition-all text-left flex flex-col justify-between ${upheldAction === 'cancel_procurement' ? 'bg-red-50 border-red-400 text-red-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                <span>Cancel Procurement</span>
                <span className="text-[9px] font-normal mt-1 text-gray-500">Cancel the solicitation completely and cancel the contract.</span>
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Decision Letter PDF <span className="text-gray-400 font-normal">(optional)</span></label>
          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <PaperClipIcon className="w-4 h-4 text-gray-400 mr-2" />
              <span className="text-sm text-gray-600">{decisionLetterFile ? decisionLetterFile.name : 'Click to upload PDF'}</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setDecisionLetterFile(e.target.files?.[0] || null)}
              />
            </label>
            {decisionLetterFile && (
              <button
                onClick={() => setDecisionLetterFile(null)}
                className="text-xs text-red-500 hover:text-red-700 font-semibold"
              >Remove</button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Resolution Notes * <span className="text-gray-400 font-normal">(mandatory, stored in audit trail)</span></label>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={4}
            placeholder="Provide detailed reasoning for the decision, referencing relevant ZPPA regulations or evaluation criteria..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {decision === 'upheld' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 font-medium">
            {upheldAction === 'reopen_evaluation' 
              ? 'Upholding this appeal with bid re-evaluation will cancel the existing contract and notify the evaluation committee chairperson.' 
              : 'Upholding this appeal with cancellation will cancel both the solicitation and contract, and notify all bidders.'}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!resolution.trim() || mutation.isPending}
            className={`px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 ${decision === 'upheld' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {mutation.isPending ? 'Saving...' : decision === 'upheld' ? 'Uphold Appeal' : 'Dismiss Appeal'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────────── */
const AwardAppealManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSupplier = user?.role === 'supplier_user';
  const isResolver = RESOLVER_ROLES.includes(user?.role || '');
  const isInternalOfficer = OFFICER_ROLES.includes(user?.role || '');

  const [showFileModal, setShowFileModal] = useState(false);
  const [fileModalDefaults, setFileModalDefaults] = useState<{ solId: string; bidId: string }>({ solId: '', bidId: '' });
  const [resolveModal, setResolveModal] = useState<{ open: boolean; appeal: any }>({ open: false, appeal: null });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open File Appeal modal when navigated from BidDetail with query params
  useEffect(() => {
    const solParam = searchParams.get('solicitation');
    const bidParam = searchParams.get('bidder');
    if (isSupplier && (solParam || bidParam)) {
      setFileModalDefaults({ solId: solParam || '', bidId: bidParam || '' });
      setShowFileModal(true);
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: appealsData, isLoading } = useQuery({
    queryKey: ['award-appeals'],
    queryFn: () => evaluationsApi.listAppeals({ page_size: 100 }),
    refetchInterval: 30_000,
  });

  const takeUnderReviewMutation = useMutation({
    mutationFn: (id: string) => evaluationsApi.updateAppeal(id, { status: 'under_review' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      toast.success('Appeal is now under review');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update appeal'),
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => evaluationsApi.withdrawAppeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award-appeals'] });
      toast.success('Appeal withdrawn');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to withdraw appeal'),
  });

  if (isLoading) return <LoadingSpinner />;

  const appeals: any[] = appealsData?.results || [];
  const activeAppeals = appeals.filter((a) => ['filed', 'under_review'].includes(a.status));
  const overdueAppeals = appeals.filter((a) => a.is_overdue);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Award Appeals</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSupplier
              ? 'File an appeal if you believe the award decision was incorrect. You have 14 days from the award notification.'
              : 'Manage award appeals in accordance with ZPPA procurement regulations.'}
          </p>
        </div>
        {isSupplier && (
          <button
            onClick={() => setShowFileModal(true)}
            className="px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 flex items-center gap-2 shadow-sm"
          >
            <ExclamationIcon className="w-4 h-4" /> File Appeal
          </button>
        )}
      </div>

      {/* Internal summary stats */}
      {isInternalOfficer && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Appeals', value: activeAppeals.length, color: 'amber' },
            { label: 'Overdue', value: overdueAppeals.length, color: overdueAppeals.length > 0 ? 'red' : 'gray' },
            { label: 'Filed (Pending Review)', value: activeAppeals.filter(a => a.status === 'filed').length, color: 'yellow' },
            { label: 'Total Filed', value: appeals.length, color: 'blue' },
          ].map((stat) => (
            <div key={stat.label} className={`bg-white rounded-xl border p-4 ${stat.color === 'red' && stat.value > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
              <p className="text-2xl font-black text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Appeals list */}
      {appeals.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <ExclamationIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-semibold">No appeals filed</p>
          <p className="text-sm text-gray-400 mt-1">
            {isSupplier ? 'You have not filed any award appeals.' : 'No award appeals have been filed yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appeals.map((appeal) => {
            const isExpanded = expandedId === appeal.id;
            const isActive = ['filed', 'under_review'].includes(appeal.status);
            return (
              <div
                key={appeal.id}
                className={`bg-white border rounded-xl overflow-hidden transition-shadow ${appeal.is_overdue ? 'border-red-300 shadow-red-100 shadow-md' : 'border-gray-200 hover:shadow-sm'}`}
              >
                {/* Card header */}
                <div
                  className="p-4 cursor-pointer flex items-center justify-between gap-4"
                  onClick={() => setExpandedId(isExpanded ? null : appeal.id)}
                >
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <StatusPill status={appeal.status} />
                    <UrgencyBadge days={appeal.days_remaining} status={appeal.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {appeal.solicitation_number} — {appeal.bidder_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {appeal.ground_label} · Filed {new Date(appeal.filed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Internal actions */}
                    {isInternalOfficer && appeal.status === 'filed' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); takeUnderReviewMutation.mutate(appeal.id); }}
                        disabled={takeUnderReviewMutation.isPending}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
                      >
                        <EyeIcon className="w-3.5 h-3.5" />
                        Take Under Review
                      </button>
                    )}
                    {isResolver && appeal.status === 'under_review' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setResolveModal({ open: true, appeal }); }}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1.5"
                      >
                        <ShieldCheckIcon className="w-3.5 h-3.5" />
                        Resolve
                      </button>
                    )}
                    {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                    {/* Supplier timeline */}
                    {isSupplier && <AppealTimeline status={appeal.status} />}

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Solicitation</p>
                        <p className="font-semibold text-gray-900 mt-0.5">{appeal.solicitation_number}</p>
                        <p className="text-xs text-gray-500 truncate">{appeal.solicitation_title}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Filed By</p>
                        <p className="font-semibold text-gray-900 mt-0.5">{appeal.filed_by_name || '—'}</p>
                        <p className="text-xs text-gray-500">{new Date(appeal.filed_at).toLocaleDateString()}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Resolution Deadline</p>
                        <p className={`font-semibold mt-0.5 ${appeal.is_overdue ? 'text-red-600' : 'text-gray-900'}`}>
                          {appeal.resolution_deadline
                            ? new Date(appeal.resolution_deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '14 days from filing'}
                        </p>
                        {appeal.days_remaining !== null && isActive && (
                          <p className={`text-xs font-semibold ${appeal.days_remaining < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                            {appeal.days_remaining < 0 ? `${Math.abs(appeal.days_remaining)} day(s) overdue` : `${appeal.days_remaining} day(s) remaining`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Grounds: {appeal.ground_label}</p>
                      <p className="text-sm text-gray-700">{appeal.grounds_detail || 'No detailed explanation provided.'}</p>
                    </div>

                    {appeal.resolution && (
                      <div className={`border rounded-lg p-3 ${appeal.status === 'upheld' ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${appeal.status === 'upheld' ? 'text-red-800' : 'text-emerald-800'}`}>
                              Resolution ({appeal.status}) — by {appeal.resolved_by_name || 'Unknown'} on {appeal.resolved_at ? new Date(appeal.resolved_at).toLocaleDateString() : '—'}
                            </p>
                            <p className="text-sm text-gray-800">{appeal.resolution}</p>
                          </div>
                          {appeal.decision_letter && (
                            <a
                              href={appeal.decision_letter.startsWith('http') ? appeal.decision_letter : `${window.location.origin}${appeal.decision_letter}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border shadow-sm transition-all shrink-0 mt-2 sm:mt-0 ${
                                appeal.status === 'upheld'
                                  ? 'bg-white border-red-200 text-red-700 hover:bg-red-50'
                                  : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              <DocumentTextIcon className="w-3.5 h-3.5" /> View Decision Letter
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Supplier: clarification response panel */}
                    {isSupplier && isActive && (
                      <SupplierClarificationPanel appeal={appeal} />
                    )}

                    {/* Internal: review panel */}
                    {isInternalOfficer && isActive && (
                      <InternalReviewPanel appeal={appeal} isResolver={isResolver} />
                    )}

                    {/* Evidence viewer for internal staff */}
                    {isInternalOfficer && (
                      <EvidenceViewer appealId={appeal.id} />
                    )}

                    {/* Action history for all users */}
                    <ActionHistory appealId={appeal.id} />

                    {/* Supplier: withdraw button */}
                    {isSupplier && isActive && (
                      <button
                        onClick={() => withdrawMutation.mutate(appeal.id)}
                        disabled={withdrawMutation.isPending}
                        className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-100"
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

      {showFileModal && <FileAppealModal
        initialSolId={fileModalDefaults.solId}
        initialBidId={fileModalDefaults.bidId}
        onClose={() => { setShowFileModal(false); setFileModalDefaults({ solId: '', bidId: '' }); }}
      />}
      {resolveModal.open && resolveModal.appeal && (
        <ResolveModal appeal={resolveModal.appeal} onClose={() => setResolveModal({ open: false, appeal: null })} />
      )}
    </div>
  );
};

export default AwardAppealManagement;

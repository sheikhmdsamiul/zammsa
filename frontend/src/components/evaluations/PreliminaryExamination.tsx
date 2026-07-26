import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { bidsApi } from '../../api/bids';
import { solicitationsApi } from '../../api/solicitations';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EvaluationCriterion } from '../../types';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, DocumentSearchIcon,
  ShieldCheckIcon, InformationCircleIcon, UserGroupIcon,
  ChevronDownIcon, ChevronUpIcon, CurrencyDollarIcon,
  DocumentTextIcon, ExternalLinkIcon, CheckIcon,
} from '@heroicons/react/outline';

interface CheckState {
  criterion: string;
  passed: boolean;
  examId?: string;
}

interface BidExamState {
  bidId: string;
  bidderName: string;
  checks: CheckState[];
  notes: string;
}

const BidInfoPanel: React.FC<{ bid: any }> = ({ bid }) => {
  const { data: fullBid, isLoading } = useQuery({
    queryKey: ['bid-detail', bid.bid_id || bid.id],
    queryFn: () => bidsApi.get(bid.bid_id || bid.id),
    enabled: true,
  });

  const bidData = fullBid || bid;
  const lineItems: any[] = bidData.line_items || [];
  const documents: any[] = bidData.documents || bidData.bid_documents || [];

  return (
    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 space-y-4">
      {isLoading && <LoadingSpinner className="py-4" />}

      {!isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Bid Price</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {bidData.bid_amount != null
                  ? `${bidData.currency || 'ZMW'} ${Number(bidData.bid_amount).toLocaleString()}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Submission</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{bidData.submission_id || bidData.bid_number || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Status</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{bidData.status || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Submitted</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {bidData.submitted_at ? new Date(bidData.submitted_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>

          {lineItems.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-2">Line Items</p>
              <div className="border border-blue-100 rounded-lg overflow-hidden">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-blue-100/50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">Item</th>
                      <th className="px-2 py-1 text-left font-medium text-gray-600">Description</th>
                      <th className="px-2 py-1 text-right font-medium text-gray-600">Qty</th>
                      <th className="px-2 py-1 text-right font-medium text-gray-600">Unit Price</th>
                      <th className="px-2 py-1 text-right font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100">
                    {lineItems.map((item: any, idx: number) => (
                      <tr key={idx} className="bg-white/60">
                        <td className="px-2 py-1.5 font-medium text-gray-900">{item.item_code || idx + 1}</td>
                        <td className="px-2 py-1 text-gray-700">{item.description || '—'}</td>
                        <td className="px-2 py-1 text-right text-gray-700">{item.quantity || 0}</td>
                        <td className="px-2 py-1 text-right text-gray-700">
                          {item.unit_price != null ? Number(item.unit_price).toLocaleString() : '—'}
                        </td>
                        <td className="px-2 py-1 text-right font-medium text-gray-900">
                          {item.total_price != null ? Number(item.total_price).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {documents.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-2">Attached Documents</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {documents.map((doc: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-blue-100">
                    <DocumentTextIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-900 truncate">
                        {doc.document_type || doc.name || `Document ${idx + 1}`}
                      </p>
                      {doc.uploaded_at && (
                        <p className="text-[10px] text-gray-400">
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                     {doc.file_url && (
                       <a
                         href={doc.file_url}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="shrink-0 text-blue-600 hover:text-blue-800"
                       >
                         <ExternalLinkIcon className="w-3.5 h-3.5" />
                       </a>
                     )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {lineItems.length === 0 && documents.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No line items or documents on file</p>
          )}
        </>
      )}
    </div>
  );
};

const PreliminaryExamination: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const myId = String(user?.id || '');

  const [exams, setExams] = useState<Record<string, BidExamState>>({});
  const [allCompleted, setAllCompleted] = useState(false);
  const [expandedBidId, setExpandedBidId] = useState<string | null>(null);
  const [savingChecks, setSavingChecks] = useState<Set<string>>(new Set());

  const { data: solicitation, isLoading: solLoading } = useQuery({
    queryKey: ['solicitation', solId],
    queryFn: () => solicitationsApi.get(solId!),
    enabled: !!solId,
  });

  const { data: bidsData, isLoading: bidsLoading } = useQuery({
    queryKey: ['bids-for-examination', solId],
    queryFn: () => bidsApi.list({ solicitation: solId!, page_size: 50 }),
    enabled: !!solId,
  });

  const { data: existingExams } = useQuery({
    queryKey: ['preliminary-exams', solId],
    queryFn: () => evaluationsApi.listPreliminaryExams({ page_size: 200 }),
    enabled: !!solId,
  });

  const { data: committeesData } = useQuery({
    queryKey: ['committees-for-prelim', solId],
    queryFn: () => evaluationsApi.listCommittees({ solicitation: solId, page_size: 5 }),
    enabled: !!solId,
  });

  const { data: phaseStatus } = useQuery({
    queryKey: ['phase-status', solId],
    queryFn: () => evaluationsApi.getPhaseStatus(solId!),
    enabled: !!solId,
  });

  const primaryCommittee = (committeesData?.results || [])[0];
  const bids = bidsData?.results || [];
  const existingExamList: any[] = existingExams?.results || [];
  const memberProgress: any[] = phaseStatus?.phases?.preliminary?.member_progress || [];

  const mandatoryCriteria: EvaluationCriterion[] = useMemo(() => {
    return (solicitation?.evaluation_criteria || []).filter(
      (c: EvaluationCriterion) => c.criterion_type === 'mandatory'
    );
  }, [solicitation]);

  const myExams = useMemo(() => {
    return existingExamList.filter((e: any) => String(e.evaluated_by) === myId);
  }, [existingExamList, myId]);

  const saveExamMutation = useMutation({
    mutationFn: (data: { bid: string; criterion: string; is_compliant: boolean; comment?: string }) =>
      evaluationsApi.savePreliminaryExam(data),
    onError: () => toast.error('Failed to save exam result'),
  });

  const updateExamMutation = useMutation({
    mutationFn: ({ examId, data }: { examId: string; data: { is_compliant: boolean; comment?: string } }) =>
      evaluationsApi.updatePreliminaryExam(examId, data),
    onError: () => toast.error('Failed to update exam result'),
  });

  const saveCheck = async (bidId: string, idx: number) => {
    const exam = exams[bidId];
    if (!exam) return;
    const check = exam.checks[idx];
    if (!check) return;

    const key = `${bidId}:${idx}`;
    setSavingChecks(prev => new Set(prev).add(key));

    try {
      if (check.examId) {
        await updateExamMutation.mutateAsync({
          examId: check.examId,
          data: { is_compliant: check.passed },
        });
      } else {
        const created = await saveExamMutation.mutateAsync({
          bid: bidId,
          criterion: check.criterion,
          is_compliant: check.passed,
          comment: exam.notes || undefined,
        });
        const newExamId = created.exam_id || created.id;
        if (newExamId) {
          setExams(prev => {
            const currentExam = prev[bidId];
            if (!currentExam) return prev;
            const newChecks = [...currentExam.checks];
            newChecks[idx] = { ...newChecks[idx], examId: newExamId };
            return { ...prev, [bidId]: { ...currentExam, checks: newChecks }};
          });
        }
      }
    } catch {
      // mutations already show toast on error
    } finally {
      setSavingChecks(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const initExamination = (bid: any) => {
    const bidId = bid.bid_id || bid.id;
    if (exams[bidId]) return;

    const existingForBid = myExams.filter((e: any) => e.bid === bidId);
    const checks: CheckState[] = mandatoryCriteria.map((c) => {
      const match = existingForBid.find((e: any) => e.criterion === c.criterion_name);
      return {
        criterion: c.criterion_name,
        passed: match ? match.is_compliant : false,
        examId: match ? match.exam_id || match.id : undefined,
      };
    });

    setExams(prev => ({
      ...prev,
      [bidId]: {
        bidId,
        bidderName: bid.supplier_name || bid.bidder_name || 'Unknown',
        checks,
        notes: existingForBid.find((e: any) => e.comment)?.comment || '',
      },
    }));
  };

  const toggleCheck = (bidId: string, checkIdx: number) => {
    setExams(prev => {
      const exam = prev[bidId];
      if (!exam) return prev;
      const updatedChecks = exam.checks.map((c, i) =>
        i === checkIdx ? { ...c, passed: !c.passed } : c
      );
      return { ...prev, [bidId]: { ...exam, checks: updatedChecks } };
    });
  };

  const persistChecks = (bidId: string) => {
    const exam = exams[bidId];
    if (!exam) return;
    for (let i = 0; i < exam.checks.length; i++) {
      const check = exam.checks[i];
      if (check.examId) {
        evaluationsApi.updatePreliminaryExam(check.examId, { is_compliant: check.passed });
      } else {
        saveExamMutation.mutate({
          bid: bidId,
          criterion: check.criterion,
          is_compliant: check.passed,
          comment: exam.notes || undefined,
        });
      }
    }
  };

  if (solLoading || bidsLoading) return <LoadingSpinner className="py-12" />;

  const examList = Object.values(exams);
  const myExaminedBids = examList.filter(e => e.checks.length > 0 && e.checks.every(c => c.passed)).length;
  const myAllExamined = bids.length > 0 && bids.every((b: any) => {
    const e = exams[b.bid_id || b.id];
    return e && e.checks.length > 0 && e.checks.every(c => c.passed);
  });
  const allMembersComplete = memberProgress.length > 0 && memberProgress.every((m: any) => m.complete);

  const completedCount = memberProgress.filter((m: any) => m.complete).length;
  const totalMembers = memberProgress.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(primaryCommittee ? `/evaluations/${primaryCommittee.id}` : '/evaluations')}
            className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center gap-1 transition-colors"
          >
            ← Back to Evaluation Committee
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Preliminary Examination</h1>
            <StatusBadge status={allMembersComplete ? 'completed' : 'active'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{solId} | Each committee member must individually examine all bids</p>
        </div>
        {!allCompleted && bids.length > 0 && examList.length < bids.length && (
          <button onClick={() => bids.forEach((b: any) => initExamination(b))}
            className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold">
            Initialize All Bids (My Exams)
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <UserGroupIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Member Completion Progress</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Every committee member must individually examine all {bids.length} bid(s) before the preliminary phase can be marked complete.
        </p>
        {memberProgress.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {memberProgress.map((m: any) => (
              <div key={m.member_id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                m.complete ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
              }`}>
                {m.complete ? (
                  <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-gray-300 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {m.name || m.member_id}
                    {String(m.member_id) === myId && (
                      <span className="ml-1 text-[10px] text-blue-600 font-normal">(You)</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500 capitalize">{m.role?.replace('_', ' ')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-bold ${m.complete ? 'text-emerald-600' : 'text-gray-600'}`}>
                    {m.bids_examined}/{m.total_bids}
                  </p>
                  <p className="text-[10px] text-gray-400">bids examined</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">No committee members found</p>
        )}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>{completedCount} of {totalMembers} members completed</span>
          <div className="w-32 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${totalMembers > 0 ? (completedCount / totalMembers) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Total Bids</p>
          <p className="text-2xl font-bold text-gray-900">{bids.length}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">My Examined</p>
          <p className="text-2xl font-bold text-zammsa-green">{myExaminedBids}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">My Remaining</p>
          <p className="text-2xl font-bold text-amber-600">{bids.length - myExaminedBids}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Members Done</p>
          <p className="text-2xl font-bold text-blue-600">{completedCount}/{totalMembers}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          <DocumentSearchIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
          Your Examination Checklist
        </h2>
        <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
          <InformationCircleIcon className="w-3.5 h-3.5" />
          {mandatoryCriteria.length} mandatory criteria — each must PASS for the bid to proceed. You must examine all bids individually.
        </p>

        <div className="space-y-4">
          {bids.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No bids received for this solicitation</p>
          )}

          {bids.map((bid: any) => {
            const bidId = bid.bid_id || bid.id;
            const exam = exams[bidId];
            const isExpanded = expandedBidId === bidId;

            if (!exam) {
              return (
                <div key={bidId} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{bid.supplier_name || bid.bidder_name || 'Unknown'}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                        {bid.submission_id && <span>{bid.submission_id}</span>}
                        {bid.bid_amount != null && (
                          <span className="flex items-center gap-1">
                            <CurrencyDollarIcon className="w-3 h-3" />
                            {bid.currency || 'ZMW'} {Number(bid.bid_amount).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExpandedBidId(isExpanded ? null : bidId)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 flex items-center gap-1">
                        {isExpanded ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                        Bid Info
                      </button>
                      <button onClick={() => initExamination(bid)}
                        className="px-3 py-1.5 bg-zammsa-green text-white text-xs rounded-lg">
                        Examine
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-3">
                      <BidInfoPanel bid={bid} />
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={bidId} className="p-5 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{exam.bidderName}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                      {bid.submission_id && <span>{bid.submission_id}</span>}
                      {bid.bid_amount != null && (
                        <span className="flex items-center gap-1">
                          <CurrencyDollarIcon className="w-3 h-3" />
                          {bid.currency || 'ZMW'} {Number(bid.bid_amount).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedBidId(isExpanded ? null : bidId)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 flex items-center gap-1">
                      {isExpanded ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                      Bid Info
                    </button>
                    <StatusBadge status={
                      exam.checks.length > 0 && exam.checks.every(c => c.passed) ? 'approved' : 'draft'
                    } />
                  </div>
                </div>

                {isExpanded && (
                  <div className="mb-4">
                    <BidInfoPanel bid={bid} />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {exam.checks.map((check, idx) => {
                    const criterionMeta = mandatoryCriteria.find(c => c.criterion_name === check.criterion);
                    const isSaving = savingChecks.has(`${bidId}:${idx}`);
                    return (
                      <div key={idx} onClick={() => !isSaving && toggleCheck(bidId, idx)} className={`p-3 rounded-xl text-left border transition-all ${check.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'} cursor-pointer`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">{check.criterion}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); saveCheck(bidId, idx); }} disabled={isSaving} title={check.examId ? 'Update result' : 'Save result'} className={`text-emerald-600 hover:text-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed`}>
                              {isSaving ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <CheckIcon className="w-4 h-4" />
                              )}
                            </button>
                            {check.passed
                              ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                              : <XCircleIcon className="w-4 h-4 text-gray-300" />
                            }
                          </div>
                        </div>
                        {criterionMeta?.scoring_guidance && (
                          <p className="text-[10px] text-gray-400 mt-1">{criterionMeta.scoring_guidance}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input value={exam.notes} onChange={(e) => setExams(prev => ({
                    ...prev, [bidId]: { ...prev[bidId], notes: e.target.value }
                  }))} placeholder="Examination notes..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                  <button onClick={() => persistChecks(bidId)}
                    className="px-3 py-2 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100">
                    Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {myAllExamined && !allCompleted && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-900">Your examination is complete</p>
            <p className="text-xs text-blue-700">
              You have examined all {bids.length} bids. Waiting for other members to complete their individual examinations.
            </p>
          </div>
          <button onClick={() => {
            bids.forEach((b: any) => persistChecks(b.bid_id || b.id));
            setAllCompleted(true);
            toast.success('Your preliminary examination has been saved');
          }}
            className="px-5 py-2.5 bg-zammsa-green text-white rounded-lg text-sm font-bold shrink-0 ml-4">
            Mark My Examination Complete
          </button>
        </div>
      )}

      {allCompleted && !allMembersComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <ShieldCheckIcon className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-amber-800 mb-2">Your Examination Submitted</h2>
          <p className="text-sm text-amber-600 mb-1">
            You have examined all {bids.length} bids ({myExaminedBids} passed).
          </p>
          <p className="text-xs text-amber-500">
            Waiting for {totalMembers - completedCount} more member(s) to complete their individual examinations.
          </p>
        </div>
      )}

      {allMembersComplete && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <ShieldCheckIcon className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-emerald-800 mb-2">Preliminary Examination Complete</h2>
          <p className="text-sm text-emerald-600 mb-4">
            All {totalMembers} committee members have individually examined all {bids.length} bids.
          </p>
          <button onClick={() => navigate(primaryCommittee ? `/evaluations/${primaryCommittee.id}/scoring` : `/evaluations`)}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold">
            Proceed to Technical Evaluation
          </button>
        </div>
      )}
    </div>
  );
};

export default PreliminaryExamination;

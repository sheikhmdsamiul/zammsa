import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { bidsApi } from '../../api/bids';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { EvaluationCriterion } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, ArrowLeftIcon, ArrowRightIcon, XCircleIcon,
  ChevronDownIcon, ChevronUpIcon, CurrencyDollarIcon,
  DocumentTextIcon, ExternalLinkIcon, InformationCircleIcon,
} from '@heroicons/react/outline';

const BidInfoPanel: React.FC<{ bidId: string }> = ({ bidId }) => {
  const { data: fullBid, isLoading } = useQuery({
    queryKey: ['bid-detail-tech', bidId],
    queryFn: () => bidsApi.get(bidId),
    enabled: !!bidId,
  });

  if (isLoading) return <LoadingSpinner className="py-4" />;
  if (!fullBid) return null;

  const lineItems: any[] = fullBid.line_items || [];
  const documents: any[] = fullBid.documents || [];

  return (
    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Bid Price</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">
            {fullBid.bid_amount != null
              ? `${fullBid.currency || 'ZMW'} ${Number(fullBid.bid_amount).toLocaleString()}`
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Submission ID</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{fullBid.submission_id || fullBid.bid_number || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Status</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5 capitalize">{fullBid.status || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Submitted</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">
            {fullBid.submitted_at ? new Date(fullBid.submitted_at).toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      {lineItems.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-2">Line Items ({lineItems.length})</p>
          <div className="border border-blue-100 rounded-lg overflow-hidden">
            <table className="min-w-full text-[11px]">
              <thead className="bg-blue-100/50">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-medium text-gray-600">Item</th>
                  <th className="px-2.5 py-1.5 text-left font-medium text-gray-600">Description</th>
                  <th className="px-2.5 py-1.5 text-right font-medium text-gray-600">Qty</th>
                  <th className="px-2.5 py-1.5 text-right font-medium text-gray-600">Unit Price</th>
                  <th className="px-2.5 py-1.5 text-right font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {lineItems.map((item: any, idx: number) => (
                  <tr key={idx} className="bg-white/60">
                    <td className="px-2.5 py-1.5 font-medium text-gray-900">{item.item_code || idx + 1}</td>
                    <td className="px-2.5 py-1.5 text-gray-700 max-w-xs truncate">{item.description || '—'}</td>
                    <td className="px-2.5 py-1.5 text-right text-gray-700">{item.quantity || 0}</td>
                    <td className="px-2.5 py-1.5 text-right text-gray-700">
                      {item.unit_price != null ? Number(item.unit_price).toLocaleString() : '—'}
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-medium text-gray-900">
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
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-2">Attached Documents ({documents.length})</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {documents.map((doc: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-blue-100">
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
    </div>
  );
};

const TechnicalScoring: React.FC = () => {
  const { committeeId } = useParams<{ committeeId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentBidIndex, setCurrentBidIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, Record<string, { score: number; comment: string }>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [allSubmitted, setAllSubmitted] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [showBidInfo, setShowBidInfo] = useState(false);

  const { data: committee, isLoading: committeeLoading } = useQuery({
    queryKey: ['evaluation-committee', committeeId],
    queryFn: () => evaluationsApi.getCommittee(committeeId!),
    enabled: !!committeeId,
  });

  const { data: coiState } = useQuery({
    queryKey: ['coi-committee', committeeId],
    queryFn: () => evaluationsApi.getCOI(committeeId!),
    enabled: !!committeeId,
  });

  const { data: solicitation, isLoading: solicitationLoading } = useQuery({
    queryKey: ['solicitation-detail', committee?.solicitation],
    queryFn: () => solicitationsApi.get(committee!.solicitation),
    enabled: !!committee?.solicitation,
  });

  const { data: bidsData, isLoading: bidsLoading } = useQuery({
    queryKey: ['bids-for-eval', committee?.solicitation],
    queryFn: () => bidsApi.list({ solicitation: committee!.solicitation, page_size: 50 }),
    enabled: !!committee?.solicitation,
  });

  const criteria: EvaluationCriterion[] = (solicitation?.evaluation_criteria || []).filter(
    (c: EvaluationCriterion) => c.criterion_type === 'technical'
  );

  const bidList = bidsData?.results || [];
  const currentBid = bidList[currentBidIndex];
  const currentScores = scores[currentBid?.id] || {};

  const scoredCount = bidList.filter((bid: any) => {
    const s = scores[bid.id];
    return s && criteria.length > 0 && criteria.every((c) => s[c.id] !== undefined);
  }).length;

  const allBidsScored = bidList.length > 0 && scoredCount === bidList.length;

  const committeeMemberIds = useMemo(() => {
    const ids = new Set<string>();
    if (!committee) return ids;
    ids.add(String(committee.chairperson || ''));
    ids.add(String(committee.secretary || ''));
    (committee.members || []).forEach((m: any) => {
      const uid = typeof m === 'object' && m !== null ? (m.user || m.id) : m;
      if (uid) ids.add(String(uid));
    });
    (committee.non_official_members || []).forEach((nom: any) => {
      if (nom?.user_id) ids.add(String(nom.user_id));
    });
    return ids;
  }, [committee]);

  const isCommitteeMember = committee ? committeeMemberIds.has(String(user?.id || '')) : false;
  const isRecused = Boolean(coiState?.recused_members?.includes(String(user?.id || '')));

  useEffect(() => {
    if (!bidList.length || !criteria.length) return;
    const fetchExistingScores = async () => {
      setLoadingScores(true);
      const results = await Promise.allSettled(
        bidList.map((bid: any) =>
          evaluationsApi.getMyScores(bid.id).then(data => ({ bidId: bid.id, data }))
        )
      );
      const newScores = { ...scores };
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const { bidId, data } = r.value;
          if (!data?.my_scores?.length) continue;
          for (const s of data.my_scores) {
            if (!s.criterion) continue;
            const criterionId = s.criterion;
            const c = criteria.find((crt: EvaluationCriterion) => crt.id === criterionId);
            if (!c) continue;
            newScores[bidId] = newScores[bidId] || {};
            newScores[bidId][criterionId] = {
              score: Number(s.raw_score),
              comment: s.comment || '',
            };
          }
        }
      }
      setScores(newScores);
      setLoadingScores(false);
    };
    fetchExistingScores();
  }, [bidList.length, criteria.length]);

  const getWeightedTotal = (bidId: string) => {
    const s = scores[bidId] || {};
    let total = 0;
    criteria.forEach((c) => {
      const entry = s[c.id];
      if (entry && entry.score > 0) total += entry.score * (c.weight / 100);
    });
    return total;
  };

  const updateScore = (bidId: string, criterionId: string, field: 'score' | 'comment', value: string | number) => {
    setScores(prev => ({
      ...prev,
      [bidId]: {
        ...(prev[bidId] || {}),
        [criterionId]: {
          ...((prev[bidId] || {})[criterionId] || { score: 0, comment: '' }),
          [field]: value,
        },
      },
    }));
  };

  const submitScoresForCurrent = async () => {
    setSubmitting(true);
    let submitted = 0;
    let skipped = 0;
    try {
      for (const c of criteria) {
        const entry = currentScores[c.id];
        if (!entry || !(entry.score > 0)) continue;
        try {
          await evaluationsApi.submitScores({
            bid_id: currentBid.id,
            criterion_id: c.id,
            raw_score: entry.score,
            comment: entry.comment,
          });
          submitted++;
        } catch (err: any) {
          if (err?.response?.data?.error?.includes('already scored')) {
            skipped++;
          } else {
            throw err;
          }
        }
      }
      const name = currentBid.vendor_name || currentBid.id;
      if (submitted > 0) toast.success(`${submitted} score(s) submitted for ${name}`);
      if (skipped > 0) toast(`${skipped} criterion/criteria already scored — skipped`, { icon: 'ℹ️' });
      queryClient.invalidateQueries({ queryKey: ['solicitation-bids'] });
      if (currentBidIndex < bidList.length - 1) {
        setCurrentBidIndex(i => i + 1);
      }
    } catch {
      toast.error('Failed to submit scores');
    }
    setSubmitting(false);
  };

  const submitAllScores = async () => {
    setSubmitting(true);
    let allSuccess = true;
    for (let i = 0; i < bidList.length; i++) {
      const bid = bidList[i];
      const bidScores = scores[bid.id] || {};
      for (const c of criteria) {
        const entry = bidScores[c.id];
        if (!entry || !(entry.score > 0)) continue;
        try {
          await evaluationsApi.submitScores({
            bid_id: bid.id,
            criterion_id: c.id,
            raw_score: entry.score,
            comment: entry.comment,
          });
        } catch (err: any) {
          if (err?.response?.data?.error?.includes('already scored')) continue;
          allSuccess = false;
        }
      }
    }
    if (allSuccess) {
      toast.success('All scores submitted successfully');
      setAllSubmitted(true);
      setShowConfirmSubmit(false);
    } else {
      toast.error('Some scores could not be submitted');
    }
    setSubmitting(false);
  };

  const goToBid = (index: number) => {
    if (index >= 0 && index < bidList.length) {
      setCurrentBidIndex(index);
      setShowBidInfo(false);
    }
  };

  if (committeeLoading || solicitationLoading || bidsLoading || loadingScores) {
    return <LoadingSpinner className="py-12" />;
  }

  if (!committeeId) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-gray-500">No committee selected.</p>
      </div>
    );
  }

  if (!criteria.length) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-gray-500">No technical evaluation criteria defined for this solicitation.</p>
      </div>
    );
  }

  if (!isCommitteeMember) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-500">
            This technical scoring workspace is only available to assigned evaluation committee members.
          </p>
        </div>
      </div>
    );
  }

  if (isRecused) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <XCircleIcon className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Recused From Evaluation</h2>
          <p className="text-gray-500">
            You have been recused due to a declared conflict of interest and cannot participate in scoring.
          </p>
        </div>
      </div>
    );
  }

  if (allSubmitted) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
          <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">All Scores Submitted</h2>
          <p className="text-gray-500 mb-2">Your independent evaluation has been recorded. Scores are private until all members submit.</p>
          <p className="text-sm text-amber-600 mb-6 font-medium">Waiting for other members to complete scoring</p>

          <div className="max-w-lg mx-auto space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-gray-900">Your Scores Summary</h3>
            {bidList.map((bid: any) => {
              const wt = getWeightedTotal(bid.id);
              return (
                <div key={bid.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <span className="font-medium text-gray-900">{bid.vendor_name || bid.id}</span>
                    {bid.bid_amount != null && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {bid.currency || 'ZMW'} {Number(bid.bid_amount).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-zammsa-green">{wt.toFixed(1)} / 100</span>
                    <span className={`ml-2 text-xs font-medium ${wt >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {wt >= 70 ? '✅ Passes' : '🔴 Below threshold'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => navigate(`/evaluations/${committeeId}`)}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold"
          >
            Back to Evaluation Committee
          </button>
        </div>
      </div>
    );
  }

  if (!bidList.length) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-gray-500">No bids found for this solicitation.</p>
      </div>
    );
  }

  const currentWeightedTotal = getWeightedTotal(currentBid?.id);
  const threshold = solicitation?.minimum_technical_threshold || 70;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(`/evaluations/${committeeId}`)}
            className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center gap-1 transition-colors"
          >
            ← Back to Evaluation Committee
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Technical Evaluation</h1>
            <StatusBadge status="active" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {solicitation?.sol_number || committee?.solicitation_number || ''} — {solicitation?.title || committee?.solicitation_title || ''}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Evaluator: {user?.full_name} &nbsp;|&nbsp; Role: {user?.role === ROLES.EVALUATION_COMMITTEE_CHAIR ? 'Chair' : 'Member'}
          </p>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Privacy Notice</p>
            <p className="text-xs text-blue-700">
              Your scores are private and visible only to you until all committee members submit their evaluations.
              After submission, scores become visible to the committee chair for consolidation.
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Your Progress</span>
            <span className="text-sm font-bold text-zammsa-green">{scoredCount} of {bidList.length} bids scored</span>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-zammsa-green h-3 rounded-full transition-all duration-500"
            style={{ width: `${(scoredCount / Math.max(bidList.length, 1)) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">You must score ALL bids before submitting</p>
      </div>

      {/* Main Content: Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Bid Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sticky top-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Bids ({bidList.length})</h2>
            <div className="space-y-2">
              {bidList.map((bid: any, i: number) => {
                const isScored = scores[bid.id] && criteria.length > 0 && criteria.every((c) => (scores[bid.id]?.[c.id]?.score || 0) > 0);
                const isActive = i === currentBidIndex;
                const wt = getWeightedTotal(bid.id);
                return (
                  <button
                    key={bid.id}
                    onClick={() => goToBid(i)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-zammsa-green/5 border-zammsa-green ring-1 ring-zammsa-green/20'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${isActive ? 'text-zammsa-green' : 'text-gray-900'}`}>
                        {bid.vendor_name || 'Unknown'}
                      </span>
                      {isScored ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      {bid.bid_amount != null ? (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <CurrencyDollarIcon className="w-3 h-3" />
                          {bid.currency || 'ZMW'} {Number(bid.bid_amount).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                      {wt > 0 && (
                        <span className={`text-[11px] font-medium ${wt >= threshold ? 'text-emerald-600' : 'text-red-600'}`}>
                          {wt.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Scoring Area */}
        <div className="lg:col-span-2 space-y-5">
          {currentBid && (
            <>
              {/* Current Bid Header */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {currentBid.vendor_name || 'Unknown Bidder'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {currentBid.submission_id || currentBid.bid_number || `Bid ${currentBidIndex + 1} of ${bidList.length}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {currentBid.bid_amount != null && (
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500 uppercase">Bid Price</p>
                        <p className="text-sm font-bold text-gray-900">
                          {currentBid.currency || 'ZMW'} {Number(currentBid.bid_amount).toLocaleString()}
                        </p>
                      </div>
                    )}
                    <button
                      onClick={() => setShowBidInfo(!showBidInfo)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        showBidInfo
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {showBidInfo ? <ChevronUpIcon className="w-4 h-4 inline mr-1" /> : <ChevronDownIcon className="w-4 h-4 inline mr-1" />}
                      Bid Info
                    </button>
                  </div>
                </div>
                {showBidInfo && <BidInfoPanel bidId={currentBid.id} />}
              </div>

              {/* Technical Criteria Scoring */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Technical Criteria Scoring</h2>
                <div className="space-y-4">
                  {criteria.map((criterion) => {
                    const entry = currentScores[criterion.id] || { score: 0, comment: '' };
                    const weightedScore = (entry.score || 0) * (criterion.weight / 100);
                    return (
                      <div key={criterion.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {criterion.order_index}. {criterion.criterion_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Weight: {criterion.weight}% &bull; Max score: {criterion.max_score || 100}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-500 uppercase">Weighted</p>
                            <p className="text-lg font-bold text-zammsa-green">{weightedScore.toFixed(1)}</p>
                          </div>
                        </div>
                        {criterion.scoring_guidance && (
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-[11px] font-medium text-blue-700 mb-1">Scoring Guidance:</p>
                            <p className="text-[11px] text-blue-600 whitespace-pre-line">{criterion.scoring_guidance}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 whitespace-nowrap">Score (0-{criterion.max_score || 100}):</span>
                            <input
                              type="number"
                              min={0}
                              max={criterion.max_score || 100}
                              value={entry.score || ''}
                              onChange={(e) => updateScore(currentBid.id, criterion.id, 'score', Math.min(criterion.max_score || 100, Math.max(0, Number(e.target.value))))}
                              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-center focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green"
                              placeholder="0"
                            />
                          </div>
                          <input
                            value={entry.comment}
                            onChange={(e) => updateScore(currentBid.id, criterion.id, 'comment', e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green"
                            placeholder="Comments on this criterion..."
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Weighted Total */}
                {currentWeightedTotal > 0 && (
                  <div className={`mt-5 p-4 rounded-xl border ${currentWeightedTotal >= threshold ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Total Weighted Score</p>
                        <p className="text-xs text-gray-500">Minimum threshold: {threshold}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${currentWeightedTotal >= threshold ? 'text-emerald-600' : 'text-red-600'}`}>
                          {currentWeightedTotal.toFixed(1)} / 100
                        </p>
                        <p className={`text-xs font-medium ${currentWeightedTotal >= threshold ? 'text-emerald-600' : 'text-red-600'}`}>
                          {currentWeightedTotal >= threshold ? '✅ Passes threshold' : '🔴 Below threshold'}
                        </p>
                      </div>
                    </div>
                    {currentWeightedTotal < threshold && (
                      <p className="text-xs text-red-600 mt-2">This bid will NOT proceed to financial evaluation</p>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => goToBid(currentBidIndex - 1)}
                  disabled={currentBidIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  {currentBidIndex > 0 ? bidList[currentBidIndex - 1]?.vendor_name || 'Previous' : 'Previous'}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={submitScoresForCurrent}
                    disabled={submitting}
                    className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-green-700"
                  >
                    {submitting ? 'Saving...' : currentBidIndex < bidList.length - 1 ? 'Save & Next Bid →' : 'Save Scores'}
                  </button>
                  {allBidsScored && (
                    <button
                      onClick={() => setShowConfirmSubmit(true)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                    >
                      Submit All My Scores
                    </button>
                  )}
                </div>
                <button
                  onClick={() => goToBid(currentBidIndex + 1)}
                  disabled={currentBidIndex >= bidList.length - 1}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {currentBidIndex < bidList.length - 1 ? bidList[currentBidIndex + 1]?.vendor_name || 'Next' : 'Next'}
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowConfirmSubmit(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Submit Your Scores — {solicitation?.sol_number || ''}</h2>
            <p className="text-sm text-gray-500 mb-4">You have scored all {bidList.length} bids. Review before submitting:</p>

            <div className="space-y-3 mb-6">
              {bidList.map((bid: any) => {
                const wt = getWeightedTotal(bid.id);
                return (
                  <div key={bid.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <span className="font-medium text-gray-900">{bid.vendor_name || bid.id}</span>
                      {bid.bid_amount != null && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {bid.currency || 'ZMW'} {Number(bid.bid_amount).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">{wt.toFixed(1)}</span>
                      <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded ${wt >= threshold ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {wt >= threshold ? '✅ Passes' : '🔴 Below threshold'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <p className="text-sm font-medium text-amber-800">⚠ Once submitted your scores are LOCKED. You cannot edit them after submission.</p>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirmSubmit(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Review My Scores</button>
              <button
                onClick={submitAllScores}
                disabled={submitting}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit All Scores 🔒'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalScoring;

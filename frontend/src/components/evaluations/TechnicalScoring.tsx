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
  CheckCircleIcon, ArrowLeftIcon,
} from '@heroicons/react/outline';

const TechnicalScoring: React.FC = () => {
  const { committeeId } = useParams<{ committeeId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentBidIndex, setCurrentBidIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, Record<string, { score: number; comment: string }>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [allSubmitted, setAllSubmitted] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);

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

  const criteria: EvaluationCriterion[] = (solicitation?.evaluation_criteria || []).filter((c: EvaluationCriterion) => c.criterion_type === 'technical');
  const bidList = bidsData?.results || [];
  const currentBid = bidList[currentBidIndex];
  const currentScores = scores[currentBid?.id] || {};
  const scoredCount = bidList.filter((bid: any) => {
    const s = scores[bid.id];
    return s && criteria.every((c) => s[c.id]?.score > 0);
  }).length;

  const committeeMemberIds = useMemo(() => {
    const ids = new Set<string>();
    if (!committee) return ids;
    ids.add(String(committee.chairperson || ''));
    ids.add(String(committee.secretary || ''));
    (committee.members || []).forEach((m: any) => {
      const id = typeof m === 'string' ? m : m?.user || m?.id;
      if (id) ids.add(String(id));
    });
    return ids;
  }, [committee]);

  const isCommitteeMember = committee ? committeeMemberIds.has(String(user?.id || '')) : false;
  const isRecused = Boolean(coiState?.recused_members?.includes(String(user?.id || '')));
  const canProceedFinancial = user && [ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.DIRECTOR_PROCUREMENT].includes(user.role as any);

  useEffect(() => {
    if (!bidList.length || !criteria.length) return;
    const fetchExistingScores = async () => {
      setLoadingScores(true);
      const results = await Promise.allSettled(
        bidList.map((bid: any) =>
          evaluationsApi.getMyScores(bid.id).then(data => ({ bidId: bid.id, data }))
        )
      );
      setScores(prev => {
        const next = { ...prev };
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const { bidId, data } = r.value;
            if (!data?.my_scores?.length) continue;
            for (const s of data.my_scores) {
              if (!s.criterion) continue;
              const criterionId = s.criterion;
              const c = criteria.find((crt: EvaluationCriterion) => crt.id === criterionId);
              if (!c) continue;
              next[bidId] = next[bidId] || {};
              next[bidId][criterionId] = {
                score: Number(s.raw_score),
                comment: s.comment || '',
              };
            }
          }
        }
        return next;
      });
      setLoadingScores(false);
    };
    fetchExistingScores();
  }, [bidList.length, criteria.length]);

  const getWeightedTotal = (bidId: string) => {
    const s = scores[bidId] || {};
    let total = 0;
    criteria.forEach((c) => {
      const entry = s[c.id];
      if (entry) total += entry.score * (c.weight / 100);
    });
    return total;
  };

  const getFormulaBreakdown = (bidId: string) => {
    const s = scores[bidId] || {};
    const parts: string[] = [];
    let total = 0;
    criteria.forEach((c) => {
      const entry = s[c.id];
      const score = entry?.score || 0;
      const contrib = score * (c.weight / 100);
      parts.push(`${score}×${c.weight}%`);
      total += contrib;
    });
    return { formula: parts.join('+'), total };
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
      } else {
        setAllSubmitted(true);
      }
    } catch {
      toast.error('Failed to submit scores');
    }
    setSubmitting(false);
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
            This technical scoring workspace is only available to assigned evaluation committee members and the chair.
          </p>
        </div>
      </div>
    );
  }

  if (isRecused) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Recused From Evaluation</h2>
          <p className="text-gray-500">
            You have declared a conflict of interest and cannot participate in technical scoring for this solicitation.
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
          <p className="text-gray-500 mb-6">Your independent evaluation has been recorded. Scores are private until all members submit.</p>

          <div className="max-w-lg mx-auto space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-gray-900">Your Scores Summary</h3>
            {bidList.map((bid: any) => {
              const wt = getWeightedTotal(bid.id);
              return (
                <div key={bid.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="font-medium text-gray-900">{bid.vendor_name || bid.id}</span>
                  <span className="font-bold text-zammsa-green">{wt.toFixed(1)} / 100</span>
                </div>
              );
            })}
          </div>

          {canProceedFinancial ? (
            <button
              onClick={() => committee?.solicitation ? navigate(`/evaluations/${committee.solicitation}/financial`) : navigate('/evaluations')}
              className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold"
            >
              Proceed to Financial Evaluation
            </button>
          ) : (
            <p className="text-sm text-gray-500">The committee chair will proceed with the financial evaluation.</p>
          )}
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

  const { formula, total: weightedTotal } = getFormulaBreakdown(currentBid?.id);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Technical Scoring</h1>
            <StatusBadge status="active" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            YOUR SCORES ARE PRIVATE until all members submit | Bid {currentBidIndex + 1} of {bidList.length}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Scoring Progress</span>
          <span className="text-sm font-bold text-zammsa-green">{scoredCount} of {bidList.length} bids scored</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-zammsa-green h-3 rounded-full transition-all duration-500"
            style={{ width: `${(scoredCount / Math.max(bidList.length, 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Bid Selection Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Select Bid to Score:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Bid</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">My Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bidList.map((bid: any, i: number) => {
                const isScored = scores[bid.id] && criteria.every((c) => (scores[bid.id]?.[c.id]?.score || 0) > 0);
                return (
                  <tr key={bid.id} className={`hover:bg-gray-50 cursor-pointer ${i === currentBidIndex ? 'bg-zammsa-green/5' : ''}`} onClick={() => setCurrentBidIndex(i)}>
                    <td className="px-4 py-2 font-medium text-gray-900">Bid {i + 1} — {bid.vendor_name || bid.id}</td>
                    <td className="px-4 py-2 text-right">
                      {isScored ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">✅ Scored</span>
                      ) : i === currentBidIndex ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">🔄 Scoring Now</span>
                      ) : (
                        <button className="px-3 py-1 text-xs font-bold text-white bg-zammsa-green rounded-lg hover:bg-green-700">⏳ Score Now</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scoring Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Scoring: Bid {currentBidIndex + 1} — {currentBid.vendor_name || currentBid.id}</h2>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-xs font-medium text-zammsa-green bg-white border border-gray-200 rounded-lg hover:bg-gray-50">📄 View Technical Proposal</button>
            <button className="px-3 py-1 text-xs font-medium text-zammsa-green bg-white border border-gray-200 rounded-lg hover:bg-gray-50">📄 View Certificates</button>
          </div>
        </div>

        <div className="space-y-5">
          {criteria.map((criterion) => {
            const entry = currentScores[criterion.id] || { score: 0, comment: '' };
            const weightedScore = entry.score * (criterion.weight / 100);
            return (
              <div key={criterion.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-48 shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{criterion.criterion_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Weight: {criterion.weight}%</p>
                  {criterion.minimum_threshold != null && (
                    <p className="text-xs text-amber-600 mt-0.5">Min threshold: {criterion.minimum_threshold}%</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Score:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={entry.score || ''}
                    onChange={(e) => updateScore(currentBid.id, criterion.id, 'score', Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-center"
                    placeholder="0"
                  />
                  <span className="text-xs text-gray-500">/100</span>
                </div>
                <div className="flex-1">
                  <input
                    value={entry.comment}
                    onChange={(e) => updateScore(currentBid.id, criterion.id, 'comment', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Comments..."
                  />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">Weighted</p>
                  <p className="text-lg font-bold text-zammsa-green">{weightedScore.toFixed(1)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {weightedTotal > 0 && (
          <div className="mt-5 p-4 bg-zammsa-green/5 border border-zammsa-green/20 rounded-xl">
            <p className="text-sm font-semibold text-gray-700">
              Weighted Total: ({formula}) = {criteria.map(c => (currentScores[c.id]?.score || 0) * (c.weight / 100)).map(v => v.toFixed(1)).join('+')} ={' '}
              <span className="text-zammsa-green font-bold text-lg">{weightedTotal.toFixed(1)}</span>
            </p>
            <p className={`text-xs mt-1 font-medium ${weightedTotal >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>
              Status: {weightedTotal.toFixed(1)} {weightedTotal >= 70 ? '≥ 70 threshold ✅' : '< 70 threshold ❌'}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {currentBidIndex > 0 && (
            <button onClick={() => setCurrentBidIndex(i => i - 1)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm flex items-center gap-1">
              <ArrowLeftIcon className="w-4 h-4" /> Previous Bid
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={submitScoresForCurrent}
            disabled={submitting}
            className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {submitting ? 'Saving...' : currentBidIndex < bidList.length - 1 ? 'Save & Next Bid →' : 'Submit All Scores'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TechnicalScoring;

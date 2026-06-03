import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmModal } from '../common/ConfirmModal';
import { EvaluationCriterion } from '../../types';
import toast from 'react-hot-toast';
import { LockOpenIcon, ExclamationIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/outline';

type MemberInfo = { id: string; name: string; role: string };

const ScoreConsolidation: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [discussionNotes, setDiscussionNotes] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [showConfirmAuth, setShowConfirmAuth] = useState(false);

  const { data: solicitation, isLoading: solLoading } = useQuery({
    queryKey: ['solicitation-detail', solId],
    queryFn: () => solicitationsApi.get(solId!),
    enabled: !!solId,
  });

  const { data: committeesData, isLoading: committeesLoading } = useQuery({
    queryKey: ['committees-score-consolidation', solId],
    queryFn: () => evaluationsApi.listCommittees({ solicitation: solId, page_size: 10 }),
    enabled: !!solId,
  });

  const { data: passedBidsData, isLoading: passedBidsLoading } = useQuery({
    queryKey: ['passed-tech-bids', solId],
    queryFn: () => evaluationsApi.listPassedTechBids(solId!),
    enabled: !!solId,
  });

  const { data: technicalScoresData, isLoading: technicalScoresLoading } = useQuery({
    queryKey: ['technical-scores-consolidation', solId],
    queryFn: () => evaluationsApi.list({ solicitation: solId, page_size: 500, is_final: true }),
    enabled: !!solId,
  });

  const committees = committeesData?.results || [];
  const primaryCommittee = committees[0];
  const passedBids: any[] = passedBidsData?.bids || [];
  const technicalScores: any[] = technicalScoresData?.results || [];
  const criteria: EvaluationCriterion[] = (solicitation?.evaluation_criteria || []).filter(
    (c: EvaluationCriterion) => c.criterion_type === 'technical'
  );

  const committeeMembers = useMemo(() => {
    const memberMap = new Map<string, MemberInfo>();
    const add = (id?: string, name?: string, role?: string) => {
      if (!id || memberMap.has(id)) return;
      memberMap.set(id, { id, name: name || id, role: role || 'Member' });
    };

    if (primaryCommittee) {
      add(primaryCommittee.chairperson, primaryCommittee.chairperson_name || primaryCommittee.chairperson, 'Chair');
      add(primaryCommittee.secretary, primaryCommittee.secretary_name || primaryCommittee.secretary, 'Secretary');
      (primaryCommittee.members || []).forEach((m: any) => {
        const id = typeof m === 'string' ? m : m.user;
        add(id, typeof m === 'string' ? id?.slice(0, 8) : m.full_name || id, 'Member');
      });
    }

    technicalScores.forEach((score) => add(score.evaluator, score.evaluator_name, 'Member'));

    return Array.from(memberMap.values());
  }, [primaryCommittee, technicalScores]);

  // Build score matrix: bidId -> criterionId -> memberId -> {score, comment?}
  const scoreMatrix = useMemo(() => {
    const matrix = new Map<string, Map<string, Map<string, { rawScore: number }>>>();

    technicalScores.forEach((s: any) => {
      const bidId = String(s.bid || '');
      const criterionId = String(s.criterion || '');
      const evaluatorId = String(s.evaluator || '');
      const rawScore = Number(s.raw_score || 0);

      if (!matrix.has(bidId)) matrix.set(bidId, new Map());
      const bidMatrix = matrix.get(bidId)!;
      if (!bidMatrix.has(criterionId)) bidMatrix.set(criterionId, new Map());
      bidMatrix.get(criterionId)!.set(evaluatorId, { rawScore });
    });

    return matrix;
  }, [technicalScores]);

  const membersSubmitted = useMemo(() => {
    const submitted = new Set<string>();
    technicalScores.forEach((s: any) => {
      if (s.evaluator) submitted.add(String(s.evaluator));
    });
    return submitted;
  }, [technicalScores]);

  const allMembersSubmitted = committeeMembers.length > 0 && committeeMembers.every(m => membersSubmitted.has(m.id));

  // Check for discrepancies (>15 points deviation from average on any criterion)
  const discrepancies = useMemo(() => {
    const flags: { bidderName: string; criterionName: string; memberName: string; score: number; avg: number; diff: number }[] = [];

    passedBids.forEach((bid: any) => {
      const bidId = String(bid.bid_id || bid.id || '');
      const bidMatrix = scoreMatrix.get(bidId);
      if (!bidMatrix) return;

      criteria.forEach((criterion) => {
        const criterionId = criterion.id;
        const criterionScores = bidMatrix.get(criterionId);
        if (!criterionScores) return;

        const scores = Array.from(criterionScores.values());
        if (scores.length < 2) return;

        const avg = scores.reduce((sum, s) => sum + s.rawScore, 0) / scores.length;

        criterionScores.forEach((s, evaluatorId) => {
          const diff = Math.abs(s.rawScore - avg);
          if (diff > 15) {
            const member = committeeMembers.find(m => m.id === evaluatorId);
            flags.push({
              bidderName: bid.bidder_name || bid.vendor_name || bidId,
              criterionName: criterion.criterion_name,
              memberName: member?.name || evaluatorId,
              score: s.rawScore,
              avg: Math.round(avg * 100) / 100,
              diff: Math.round(diff * 100) / 100,
            });
          }
        });
      });
    });

    return flags;
  }, [passedBids, scoreMatrix, criteria, committeeMembers]);

  const hasDiscrepancies = discrepancies.length > 0;

  const approveMutation = useMutation({
    mutationFn: () => evaluationsApi.authorizeFinancialOpening(solId!),
    onSuccess: (data: any) => {
      toast.success(`Financial envelopes opened for ${data.opened_count || 0} bids`);
      queryClient.invalidateQueries({ queryKey: ['passed-tech-bids', solId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to authorise'),
  });

  if (solLoading || committeesLoading || passedBidsLoading || technicalScoresLoading) {
    return <LoadingSpinner className="py-12" />;
  }

  const financialOpened = passedBids.some((bid: any) => bid.financial_sealed === false);
  const allPassed = passedBids.length > 0 && passedBids.every((bid: any) => bid.passed);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Score Consolidation</h1>
            <StatusBadge status={financialOpened ? 'completed' : 'active'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {solicitation?.sol_number || solId} — {solicitation?.title || ''}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Members Submitted: {membersSubmitted.size} of {committeeMembers.length} {allMembersSubmitted ? '✅' : ''}
          </p>
        </div>
      </div>

      {hasDiscrepancies && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ExclamationIcon className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800">Discrepancy Detected</p>
              <p className="text-xs text-orange-700 mt-1">
                {discrepancies.length} member score(s) deviate more than 15 points from the average on specific criteria.
                Chair must add explanation or re-open scoring for those criteria.
              </p>
              <div className="mt-2 space-y-1">
                {discrepancies.map((d, i) => (
                  <p key={i} className="text-xs text-orange-600">
                    {d.bidderName} — {d.criterionName}: {d.memberName} scored {d.score} vs avg {d.avg} (diff: {d.diff})
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-bid detailed breakdown */}
      {passedBids.map((bid: any) => {
        const bidId = String(bid.bid_id || bid.id || '');
        const bidMatrix = scoreMatrix.get(bidId);
        const bidPassed = bid.passed;
        const overallTech = Number(bid.overall_technical_score || 0).toFixed(1);
        const bidderName = bid.bidder_name || bid.vendor_name || bidId;

        return (
          <div key={bidId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{bidderName}</h2>
                <p className="text-xs text-gray-400">{bid.submission_id || ''}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${bidPassed ? 'text-emerald-600' : 'text-red-600'}`}>
                  Total: {overallTech}
                </p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${bidPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {bidPassed ? '✅ Passes threshold' : '🔴 Fails threshold'}
                </span>
              </div>
            </div>

            {bidMatrix && criteria.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Criterion</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">WT</th>
                      {committeeMembers.map(m => (
                        <th key={m.id} className="px-3 py-2 text-center font-medium text-gray-500">{m.name.split(' ')[0]}</th>
                      ))}
                      <th className="px-3 py-2 text-center font-medium text-gray-500">AVG</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">WTOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {criteria.map((criterion) => {
                      const criterionScores = bidMatrix.get(criterion.id);
                      if (!criterionScores) return null;

                      let avgRaw = 0;
                      let scoredCount = 0;
                      const memberScores = committeeMembers.map(m => {
                        const s = criterionScores.get(m.id);
                        if (s) {
                          avgRaw += s.rawScore;
                          scoredCount++;
                          return s.rawScore;
                        }
                        return null;
                      });
                      avgRaw = scoredCount > 0 ? avgRaw / scoredCount : 0;
                      const weightedScore = avgRaw * (criterion.weight / 100);

                      return (
                        <tr key={criterion.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{criterion.criterion_name}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{criterion.weight}%</td>
                          {memberScores.map((score, idx) => (
                            <td key={idx} className="px-3 py-2 text-center font-mono">{score !== null ? score : '-'}</td>
                          ))}
                          <td className="px-3 py-2 text-center font-bold text-gray-700">{avgRaw.toFixed(1)}</td>
                          <td className="px-3 py-2 text-center font-bold text-zammsa-green">{weightedScore.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!bidMatrix && (
              <p className="text-sm text-gray-400 py-4 text-center">No detailed scores available for this bid yet.</p>
            )}
          </div>
        );
      })}

      {passedBids.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-500">No bids with finalized technical scores found for this solicitation.</p>
        </div>
      )}

      {/* Technical Ranking */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Technical Ranking (qualifying bids only)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">Tech Score</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">Financial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...passedBids]
                .sort((a: any, b: any) => (b.overall_technical_score || 0) - (a.overall_technical_score || 0))
                .map((bid: any, i: number) => (
                  <tr key={bid.bid_id || bid.id} className={bid.passed ? 'hover:bg-gray-50' : 'bg-red-50/40'}>
                    <td className="px-4 py-2 font-medium text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{bid.bidder_name || bid.vendor_name || bid.bid_id}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`font-bold ${bid.passed ? 'text-zammsa-green' : 'text-red-600'}`}>
                        {Number(bid.overall_technical_score || 0).toFixed(1)}
                        {!bid.passed && ' ❌'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="text-xs text-amber-600 font-medium">
                        {bid.financial_sealed ? '🔒 Sealed' : '🔓 Opened'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chair Notes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Chair Notes</h2>
        <textarea
          value={discussionNotes}
          onChange={(e) => setDiscussionNotes(e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm"
          placeholder="Enter discussion notes for the BER..."
        />
        <p className="text-xs text-gray-500 mt-2">
          These notes will be carried into the Bid Evaluation Report.
        </p>
      </div>

      {/* Authorise Financial Opening */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <LockOpenIcon className="w-5 h-5 text-blue-500" />
          Authorise Financial Envelope Opening
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Once technical consolidation is complete, the chair can authorise the opening of financial envelopes
          for all technically passing bids. Disqualified bids' envelopes remain sealed permanently.
        </p>

        <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={authChecked}
            onChange={(e) => setAuthChecked(e.target.checked)}
            className="mt-0.5 accent-zammsa-green"
          />
          <div>
            <p className="text-sm font-medium text-blue-900">I confirm technical consolidation is complete</p>
            <p className="text-xs text-blue-700 mt-0.5">
              This will unseal the financial envelopes for all passing bids only.
            </p>
          </div>
        </label>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setShowConfirmAuth(true)}
            disabled={!authChecked || approveMutation.isPending || financialOpened}
            className="px-6 py-3 bg-zammsa-green text-white text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-green-700"
          >
            {financialOpened
              ? 'Financial Envelopes Already Opened'
              : approveMutation.isPending
                ? 'Authorising...'
                : 'Authorise Financial Envelope Opening'}
          </button>
          <button
            onClick={() => navigate(`/evaluations/${solId}/financial`)}
            className="px-6 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50"
          >
            Go to Financial Evaluation
          </button>
        </div>

        <ConfirmModal
          open={showConfirmAuth}
          onClose={() => setShowConfirmAuth(false)}
          onConfirm={() => { setShowConfirmAuth(false); approveMutation.mutate(); }}
          title="Authorise Financial Envelope Opening?"
          message="This will irreversibly unseal financial envelopes for all technically passing bids. Disqualified bids' envelopes remain permanently sealed."
          variant="warning"
          confirmText="Yes, Authorise Opening"
        />
      </div>
    </div>
  );
};

export default ScoreConsolidation;

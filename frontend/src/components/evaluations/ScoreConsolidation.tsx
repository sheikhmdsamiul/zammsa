import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import toast from 'react-hot-toast';
import { LockOpenIcon } from '@heroicons/react/outline';

type PassingBid = {
  bid_id?: string;
  id?: string;
  bidder_name?: string;
  vendor_name?: string;
  overall_technical_score?: number;
  passed?: boolean;
  financial_sealed?: boolean;
  evaluated_price?: number | null;
};

type TechnicalScoreRow = {
  bid: string;
  evaluator?: string;
  evaluator_name: string;
  weighted_score: number | string;
};

const ScoreConsolidation: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [discussionNotes, setDiscussionNotes] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

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
  const passedBids: PassingBid[] = passedBidsData?.bids || [];
  const technicalScores: TechnicalScoreRow[] = technicalScoresData?.results || [];

  const committeeMembers = useMemo(() => {
    const memberMap = new Map<string, { id: string; name: string; role: string }>();
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

    if (!memberMap.size) {
      technicalScores.forEach((score) => add(score.evaluator, score.evaluator_name, 'Member'));
    }

    return Array.from(memberMap.values());
  }, [primaryCommittee, technicalScores]);

  const evaluatorOrder = committeeMembers.length
    ? committeeMembers.map((m) => m.name)
    : Array.from(new Set(technicalScores.map((s) => s.evaluator_name).filter(Boolean)));

  const consolidatedRows = useMemo(() => {
    const passingIds = new Set(passedBids.map((b) => String(b.bid_id || b.id || '')));
    const rows = new Map<string, {
      id: string;
      name: string;
      memberScores: Record<string, number>;
      average: number;
      passed: boolean;
      financialSealed: boolean;
      evaluatedPrice: number | null;
    }>();

    const bidLookup = new Map<string, PassingBid>();
    passedBids.forEach((bid) => {
      bidLookup.set(String(bid.bid_id || bid.id || ''), bid);
    });

    technicalScores.forEach((score) => {
      const bidId = String(score.bid || '');
      if (!passingIds.has(bidId)) return;

      const bid = bidLookup.get(bidId);
      if (!bid) return;

      const row = rows.get(bidId) || {
        id: bidId,
        name: bid.bidder_name || bid.vendor_name || bidId,
        memberScores: {},
        average: Number(bid.overall_technical_score || 0),
        passed: Boolean(bid.passed),
        financialSealed: Boolean(bid.financial_sealed),
        evaluatedPrice: bid.evaluated_price ?? null,
      };

      row.memberScores[score.evaluator_name || 'Evaluator'] = (row.memberScores[score.evaluator_name || 'Evaluator'] || 0) + Number(score.weighted_score || 0);
      rows.set(bidId, row);
    });

    return Array.from(rows.values()).sort((a, b) => b.average - a.average);
  }, [passedBids, technicalScores]);

  const authorizeMutation = useMutation({
    mutationFn: () => evaluationsApi.authorizeFinancialOpening(solId!),
    onSuccess: (data: any) => {
      toast.success(`Financial envelopes opened for ${data.opened_count || 0} bids`);
      queryClient.invalidateQueries({ queryKey: ['passed-tech-bids', solId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to authorise'),
  });

  if (committeesLoading || passedBidsLoading || technicalScoresLoading) {
    return <LoadingSpinner className="py-12" />;
  }

  const financialOpened = passedBids.some((bid) => bid.financial_sealed === false);
  const allPassed = passedBids.length > 0 && passedBids.every((bid) => bid.passed);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Score Consolidation</h1>
            <StatusBadge status={financialOpened ? 'completed' : 'active'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Consolidated technical scores for solicitation {solId}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Committee Members</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{committeeMembers.length}</p>
          <p className="text-xs text-gray-500 mt-2">Chair, secretary, and members combined</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Passing Bids</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{passedBids.length}</p>
          <p className="text-xs text-gray-500 mt-2">{allPassed ? 'All passed the technical threshold' : 'Awaiting complete technical results'}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Financial Opening</p>
          <p className={`text-3xl font-bold mt-1 ${financialOpened ? 'text-emerald-600' : 'text-amber-500'}`}>
            {financialOpened ? 'Opened' : 'Pending'}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {financialOpened ? 'Financial envelopes are already open' : 'Authorize opening after technical consolidation'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Committee Members</h2>
        <div className="flex flex-wrap gap-2">
          {committeeMembers.map((member) => (
            <span key={member.id} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 border border-gray-200">
              <span className="w-2 h-2 rounded-full bg-zammsa-green" />
              {member.name} <span className="text-xs text-gray-400">({member.role})</span>
            </span>
          ))}
          {committeeMembers.length === 0 && (
            <p className="text-sm text-gray-400">No committee members found for this solicitation.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Technical Scores by Bid</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Bidder</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Evaluator Totals</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Average</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Financial Seal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {consolidatedRows.map((row) => (
                <tr key={row.id} className={row.passed ? 'hover:bg-gray-50' : 'bg-red-50/40'}>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {evaluatorOrder.map((name) => (
                        <span key={name} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {name}: {(row.memberScores[name] || 0).toFixed(1)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-zammsa-green">{row.average.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${row.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {row.passed ? 'Passes' : 'Below threshold'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-medium ${row.financialSealed ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {row.financialSealed ? 'Sealed' : 'Opened'}
                    </span>
                  </td>
                </tr>
              ))}
              {consolidatedRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No consolidated technical scores are available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
          These notes are intended to carry into the Bid Evaluation Report.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <LockOpenIcon className="w-5 h-5 text-blue-500" />
          Authorise Financial Envelope Opening
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Once technical consolidation is complete, the chair can authorise the opening of financial envelopes for all technically passing bids.
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
              This will unseal the financial envelopes for all passing bids.
            </p>
          </div>
        </label>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => authChecked && authorizeMutation.mutate()}
            disabled={!authChecked || authorizeMutation.isPending || financialOpened}
            className="px-6 py-3 bg-zammsa-green text-white text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-green-700"
          >
            {financialOpened
              ? 'Financial Envelopes Already Opened'
              : authorizeMutation.isPending
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
      </div>
    </div>
  );
};

export default ScoreConsolidation;

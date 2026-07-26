import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmModal } from '../common/ConfirmModal';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, LockOpenIcon, StarIcon, InformationCircleIcon,
  ExclamationIcon, CurrencyDollarIcon, CalculatorIcon,
} from '@heroicons/react/outline';
import type { PassedTechBid, QCBSResult, SelectWinnerResponse } from '../../types';

const ceecPreferenceMap: Record<string, { label: string; margin: number }> = {
  citizen_owned: { label: 'Citizen-Owned 12%', margin: 12 },
  citizen_empowered: { label: 'Citizen-Empowered 8%', margin: 8 },
  citizen_influenced: { label: 'Citizen-Influenced 4%', margin: 4 },
  non_citizen: { label: 'None', margin: 0 },
};

type EvaluatedBid = {
  bidId: string;
  bidderName: string;
  bidPrice: number;
  ceec: string;
  ceecLabel: string;
  prefMargin: number;
  evaluatedPrice: number;
  techScore: number;
  financialScore: number;
  financialEvaluated: boolean;
};

const FinancialEvaluation: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [confirmWinnerBid, setConfirmWinnerBid] = useState<string | null>(null);
  const [showCalculateConfirm, setShowCalculateConfirm] = useState(false);
  const [calculatingBid, setCalculatingBid] = useState<string | null>(null);

  const { data: passedBidsData, isLoading: bidsLoading, refetch: refetchBids } = useQuery({
    queryKey: ['passed-tech-bids', solId],
    queryFn: () => evaluationsApi.listPassedTechBids(solId!),
    enabled: !!solId,
    refetchInterval: 30000,
  });

  const { data: solicitation, isLoading: solLoading } = useQuery({
    queryKey: ['solicitation', solId],
    queryFn: () => solicitationsApi.get(solId!),
    enabled: !!solId,
  });

  const { data: committeeData } = useQuery({
    queryKey: ['committees-for-financial', solId],
    queryFn: () => evaluationsApi.listCommittees({ solicitation: solId, page_size: 5 }),
    enabled: !!solId,
  });

  const { data: qcbsResults, isLoading: qcbsLoading } = useQuery({
    queryKey: ['consolidated-scores', solId],
    queryFn: () => evaluationsApi.getConsolidatedScores(solId!),
    enabled: !!solId,
  });

  const primaryCommittee = (committeeData?.results || [])[0];

  const isChairSystem = user?.role === ROLES.EVALUATION_COMMITTEE_CHAIR;
  const isChairCommittee = primaryCommittee ? String(primaryCommittee.chairperson || '') === String(user?.id || '') : false;
  const isDirector = user?.role === ROLES.DIRECTOR_PROCUREMENT;
  const canManage = isChairSystem || isChairCommittee || isDirector;

  const passedBids = passedBidsData?.bids || [];
  const solicitationAwarded = solicitation?.status === 'awarded';
  const evalMethod = solicitation?.evaluation_method || 'lowest_price';
  const isCombinedMethod = evalMethod === 'qcbs' || evalMethod === 'qbs';
  const isLowestPrice = evalMethod === 'lowest_price' || evalMethod === 'lcs' || evalMethod === 'fbs';
  const computeLabel = isCombinedMethod ? 'Compute Combined Scores' : 'Persist Rankings';
  const methodLabel = isCombinedMethod ? 'Combined Scores' : 'Evaluated Rankings';
  const awardedWinner = passedBidsData?.winner_name || null;

  const financialOpened = passedBids.some((b: PassedTechBid) => b.financial_sealed === false);
  const hasSealedBids = passedBids.some((b: PassedTechBid) => b.financial_sealed === true);

  const evaluatedBids: EvaluatedBid[] = useMemo(() => {
    return passedBids
      .filter((b: PassedTechBid) => b.passed)
      .map((b: PassedTechBid) => {
        const pref = ceecPreferenceMap[b.preference_category || 'non_citizen'] || ceecPreferenceMap.non_citizen;
        let prefMargin = Number(b.preference_margin ?? pref.margin ?? 0);
        if (solicitation && solicitation.citizen_preference === false) {
          prefMargin = 0;
        }
        const price = Number(b.original_price || 0);
        const evalPrice = b.evaluated_price != null ? Number(b.evaluated_price) : price;
        return {
          bidId: b.bid_id,
          bidderName: b.bidder_name || 'Unknown',
          bidPrice: price,
          ceec: b.preference_category || 'non_citizen',
          ceecLabel: prefMargin > 0 ? pref.label : 'None',
          prefMargin,
          evaluatedPrice: evalPrice,
          techScore: b.overall_technical_score || 0,
          financialScore: b.financial_score != null ? Number(b.financial_score) : 0,
          financialEvaluated: b.financial_evaluation_id != null,
        };
      });
  }, [passedBids, solicitation]);

  const lowestEvalPrice = evaluatedBids.length > 0
    ? Math.min(...evaluatedBids.filter(b => b.financialEvaluated).map(b => b.evaluatedPrice))
    : 0;

  const financialScores = useMemo(() => {
    if (evaluatedBids.length === 0) return [];
    return evaluatedBids.map(b => ({
      ...b,
      financialScore: b.financialScore > 0
        ? b.financialScore
        : (b.financialEvaluated && lowestEvalPrice > 0 ? (lowestEvalPrice / b.evaluatedPrice) * 100 : 0),
    }));
  }, [evaluatedBids, lowestEvalPrice]);

  const techWeight = isCombinedMethod ? (100 - (solicitation?.financial_weight || 20)) : 100;
  const finWeight = isCombinedMethod ? (solicitation?.financial_weight || 20) : 0;

  const rankedResults: (EvaluatedBid & { techWeighted: number; finWeighted: number; totalScore: number; rank: number })[] = useMemo(() => {
    const source = financialScores.map(b => ({
      ...b,
      techWeighted: b.techScore * (techWeight / 100),
      finWeighted: b.financialScore * (finWeight / 100),
      totalScore: b.techScore * (techWeight / 100) + b.financialScore * (finWeight / 100),
      rank: 0,
    }));
    if (isCombinedMethod) {
      source.sort((a, b) => b.totalScore - a.totalScore);
    } else {
      source.sort((a, b) => a.evaluatedPrice - b.evaluatedPrice);
    }
    return source.map((s, i) => ({ ...s, rank: i + 1 }));
  }, [financialScores, techWeight, finWeight, isCombinedMethod]);

  const calculateBidMutation = useMutation({
    mutationFn: ({ bidId, data }: { bidId: string; data: any }) =>
      evaluationsApi.calculateFinancial(bidId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passed-tech-bids', solId] });
      toast.success('Financial evaluation calculated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to calculate financial evaluation');
    },
  });

  const computeMutation = useMutation({
    mutationFn: () => evaluationsApi.calculateQCBS(solId!),
    onSuccess: (data) => {
      refetchBids();
      queryClient.invalidateQueries({ queryKey: ['consolidated-scores', solId] });
      if (isCombinedMethod) {
        toast.success(`Combined scores calculated: Tech ${data.tech_weight}% / Fin ${data.fin_weight}%`);
      } else {
        toast.success('Rankings persisted successfully');
      }
    },
    onError: (err: any) => {
      const label = isCombinedMethod ? 'combined scores' : 'rankings';
      toast.error(err?.response?.data?.error || `Failed to compute ${label}`);
    },
  });

  const authorizeMutation = useMutation({
    mutationFn: () => evaluationsApi.authorizeFinancialOpening(solId!),
    onSuccess: (data) => {
      toast.success(`Financial envelopes opened for ${data.opened_count} bids`);
      queryClient.invalidateQueries({ queryKey: ['passed-tech-bids', solId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to authorize opening'),
  });

  const selectWinnerMutation = useMutation({
    mutationFn: (bidId: string) => evaluationsApi.selectWinner(solId!, bidId),
    onSuccess: (data: SelectWinnerResponse) => {
      queryClient.invalidateQueries({ queryKey: ['phase-status', solId] });
      queryClient.invalidateQueries({ queryKey: ['passed-tech-bids', solId] });
      queryClient.invalidateQueries({ queryKey: ['solicitation', solId] });
      toast.success(`Winner selected: ${data.winner_name}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to select winner'),
  });

  const handleCalculateAllBids = useCallback(async () => {
    const unevaluated = evaluatedBids.filter(b => !b.financialEvaluated);
    if (unevaluated.length === 0) {
      toast('All bids already have financial evaluations', { icon: 'ℹ️' });
      return;
    }
    let succeeded = 0;
    let failed = 0;
    for (const bid of unevaluated) {
      setCalculatingBid(bid.bidId);
      try {
        await calculateBidMutation.mutateAsync({
          bidId: bid.bidId,
          data: {
            original_price: bid.bidPrice,
            corrected_price: bid.bidPrice,
            preference_margin: bid.prefMargin,
            preference_category: bid.ceec,
          },
        });
        succeeded++;
      } catch (err: any) {
        failed++;
        toast.error(`${bid.bidderName}: ${err?.response?.data?.error || 'Failed'}`);
      }
    }
    setCalculatingBid(null);
    queryClient.invalidateQueries({ queryKey: ['passed-tech-bids', solId] });
    if (failed === 0) {
      toast.success(`All ${succeeded} bid(s) evaluated successfully`);
    }
  }, [evaluatedBids, calculateBidMutation, queryClient, solId]);

  if (bidsLoading || solLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner className="w-16 h-16" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-500">
            Financial evaluation is restricted to the committee chair or Director of Procurement.
          </p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-gray-900">Financial Evaluation</h1>
            <StatusBadge
              status={solicitationAwarded ? 'completed' : financialOpened ? 'active' : 'draft'}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {solicitation?.sol_number || solicitation?.title || passedBidsData?.solicitation_id?.slice(0, 8) || ''}
            {solicitationAwarded && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <CheckCircleIcon className="w-3 h-3" />
                Awarded
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {!solicitationAwarded && hasSealedBids && (
            <button
              onClick={() => authorizeMutation.mutate()}
              disabled={authorizeMutation.isPending}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
            >
              <LockOpenIcon className="w-5 h-5" />
              {authorizeMutation.isPending ? 'Opening...' : 'Open Financial Envelopes'}
            </button>
          )}
          <button
            onClick={() => navigate(`/evaluations/${solId}/consolidation`)}
            className="px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50"
          >
            ← Consolidation
          </button>
        </div>
      </div>

      {financialOpened && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <LockOpenIcon className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              Financial envelopes opened
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {evaluatedBids.filter(b => b.financialEvaluated).length} of {evaluatedBids.length} bids evaluated
              {calculatingBid && ' — calculating...'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <InformationCircleIcon className="w-5 h-5 text-indigo-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-indigo-800">
              Evaluation Method: {evalMethod === 'qcbs' ? 'QCBS (Quality and Cost-Based Selection)' :
                evalMethod === 'qbs' ? 'QBS (Quality-Based Selection)' :
                evalMethod === 'lowest_price' ? 'Lowest Price' :
                evalMethod === 'lcs' ? 'LCS (Least Cost Selection)' :
                evalMethod === 'fbs' ? 'FBS (Fixed Budget Selection)' :
                evalMethod}
            </p>
            <p className="text-xs text-indigo-600 mt-0.5">
              {isCombinedMethod
                ? `Combined scoring: ${techWeight}% Technical + ${finWeight}% Financial weight. Winner is ranked by total combined score.`
                : 'Price-based selection: winner is determined by the lowest evaluated price among technically responsive bids.'}
            </p>
          </div>
        </div>
      </div>

      {!financialOpened && !solicitationAwarded && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-gray-500">
            {!passedBids.length
              ? 'No bids have passed technical evaluation yet.'
              : 'Open financial envelopes to begin financial evaluation.'}
          </p>
        </div>
      )}

      {passedBids.length > 0 && financialOpened && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CurrencyDollarIcon className="w-5 h-5 text-gray-500" />
                Step 1: Bid Price Review &amp; Calculation
              </h2>
              {!solicitationAwarded && canManage && evaluatedBids.some(b => !b.financialEvaluated) && (
                <button
                  onClick={handleCalculateAllBids}
                  disabled={calculateBidMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <CalculatorIcon className="w-4 h-4" />
                  {calculateBidMutation.isPending ? 'Calculating...' : 'Calculate All Financial Evaluations'}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Bid Price (ZMW)</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">CEEC Category</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Margin</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Tech Score</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evaluatedBids.map((bid) => (
                    <tr key={bid.bidId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{bid.bidderName}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold">{Number(bid.bidPrice).toLocaleString()}</td>
                      <td className="px-4 py-2 text-center text-xs font-medium">{bid.ceecLabel}</td>
                      <td className="px-4 py-2 text-center text-xs font-medium">
                        {bid.prefMargin > 0
                          ? <span className="text-emerald-600 font-medium">-{bid.prefMargin}%</span>
                          : <span className="text-gray-400">None</span>}
                      </td>
                      <td className="px-4 py-2 text-center font-mono">{bid.techScore.toFixed(1)}</td>
                      <td className="px-4 py-2 text-center">
                        {bid.financialEvaluated
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              <CheckCircleIcon className="w-3 h-3" /> Calculated
                            </span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                              Pending
                            </span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Step 2: Preference Margin &amp; Evaluated Price
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Evaluated Price = Bid Price × (1 - Margin/100). Used for RANKING only.
              Contract awarded at ACTUAL bid price.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Bid Price (ZMW)</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Margin</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Calculation</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Evaluated Price (ZMW)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evaluatedBids.map((bid) => (
                    <tr key={bid.bidId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{bid.bidderName}</td>
                      <td className="px-4 py-2 text-right font-mono">{Number(bid.bidPrice).toLocaleString()}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={bid.prefMargin > 0 ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                          {bid.prefMargin > 0 ? `-${bid.prefMargin}%` : 'None'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center font-mono text-[11px] text-gray-500">
                        {Number(bid.bidPrice).toLocaleString()} × (1 - {bid.prefMargin}/100)
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600">
                        {Number(bid.evaluatedPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Step 3: Financial Scores
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Financial Score = (Lowest Evaluated Price / This Evaluated Price) × 100
            </p>
            {lowestEvalPrice > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-800">
                  Lowest Evaluated Price: ZMW {lowestEvalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  {' '}({financialScores.find(b => b.evaluatedPrice === lowestEvalPrice && b.financialEvaluated)?.bidderName || ''})
                </p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Evaluated Price</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Financial Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {financialScores.map((bid) => (
                    <tr key={bid.bidId} className={bid.financialEvaluated ? 'hover:bg-gray-50' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {bid.bidderName}
                        {!bid.financialEvaluated && <span className="text-xs text-amber-500 ml-2">(not yet evaluated)</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {Number(bid.evaluatedPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-center font-mono font-bold text-emerald-600">
                        {bid.financialScore > 0 ? bid.financialScore.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CalculatorIcon className="w-5 h-5 text-indigo-500" />
                Step 4: {methodLabel}
              </h2>
              <div className="flex items-center gap-3">
                {qcbsResults && !qcbsLoading && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    Backend Verified
                  </span>
                )}
                {!solicitationAwarded && canManage && (
                  <button
                    onClick={() => setShowCalculateConfirm(true)}
                    disabled={computeMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {computeMutation.isPending ? 'Computing...' : computeLabel}
                  </button>
                )}
              </div>
            </div>
            {isCombinedMethod && (
              <>
                <div className="mb-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <p className="text-xs text-indigo-800">
                    Weight configuration: <strong>{techWeight}% Technical</strong> + <strong>{finWeight}% Financial</strong>
                    {solicitation?.financial_weight && (
                      <span className="ml-2 text-indigo-600">(from solicitation financial_weight: {solicitation.financial_weight}%)</span>
                    )}
                  </p>
                </div>
                {rankedResults.length > 0 && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-500">Tech ({techWeight}%)</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-500">Financial ({finWeight}%)</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-500">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rankedResults.map((bid) => (
                            <tr key={bid.bidId} className={bid.rank === 1 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                              <td className="px-4 py-2 text-center font-medium text-gray-500">{bid.rank}</td>
                              <td className="px-4 py-2 font-medium text-gray-900">
                                {bid.bidderName}
                                {bid.rank === 1 && <StarIcon className="w-4 h-4 text-yellow-500 inline ml-1" />}
                              </td>
                              <td className="px-4 py-2 text-right font-mono">{bid.techWeighted.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right font-mono">{bid.finWeighted.toFixed(2)}</td>
                              <td className="px-4 py-2 text-center font-mono font-bold text-lg text-emerald-600">
                                {bid.totalScore.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!solicitationAwarded && rankedResults.length > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <InformationCircleIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-blue-800">
                              <strong>Recommended:</strong> {rankedResults[0]?.bidderName || 'N/A'}
                            </p>
                            <p className="text-sm text-blue-800">
                              <strong>Contract Value:</strong> ZMW {Number(rankedResults[0]?.bidPrice || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {!isCombinedMethod && (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  {isLowestPrice
                    ? 'Bids ranked by evaluated price. Lowest evaluated price wins.'
                    : 'Technical score-based ranking.'}
                </p>
                {rankedResults.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-500">Evaluated Price</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-500">Tech Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rankedResults.map((bid) => (
                          <tr key={bid.bidId} className={bid.rank === 1 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                            <td className="px-4 py-2 text-center font-medium text-gray-500">{bid.rank}</td>
                            <td className="px-4 py-2 font-medium text-gray-900">
                              {bid.bidderName}
                              {bid.rank === 1 && <StarIcon className="w-4 h-4 text-yellow-500 inline ml-1" />}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600">
                              ZMW {Number(bid.evaluatedPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">{bid.techScore.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {!awardedWinner && financialOpened && rankedResults.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 5: Select Winner</h2>
          <div className="space-y-3">
            {rankedResults.map((bid) => (
              <div key={bid.bidId} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors">
                <div>
                  <p className="font-semibold text-gray-900">
                    {bid.rank === 1 && <StarIcon className="w-4 h-4 text-yellow-500 inline mr-1" />}
                    {bid.bidderName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isCombinedMethod
                      ? `Score: ${bid.totalScore.toFixed(2)} | `
                      : `Evaluated: ZMW ${Number(bid.evaluatedPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })} | `}
                    Bid Price: ZMW {Number(bid.bidPrice).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setConfirmWinnerBid(bid.bidId)}
                  disabled={selectWinnerMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  Select as Winner
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {solicitationAwarded && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Winner Selected: {awardedWinner}
            </h2>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => navigate(`/evaluations/${solId}/consolidation`)}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50"
            >
              ← Back to Consolidation
            </button>
            <button
              onClick={() => navigate(`/evaluations/post-qualification?solicitation=${solId}`)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
            >
              Proceed to Post-Qualification →
            </button>
          </div>
        </div>
      )}

      {selectWinnerMutation.isPending && (
        <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 bg-emerald-50 py-2 rounded-lg">
          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Processing winner selection...
        </div>
      )}

      <ConfirmModal
        open={confirmWinnerBid !== null}
        onClose={() => setConfirmWinnerBid(null)}
        onConfirm={() => {
          if (confirmWinnerBid) selectWinnerMutation.mutate(confirmWinnerBid);
          setConfirmWinnerBid(null);
        }}
        title="Confirm Winner Selection?"
        message="This will award the contract to this bidder and mark all other bids as unsuccessful. This action is irreversible."
        variant="warning"
        confirmText="Yes, Select as Winner"
      />

      <ConfirmModal
        open={showCalculateConfirm}
        onClose={() => setShowCalculateConfirm(false)}
        onConfirm={() => { setShowCalculateConfirm(false); computeMutation.mutate(); }}
        title={isCombinedMethod ? 'Compute Combined Scores?' : 'Persist Rankings?'}
        message={isCombinedMethod
          ? `This will compute combined scores using Tech ${techWeight}% + Financial ${finWeight}%.`
          : isLowestPrice
          ? 'This will rank bids by evaluated price. Lowest evaluated price wins.'
          : 'This will persist the current technical rankings.'}
        variant="info"
        confirmText="Compute"
        cancelText="Cancel"
      />
    </div>
  );
};

export default FinancialEvaluation;

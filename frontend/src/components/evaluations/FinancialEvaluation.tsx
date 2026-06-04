import React, { useMemo, useState, useEffect } from 'react';
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
import type { PassedTechBid, QCBSResponse, QCBSResult, SelectWinnerResponse } from '../../types';

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
};

const FinancialEvaluation: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [authorized, setAuthorized] = useState(false);
  const [winnerSelected, setWinnerSelected] = useState(false);
  const [winner, setWinner] = useState('');
  const [confirmWinnerBid, setConfirmWinnerBid] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState('');
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showCalculateConfirm, setShowCalculateConfirm] = useState(false);

  const isChair = user?.role === ROLES.EVALUATION_COMMITTEE_CHAIR;
  const isDirector = user?.role === ROLES.DIRECTOR_PROCUREMENT;
  const canManage = isChair || isDirector;

  const [computedQcbsData, setComputedQcbsData] = useState<QCBSResponse | null>(null);

  const { data: passedBidsData, isLoading: bidsLoading, refetch: refetchBids } = useQuery({
    queryKey: ['passed-tech-bids', solId],
    queryFn: () => evaluationsApi.listPassedTechBids(solId!),
    enabled: !!solId,
  });

  const { data: solicitation } = useQuery({
    queryKey: ['solicitation', solId],
    queryFn: () => solicitationsApi.get(solId!),
    enabled: !!solId,
  });

  const passedBids = passedBidsData?.bids || [];
  const solicitationAwarded = solicitation?.status === 'awarded';
  const awardedWinner = passedBidsData?.winner_name || winner;
  const financialOpened = passedBids.some((b: PassedTechBid) => b.financial_sealed === false);

  useEffect(() => {
    if (!canManage || authorized) return;
    const interval = setInterval(async () => {
      try {
        const result = await evaluationsApi.listPassedTechBids(solId!);
        const newlyOpened = result.bids.some((b: PassedTechBid) => b.financial_sealed === false);
        if (newlyOpened && !financialOpened) {
          setAuthorized(true);
          toast.success('Financial envelopes have been opened');
        }
        setLastUpdated(new Date().toLocaleTimeString());
      } catch {
        /* ignore */
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [canManage, authorized, financialOpened, solId]);

  useEffect(() => {
    if (financialOpened) setAuthorized(true);
  }, [financialOpened]);

  const evaluatedBids: EvaluatedBid[] = useMemo(() => {
    return passedBids
      .filter((b: PassedTechBid) => b.passed)
      .map((b: PassedTechBid) => {
        const pref = ceecPreferenceMap[b.preference_category || 'non_citizen'] || ceecPreferenceMap.non_citizen;
        const prefMargin = Number(b.preference_margin ?? pref.margin ?? 0);
        const price = Number(b.original_price || 0);
        const evalPrice = b.evaluated_price != null ? Number(b.evaluated_price) : (price * (1 - prefMargin / 100));
        return {
          bidId: b.bid_id,
          bidderName: b.bidder_name || 'Unknown',
          bidPrice: price,
          ceec: b.preference_category || 'non_citizen',
          ceecLabel: pref.label,
          prefMargin,
          evaluatedPrice: evalPrice,
          techScore: b.overall_technical_score || 0,
          financialScore: b.financial_score != null ? Number(b.financial_score) : 0,
        };
      });
  }, [passedBids]);

  const financialScores = useMemo(() => {
    if (evaluatedBids.length === 0) return [];
    const lowestEvalPrice = Math.min(...evaluatedBids.map(b => b.evaluatedPrice));
    return evaluatedBids.map(b => ({
      ...b,
      financialScore: b.financialScore > 0
        ? b.financialScore
        : (lowestEvalPrice > 0 ? (lowestEvalPrice / b.evaluatedPrice) * 100 : 0),
    }));
  }, [evaluatedBids]);

  const qcbsResults: (EvaluatedBid & { techWeighted: number; finWeighted: number; totalScore: number })[] = useMemo(() => {
    if (computedQcbsData?.results && computedQcbsData.results.length > 0) {
      return computedQcbsData.results
        .map((r: QCBSResult) => {
          const bid = financialScores.find(b => b.bidId === r.bid_id);
          return {
            bidId: r.bid_id,
            bidderName: r.bidder_name,
            bidPrice: bid?.bidPrice || 0,
            ceec: bid?.ceec || 'non_citizen',
            ceecLabel: bid?.ceecLabel || 'None',
            prefMargin: bid?.prefMargin || 0,
            evaluatedPrice: bid?.evaluatedPrice || 0,
            techScore: r.technical_score,
            financialScore: r.financial_score,
            techWeighted: r.technical_score * (computedQcbsData.tech_weight / 100),
            finWeighted: r.financial_score * (computedQcbsData.fin_weight / 100),
            totalScore: r.total_score,
          };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
    }
    return financialScores.map(b => {
      const techWeighted = b.techScore * 0.8;
      const finWeighted = b.financialScore * 0.2;
      return { ...b, techWeighted, finWeighted, totalScore: techWeighted + finWeighted };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [financialScores, computedQcbsData]);

  const computeMutation = useMutation({
    mutationFn: () => evaluationsApi.calculateQCBS(solId!),
    onSuccess: (data) => {
      setComputedQcbsData(data);
      refetchBids();
      toast.success(`QCBS calculated: Tech ${data.tech_weight}% / Fin ${data.fin_weight}%`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to compute QCBS');
    },
  });

  const authorizeMutation = useMutation({
    mutationFn: () => evaluationsApi.authorizeFinancialOpening(solId!),
    onSuccess: (data) => {
      setAuthorized(true);
      toast.success(`Financial envelopes opened for ${data.opened_count} bids`);
      queryClient.invalidateQueries({ queryKey: ['passed-tech-bids', solId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to authorize opening'),
  });

  const selectWinnerMutation = useMutation({
    mutationFn: (bidId: string) => evaluationsApi.selectWinner(solId!, bidId),
    onSuccess: (data: SelectWinnerResponse) => {
      setWinner(data.winner_name);
      setWinnerSelected(true);
      toast.success(`Winner selected: ${data.winner_name}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to select winner'),
  });

  if (bidsLoading) {
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

  const lowestEvalPrice = financialScores.length > 0
    ? Math.min(...financialScores.map(b => b.evaluatedPrice))
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Financial Evaluation</h1>
            <StatusBadge
              status={solicitationAwarded ? 'completed' : financialOpened || authorized ? 'active' : 'draft'}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Solicitation {passedBidsData?.solicitation_id?.slice(0, 8) || ''}
            {solicitationAwarded && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <CheckCircleIcon className="w-3 h-3" />
                Awarded
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {!solicitationAwarded && !financialOpened && !authorized && (
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
            &larr; Consolidation
          </button>
        </div>
      </div>

      {financialOpened && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <LockOpenIcon className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              Envelopes opened {lastUpdated ? `(updated ${lastUpdated})` : ''}
            </p>
          </div>
        </div>
      )}

      {!passedBids.length && !authorized && !solicitationAwarded && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-gray-500">No bids have passed technical evaluation yet.</p>
        </div>
      )}

      {passedBids.length > 0 && financialOpened && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-gray-500" />
              Step 1: Bid Price Review
            </h2>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Bid Price (ZMW)</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">CEEC Category</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Tech Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evaluatedBids.map((bid) => (
                    <tr key={bid.bidId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{bid.bidderName}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold">{Number(bid.bidPrice).toLocaleString()}</td>
                      <td className="px-4 py-2 text-center text-xs font-medium">{bid.ceecLabel}</td>
                      <td className="px-4 py-2 text-center font-mono">{bid.techScore.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
                <ExclamationIcon className="w-4 h-4" />
                Review for arithmetic errors before proceeding
              </p>
              {evaluatedBids.map((bid) => (
                <div key={bid.bidId} className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-600 w-48 truncate">{bid.bidderName}:</span>
                  <input
                    value={corrections[bid.bidId] || ''}
                    onChange={(e) => setCorrections(p => ({ ...p, [bid.bidId]: e.target.value }))}
                    disabled={solicitationAwarded}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Arithmetic correction note (optional)"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Step 2: Preference Margin &amp; Evaluated Price
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Evaluated Price = Bid Price &times; (1 - Margin/100). Used for RANKING only.
              Contract awarded at ACTUAL bid price.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Bid Price</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Margin</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Evaluated Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evaluatedBids.map((bid) => (
                    <tr key={bid.bidId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{bid.bidderName}</td>
                      <td className="px-4 py-2 text-right font-mono">{Number(bid.bidPrice).toLocaleString()}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-emerald-600 font-medium">-{bid.prefMargin}%</span>
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
              Financial Score = (Lowest Evaluated Price / This Evaluated Price) &times; 100
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-800">
                Lowest Evaluated Price: ZMW {lowestEvalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                {' '}({financialScores.find(b => b.evaluatedPrice === lowestEvalPrice)?.bidderName || ''})
              </p>
            </div>
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
                    <tr key={bid.bidId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{bid.bidderName}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {Number(bid.evaluatedPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-center font-mono font-bold text-emerald-600">
                        {bid.financialScore.toFixed(2)}
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
                Step 4: QCBS Combined Scores
              </h2>
              <div className="flex items-center gap-3">
                {computedQcbsData && (
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
                    {computeMutation.isPending ? 'Computing...' : 'Compute QCBS'}
                  </button>
                )}
              </div>
            </div>
            {!computedQcbsData && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-800 flex items-center gap-1">
                  <ExclamationIcon className="w-4 h-4 shrink-0" />
                  Preview — Click "Compute QCBS" to persist combined scores to backend and unlock winner selection.
                </p>
              </div>
            )}
            {qcbsResults.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Tech Score</th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">Financial Score</th>
                        <th className="px-4 py-2 text-center font-medium text-gray-500">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {qcbsResults.map((bid, i) => (
                        <tr key={bid.bidId} className={i === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-2 text-center font-medium text-gray-500">{i + 1}</td>
                          <td className="px-4 py-2 font-medium text-gray-900">
                            {bid.bidderName}
                            {i === 0 && <StarIcon className="w-4 h-4 text-yellow-500 inline ml-1" />}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">{bid.techScore.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right font-mono">{bid.financialScore.toFixed(2)}</td>
                          <td className="px-4 py-2 text-center font-mono font-bold text-lg text-emerald-600">
                            {bid.totalScore.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {computedQcbsData && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <InformationCircleIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-blue-800">
                          <strong>Recommended:</strong> {qcbsResults[0]?.bidderName || 'N/A'}
                        </p>
                        <p className="text-sm text-blue-800">
                          <strong>Contract Value:</strong> ZMW {Number(qcbsResults[0]?.bidPrice || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {!winnerSelected && computedQcbsData && qcbsResults.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Step 5: Select Winner</h2>
          <div className="space-y-3">
            {qcbsResults.map((bid) => (
              <div key={bid.bidId} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors">
                <div>
                  <p className="font-semibold text-gray-900">{bid.bidderName}</p>
                  <p className="text-sm text-gray-500">
                    QCBS: {bid.totalScore.toFixed(2)} | Price: ZMW {Number(bid.bidPrice).toLocaleString()}
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

      {(winnerSelected || solicitationAwarded) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              {awardedWinner ? `Winner Selected: ${awardedWinner}` : 'Awarded'}
            </h2>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Recommendation Notes</label>
            <textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Enter evaluation recommendation..."
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => navigate(`/evaluations/${solId}/consolidation`)}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50"
            >
              &larr; Back to Consolidation
            </button>
            <button
              onClick={() => navigate(`/evaluations/ber/${solId}`)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
            >
              Proceed to BER &rarr;
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
        message="This will award the contract to this bidder and mark all other bids as withdrawn. This action is irreversible."
        variant="warning"
        confirmText="Yes, Select as Winner"
      />

      <ConfirmModal
        open={showCalculateConfirm}
        onClose={() => setShowCalculateConfirm(false)}
        onConfirm={() => { setShowCalculateConfirm(false); computeMutation.mutate(); }}
        title="Compute QCBS?"
        message="This will compute combined scores using the backend server. Ensure all financial evaluations are complete."
        variant="info"
        confirmText="Compute"
        cancelText="Cancel"
      />
    </div>
  );
};

export default FinancialEvaluation;

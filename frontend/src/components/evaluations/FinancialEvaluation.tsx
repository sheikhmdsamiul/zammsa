import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmModal } from '../common/ConfirmModal';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, LockOpenIcon, StarIcon,
  InformationCircleIcon,
} from '@heroicons/react/outline';

const ceecPreferenceMap: Record<string, { label: string; margin: number }> = {
  citizen_owned: { label: 'Citizen-Owned 12%', margin: 12 },
  citizen_empowered: { label: 'Citizen-Empowered 8%', margin: 8 },
  citizen_influenced: { label: 'Citizen-Influenced 4%', margin: 4 },
  non_citizen: { label: 'None', margin: 0 },
};

const FinancialEvaluation: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [authorized, setAuthorized] = useState(false);
  const [winnerSelected, setWinnerSelected] = useState(false);
  const [winner, setWinner] = useState<string>('');
  const [confirmWinnerBid, setConfirmWinnerBid] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState('');
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [showQcbs, setShowQcbs] = useState(false);

  const { data: passedBidsData, isLoading: bidsLoading } = useQuery({
    queryKey: ['passed-tech-bids', solId],
    queryFn: () => evaluationsApi.listPassedTechBids(solId!),
    enabled: !!solId,
  });

  const passedBids = passedBidsData?.bids || [];
  const financialOpened = passedBids.some((b: any) => b.financial_sealed === false);
  const canManageFinancial = !!user && [ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.DIRECTOR_PROCUREMENT].includes(user.role as any);

  useEffect(() => {
    setAuthorized(financialOpened);
  }, [financialOpened]);

  const evaluatedBids = useMemo(() => {
    return passedBids
      .filter((b: any) => b.passed)
      .map((b: any) => {
        const pref = ceecPreferenceMap[b.preference_category || 'non_citizen'] || ceecPreferenceMap.non_citizen;
        const prefMargin = Number(b.preference_margin ?? pref.margin ?? 0);
        const price = Number(b.original_price || b.bid_price || 0);
        const evalPrice = b.evaluated_price != null ? Number(b.evaluated_price) : (price * (1 - prefMargin / 100));
        return {
          bidId: b.bid_id || b.id,
          bidderName: b.bidder_name || b.vendor_name || 'Unknown',
          bidPrice: price,
          ceec: b.preference_category || 'non_citizen',
          ceecLabel: pref.label,
          prefMargin,
          evaluatedPrice: evalPrice,
          techScore: b.overall_technical_score || 0,
        };
      });
  }, [passedBids]);

  // Financial scores: (Lowest Eval Price / This Eval Price) * 100
  const financialScores = useMemo(() => {
    if (evaluatedBids.length === 0) return [];
    const lowestEvalPrice = Math.min(...evaluatedBids.map(b => b.evaluatedPrice));
    return evaluatedBids.map(b => ({
      ...b,
      financialScore: lowestEvalPrice > 0 ? (lowestEvalPrice / b.evaluatedPrice) * 100 : 0,
    }));
  }, [evaluatedBids]);

  // QCBS: Tech 80% + Financial 20%
  const qcbsResults = useMemo(() => {
    return financialScores.map(b => {
      const techWeighted = b.techScore * 0.8;
      const finWeighted = b.financialScore * 0.2;
      const total = techWeighted + finWeighted;
      return {
        ...b,
        techWeighted,
        finWeighted,
        totalScore: total,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [financialScores]);

  const authorizeMutation = useMutation({
    mutationFn: () => evaluationsApi.authorizeFinancialOpening(solId!),
    onSuccess: (data: any) => {
      setAuthorized(true);
      toast.success(`Financial envelopes opened for ${data.opened_count} bids`);
      queryClient.invalidateQueries({ queryKey: ['passed-tech-bids', solId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to authorize opening'),
  });

  const selectWinnerMutation = useMutation({
    mutationFn: (bidId: string) => evaluationsApi.selectWinner(solId!, bidId),
    onSuccess: (data: any) => {
      setWinner(data.winner_name || 'Selected');
      setWinnerSelected(true);
      toast.success(`Winner selected: ${data.winner_name}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to select winner'),
  });

  if (bidsLoading) return <LoadingSpinner className="py-12" />;

  if (!canManageFinancial) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-500">
            Financial evaluation is restricted to the committee chair or the Director of Procurement.
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
            <StatusBadge status={financialOpened || authorized ? 'active' : 'draft'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">SOL-{solId?.slice(0, 8) || ''}</p>
        </div>
        {!financialOpened && !authorized && (
          <button
            onClick={() => authorizeMutation.mutate()}
            disabled={authorizeMutation.isPending}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <LockOpenIcon className="w-5 h-5" />
            Authorise Financial Envelope Opening
          </button>
        )}
      </div>

      {financialOpened && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <LockOpenIcon className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              🔓 Envelopes opened: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString()} CAT by {user?.full_name}
            </p>
          </div>
        </div>
      )}

      {!passedBids.length && !authorized && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-gray-500">No bids have passed technical evaluation yet.</p>
        </div>
      )}

      {passedBids.length > 0 && financialOpened && (
        <>
          {/* Step 1: Bid Price Review */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">STEP 1: Bid Price Review</h2>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Bid Price (ZMW)</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">CEEC Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evaluatedBids.map((bid: any) => (
                    <tr key={bid.bidId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{bid.bidderName}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold">{Number(bid.bidPrice).toLocaleString()}</td>
                      <td className="px-4 py-2 text-center text-xs font-medium">{bid.ceecLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-800">⚠ Review for arithmetic errors before proceeding</p>
              {evaluatedBids.map((bid: any) => (
                <div key={bid.bidId} className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-600 w-48 truncate">{bid.bidderName}:</span>
                  <input
                    value={corrections[bid.bidId] || ''}
                    onChange={(e) => setCorrections(p => ({ ...p, [bid.bidId]: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                    placeholder="No correction needed"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Preference Margin Application */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">STEP 2: Preference Margin Application</h2>
            <p className="text-xs text-gray-500 mb-3">
              Formula: Evaluated Price = Bid Price × (1 - Margin/100). Evaluated price used for RANKING only.
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
                  {evaluatedBids.map((bid: any) => (
                    <tr key={bid.bidId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{bid.bidderName}</td>
                      <td className="px-4 py-2 text-right font-mono">{Number(bid.bidPrice).toLocaleString()}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-zammsa-green font-medium">-{bid.prefMargin}%</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-zammsa-green">
                        {Number(bid.evaluatedPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 3: Financial Scores */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">STEP 3: Financial Scores</h2>
            <p className="text-xs text-gray-500 mb-3">
              Formula: Fin Score = (Lowest Evaluated Price / This Evaluated Price) × 100
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-800">
                Lowest Evaluated Price: ZMW {lowestEvalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                {' '}({(financialScores.find(b => b.evaluatedPrice === lowestEvalPrice))?.bidderName || ''})
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
                  {financialScores.map((bid: any) => (
                    <tr key={bid.bidId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{bid.bidderName}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {Number(bid.evaluatedPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-center font-mono font-bold text-zammsa-green">
                        {bid.financialScore.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 4: QCBS Combined Scores */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              STEP 4: QCBS Combined Scores <span className="text-xs text-gray-500 font-normal">(Tech 80% + Financial 20%)</span>
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Formula: Total = (Tech Score × 0.80) + (Fin Score × 0.20)
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Tech × 0.80</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Fin × 0.20</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {qcbsResults.map((bid: any, i: number) => (
                    <tr key={bid.bidId} className={i === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2 text-center font-medium text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {bid.bidderName}
                        {i === 0 && <StarIcon className="w-4 h-4 text-yellow-500 inline ml-1" />}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{bid.techWeighted.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono">{bid.finWeighted.toFixed(2)}</td>
                      <td className="px-4 py-2 text-center font-mono font-bold text-lg text-zammsa-green">
                        {bid.totalScore.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {qcbsResults.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800">
                      <strong>Recommended Bidder:</strong> {qcbsResults[0]?.bidderName || 'N/A'}
                    </p>
                    <p className="text-sm text-blue-800">
                      <strong>Contract Value:</strong> ZMW {Number(qcbsResults[0]?.bidPrice || 0).toLocaleString()} (actual bid price)
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Winner Selection */}
          {!winnerSelected && qcbsResults.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Winner</h2>
              <div className="space-y-3">
                {qcbsResults.map((bid: any) => (
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
                      className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold"
                    >
                      Select as Winner
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {winnerSelected && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                <h2 className="text-lg font-semibold text-gray-900">Winner Selected: {winner}</h2>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Recommendation Notes</label>
                <textarea
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg px-4 py-3 text-sm"
                  placeholder="Enter evaluation recommendation..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => navigate(`/evaluations/${solId}/consolidation`)}
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold"
                >
                  ← Back to Consolidation
                </button>
                <button
                  onClick={() => navigate(`/evaluations/ber/${solId}`)}
                  className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold"
                >
                  Proceed to BER →
                </button>
              </div>
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
        </>
      )}
    </div>
  );
};

export default FinancialEvaluation;

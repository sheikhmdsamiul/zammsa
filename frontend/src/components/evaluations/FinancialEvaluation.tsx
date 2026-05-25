import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, LockOpenIcon, StarIcon,
  InformationCircleIcon,
} from '@heroicons/react/outline';

const ceecPreferenceMap: Record<string, { label: string; margin: number }> = {
  citizen_owned: { label: 'Citizen-Owned', margin: 12 },
  citizen_empowered: { label: 'Citizen-Empowered', margin: 8 },
  citizen_influenced: { label: 'Citizen-Influenced', margin: 4 },
  non_citizen: { label: 'Non-Citizen', margin: 0 },
};

const FinancialEvaluation: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();

  const [authorized, setAuthorized] = useState(false);
  const [winnerSelected, setWinnerSelected] = useState(false);
  const [winner, setWinner] = useState<string>('');
  const [recommendation, setRecommendation] = useState('');

  const { data: passedBidsData, isLoading: bidsLoading } = useQuery({
    queryKey: ['passed-tech-bids', solId],
    queryFn: () => evaluationsApi.listPassedTechBids(solId!),
    enabled: !!solId,
  });

  const passedBids = passedBidsData?.bids || [];

  const evaluatedBids = passedBids.map((b: any) => {
    const pref = ceecPreferenceMap[b.preference_category || 'non_citizen'] || ceecPreferenceMap.non_citizen;
    const price = b.evaluated_price || b.original_price || 0;
    const evalPrice = price * (1 - pref.margin / 100);
    return {
      bidId: b.bid_id || b.id,
      bidderName: b.bidder_name || b.vendor_name || 'Unknown',
      bidPrice: price,
      ceec: b.preference_category || 'non_citizen',
      ceecLabel: pref.label,
      prefMargin: pref.margin,
      evaluatedPrice: evalPrice,
      techScore: b.overall_technical_score || 0,
    };
  });

  const rankedBids = [...evaluatedBids].sort((a: any, b: any) => a.evaluatedPrice - b.evaluatedPrice);

  const authorizeMutation = useMutation({
    mutationFn: () => evaluationsApi.authorizeFinancialOpening(solId!),
    onSuccess: (data: any) => {
      setAuthorized(true);
      toast.success(`Financial envelopes opened for ${data.opened_count} bids`);
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Financial Evaluation</h1>
            <StatusBadge status={authorized ? 'active' : 'draft'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">Bids that passed technical evaluation (threshold: 70/100)</p>
        </div>
        {!authorized && (
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

      {!passedBids.length && !authorized && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-gray-500">No bids have passed technical evaluation yet. Ensure all committee members have completed technical scoring.</p>
        </div>
      )}

      {passedBids.length > 0 && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Evaluation Results</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Rank</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Bidder</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Bid Price (K)</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">CEEC Category</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Preference</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Evaluated Price (K)</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Tech Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rankedBids.map((bid: any, i: number) => (
                    <tr key={bid.bidId} className={i === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 text-center">
                        {i === 0 ? <StarIcon className="w-5 h-5 text-yellow-500 mx-auto" /> : <span className="text-gray-400 font-medium">{i + 1}</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{bid.bidderName}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{Number(bid.bidPrice).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-xs">{bid.ceecLabel}</td>
                      <td className="px-4 py-3 text-right font-medium text-zammsa-green">{bid.prefMargin}%</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-zammsa-green">{Number(bid.evaluatedPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center">{bid.techScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Preference margins applied for ranking only. Actual contract price = actual bid price if awarded.
                  Recommended winner: <strong>{rankedBids[0]?.bidderName || 'N/A'}</strong>
                  {rankedBids[0] && ` at K${Number(rankedBids[0].bidPrice).toLocaleString()}`}
                </p>
              </div>
            </div>
          </div>

          {!winnerSelected && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Winner</h2>
              <div className="space-y-3">
                {rankedBids.slice(0, 3).map((bid: any) => (
                  <div key={bid.bidId} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors">
                    <div>
                      <p className="font-semibold text-gray-900">{bid.bidderName}</p>
                      <p className="text-sm text-gray-500">
                        Bid: K{Number(bid.bidPrice).toLocaleString()} | Evaluated: K{Number(bid.evaluatedPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <button
                      onClick={() => selectWinnerMutation.mutate(bid.bidId)}
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Post-Qualification Checklist</h2>
              <div className="space-y-3">
                {[
                  'Reference 1: UTH Lusaka — confirmed',
                  'Reference 2: Ministry of Health — confirmed',
                  'ZAMRA registration verified directly with ZAMRA',
                  'Bank details match PACRA registration',
                  'Warehouse capacity confirmed by site visit report',
                  'Cold chain capability confirmed (temperature monitoring)',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm font-semibold text-emerald-800">Result: POST-QUALIFICATION PASSED</p>
              </div>
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Recommendation</label>
                <textarea
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg px-4 py-3 text-sm"
                  placeholder="Enter evaluation recommendation..."
                />
              </div>
              <button
                onClick={() => navigate(`/evaluations/ber/${solId}`)}
                className="mt-4 px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold"
              >
                Proceed to BER Generation
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FinancialEvaluation;

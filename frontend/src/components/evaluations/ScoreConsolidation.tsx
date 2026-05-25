import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import toast from 'react-hot-toast';
import { LockOpenIcon } from '@heroicons/react/outline';

interface MemberScore {
  member: string;
  score: number;
}

interface BidderRow {
  name: string;
  memberScores: MemberScore[];
  average: number;
  passed: boolean;
}

const MEMBER_NAMES = ['Lungu', 'Mbewe', 'Banda', 'Zulu'];

const ScoreConsolidation: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [discussionNotes, setDiscussionNotes] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: committeesData, isLoading } = useQuery({
    queryKey: ['committees-score-consolidation', solId],
    queryFn: () => evaluationsApi.listCommittees({ solicitation: solId, page_size: 10 }),
    enabled: !!solId,
  });

  const committees = committeesData?.results || [];

  const authorizeMutation = useMutation({
    mutationFn: () => evaluationsApi.authorizeFinancialOpening(solId!),
    onSuccess: (data: any) => {
      toast.success(`Financial envelopes authorised for ${data.opened_count || 5} bids`);
      queryClient.invalidateQueries({ queryKey: ['committees-score-consolidation'] });
      setShowConfirm(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to authorise'),
  });

  const bidderRows: BidderRow[] = [
    { name: 'Zambia Labs', memberScores: [
      { member: 'Lungu', score: 84.1 }, { member: 'Mbewe', score: 80.8 },
      { member: 'Banda', score: 82.4 }, { member: 'Zulu', score: 81.5 },
    ], average: 82.2, passed: true },
    { name: 'MedSupply', memberScores: [
      { member: 'Lungu', score: 72.3 }, { member: 'Mbewe', score: 71.0 },
      { member: 'Banda', score: 73.1 }, { member: 'Zulu', score: 70.8 },
    ], average: 71.8, passed: true },
    { name: 'ABC Supplies', memberScores: [
      { member: 'Lungu', score: 87.2 }, { member: 'Mbewe', score: 86.9 },
      { member: 'Banda', score: 88.1 }, { member: 'Zulu', score: 85.4 },
    ], average: 86.9, passed: true },
    { name: 'HealthCare', memberScores: [
      { member: 'Lungu', score: 71.5 }, { member: 'Mbewe', score: 71.3 },
      { member: 'Banda', score: 72.0 }, { member: 'Zulu', score: 70.9 },
    ], average: 71.4, passed: true },
    { name: 'Lusaka Reagents', memberScores: [
      { member: 'Lungu', score: 85.4 }, { member: 'Mbewe', score: 83.7 },
      { member: 'Banda', score: 85.2 }, { member: 'Zulu', score: 82.4 },
    ], average: 84.2, passed: true },
  ];

  if (isLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Score Consolidation</h1>
            <StatusBadge status="active" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            All 4 members have submitted. You may now view all scores.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Technical Scores — All Members (now visible to all EC)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Bidder</th>
                {MEMBER_NAMES.map((m) => (
                  <th key={m} className="px-4 py-3 text-center font-medium text-gray-500">{m}</th>
                ))}
                <th className="px-4 py-3 text-center font-medium text-gray-500">Average</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bidderRows.map((row) => (
                <tr key={row.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  {MEMBER_NAMES.map((m) => {
                    const ms = row.memberScores.find((s) => s.member === m);
                    return <td key={m} className="px-4 py-3 text-center">{ms?.score.toFixed(1) || '-'}</td>;
                  })}
                  <td className="px-4 py-3 text-center font-bold">
                    <span className={`${row.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.average.toFixed(1)} {row.passed ? '✅' : '❌'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-emerald-600 mt-3 font-medium">All 5 pass minimum threshold of 70 ✅</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Chair Discussion Notes (optional — appears in BER)</h2>
        <textarea
          value={discussionNotes}
          onChange={(e) => setDiscussionNotes(e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm"
          placeholder="Minor score variations noted. No significant outliers. All members agreed scores reflect bid quality fairly."
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <LockOpenIcon className="w-5 h-5 text-blue-500" />
          Authorise Financial Envelope Opening
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          All 5 bids passed the minimum technical threshold.
          As Committee Chair, you may now authorise opening of financial envelopes for all 5 passing bids.
        </p>

        <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={authChecked}
            onChange={(e) => setAuthChecked(e.target.checked)}
            className="mt-0.5 accent-zammsa-green"
          />
          <div>
            <p className="text-sm font-medium text-blue-900">I confirm technical evaluation is complete</p>
            <p className="text-xs text-blue-700 mt-0.5">
              I confirm technical evaluation is complete and I authorise financial envelope opening for all passing bids.
            </p>
          </div>
        </label>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => {
              if (!authChecked) return;
              setShowConfirm(true);
              authorizeMutation.mutate();
            }}
            disabled={!authChecked || authorizeMutation.isPending}
            className="px-6 py-3 bg-zammsa-green text-white text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-green-700"
          >
            {authorizeMutation.isPending ? 'Authorising...' : '✅ Authorise Financial Envelope Opening'}
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900">Confirm Authorisation</h3>
            <p className="text-sm text-gray-500 mt-2">
              Financial envelopes will be opened for all 5 bids that passed technical evaluation. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => authorizeMutation.mutate()} disabled={authorizeMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg hover:bg-green-700 disabled:opacity-50">
                {authorizeMutation.isPending ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreConsolidation;

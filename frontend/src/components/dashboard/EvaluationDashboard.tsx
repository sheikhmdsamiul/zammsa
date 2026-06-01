import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchEvaluationDashboard } from '../../api/dashboards';
import { evaluationsApi } from '../../api/evaluations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAppSelector } from '../../hooks/useRedux';

const ROLES = {
  MEMBER: 'evaluation_committee_member',
  CHAIR: 'evaluation_committee_chair',
};

const EvaluationDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isChair = user?.role === ROLES.CHAIR;
  const [pollInterval] = useState(30000);
  const [memberTab, setMemberTab] = useState<'dashboard' | 'scoring'>('dashboard');

  const [showSign, setShowSign] = useState(false);
  const [signPassword, setSignPassword] = useState('');
  const [signId, setSignId] = useState<string | null>(null);
  const [discussionNotes, setDiscussionNotes] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['evaluationDashboard'],
    queryFn: () => fetchEvaluationDashboard(user?.id),
    refetchInterval: pollInterval,
  });

  const openFinMut = useMutation({
    mutationFn: (id: string) => evaluationsApi.authorizeFinancialOpening(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['evaluationDashboard'] }); toast.success('Financial envelope opening authorised'); },
    onError: (err: any) => toast.error(err?.message || 'Failed to authorise'),
  });

  const genBERMut = useMutation({
    mutationFn: (id: string) => evaluationsApi.generateBER(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['evaluationDashboard'] }); toast.success('BER generated'); },
    onError: (err: any) => toast.error(err?.message || 'BER generation failed'),
  });

  const signBERMut = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => evaluationsApi.signBER(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['evaluationDashboard'] }); toast.success('BER signed successfully'); setShowSign(false); setSignPassword(''); setSignId(null); },
    onError: (err: any) => toast.error(err?.message || 'Signing failed'),
  });

  if (isLoading) return <LoadingSpinner />;

  const assignments = data?.assignments || [];
  const coiNeeded = assignments.filter((a: any) => a.status === 'coi_needed' || a.status === 'pending_coi');
  const prelimPending = assignments.filter((a: any) => a.status === 'preliminary' || a.status === 'preliminary_pending');
  const scoringPending = assignments.filter((a: any) => a.status === 'scoring' || a.status === 'scoring_pending');

  if (isChair) {
    const finAuthPending = assignments.filter((a: any) => a.status === 'tech_scoring_complete');
    const berReady = assignments.filter((a: any) => a.status === 'post_qual_complete');
    const postQualNeeded = assignments.filter((a: any) => a.status === 'financial_complete');

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard — {user?.full_name}, Evaluation Committee Chair</h1>
            <p className="text-sm text-gray-500">Dr. Grace Lungu | ZAMMSA Procurement Oversight</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Evaluation Active</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{assignments.length}</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{assignments.length} Active
            </span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">BERs Ready to Generate</p>
            <p className="text-3xl font-bold text-amber-500 mt-1">{berReady.length}</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{berReady.length} Pending
            </span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Financial Env. Auth Needed</p>
            <p className="text-3xl font-bold text-amber-500 mt-1">{finAuthPending.length}</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{finAuthPending.length} Waiting
            </span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Post-Qual Needed</p>
            <p className="text-3xl font-bold text-amber-500 mt-1">{postQualNeeded.length}</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{postQualNeeded.length} Pending
            </span>
          </div>
        </div>

        {/* Action Required */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" /> ACTION REQUIRED
            </h2>
            <div className="space-y-3">
              {finAuthPending.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-900">SOL-2026-LAB-07</p>
                  <p className="text-xs text-amber-700 mt-1">All 4 members scored → Authorise Fin. Env.</p>
                  <button
                    onClick={() => navigate(`/evaluations/${assignments[0]?.id}/scoring`)}
                    className="mt-2 px-4 py-1.5 text-xs font-bold text-white bg-zammsa-green rounded-lg hover:bg-green-700"
                  >
                    View Scores & Authorise Financial Envelope Opening
                  </button>
                </div>
              )}
              {berReady.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-900">SOL-2026-IT-02</p>
                  <p className="text-xs text-amber-700 mt-1">Post-qualification complete → Generate BER</p>
                  <button
                    onClick={() => navigate(`/evaluations/ber/${assignments[0]?.id}`)}
                    className="mt-2 px-4 py-1.5 text-xs font-bold text-white bg-zammsa-green rounded-lg hover:bg-green-700"
                  >
                    Generate BER
                  </button>
                </div>
              )}
              {finAuthPending.length === 0 && berReady.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No immediate action required</p>
              )}
            </div>
          </div>

          {/* Evaluation Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">SOL-2026-LAB-07 — Evaluation Status</h2>
            <div className="space-y-2">
              {[
                { label: 'Preliminary Examination', status: 'complete', detail: '5 of 6 passed' },
                { label: 'Technical Scoring', status: 'complete', detail: 'all 4 members scored' },
                { label: 'Financial Envelopes', status: 'pending', detail: 'Awaiting your authorisation' },
                { label: 'Financial Evaluation', status: 'waiting', detail: 'Pending' },
                { label: 'Post-Qualification', status: 'waiting', detail: 'Pending' },
                { label: 'BER Generation', status: 'waiting', detail: 'Pending' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      item.status === 'complete' ? 'bg-emerald-500' :
                      item.status === 'pending' ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                    <span className={`text-sm ${
                      item.status === 'waiting' ? 'text-gray-400' : 'text-gray-700'
                    }`}>{item.label}</span>
                  </div>
                  <span className={`text-xs font-medium ${
                    item.status === 'complete' ? 'text-emerald-600' :
                    item.status === 'pending' ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {item.status === 'complete' ? '✅ ' : item.status === 'pending' ? '🔴 ' : '⏳ '}
                    {item.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Score Consolidation */}
        {data?.scoring_matrix && data.scoring_matrix.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Score Consolidation — SOL-2026-LAB-07</h2>
            <p className="text-xs text-gray-500 mb-4">All 4 members have submitted. You may now view all scores.</p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Bidder</th>
                    {['Lungu (You)', 'Mbewe', 'Banda', 'Zulu'].map((m) => (
                      <th key={m} className="px-4 py-3 text-center font-medium text-gray-500">{m}</th>
                    ))}
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.scoring_matrix[0]?.scores.map((s: any, i: number) => {
                    const memberScores = data.scoring_matrix.map((c: any) =>
                      c.scores.find((x: any) => x.bidder === s.bidder)?.score || 0
                    );
                    const avg = memberScores.reduce((a: number, b: number) => a + b, 0) / Math.max(memberScores.length, 1);
                    return (
                      <tr key={s.bidder} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{s.bidder}</td>
                        <td className="px-4 py-3 text-center">{memberScores[0]?.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center">{memberScores[1]?.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center">{memberScores[2]?.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center">{memberScores[3]?.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center font-bold">
                          <span className={`${avg >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {avg.toFixed(1)} {avg >= 70 ? '✅' : '❌'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-emerald-600 mt-2 font-medium">All 5 pass minimum threshold of 70 ✅</p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Chair Discussion Notes (optional — appears in BER)</label>
              <textarea
                value={discussionNotes}
                onChange={(e) => setDiscussionNotes(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm"
                placeholder="Enter discussion notes..."
              />
            </div>

            <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={authChecked}
                  onChange={(e) => setAuthChecked(e.target.checked)}
                  className="mt-0.5 accent-zammsa-green"
                />
                <div>
                  <p className="text-sm font-medium text-blue-900">Confirm technical evaluation is complete</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    I confirm technical evaluation is complete and I authorise financial envelope opening for all passing bids.
                  </p>
                </div>
              </label>
              <button
                onClick={() => {
                  const id = assignments[0]?.id;
                  if (id) openFinMut.mutate(id);
                }}
                disabled={!authChecked || openFinMut.isPending}
                className="mt-3 px-6 py-2 bg-zammsa-green text-white text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-green-700"
              >
                {openFinMut.isPending ? 'Authorising...' : '✅ Authorise Financial Envelope Opening'}
              </button>
            </div>
          </div>
        )}

        {/* Generate BER Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Bid Evaluation Report — SOL-2026-LAB-07</h2>

          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-emerald-900 mb-3">Post-Qualification Checklist — Lusaka Reagents Ltd</h3>
            <div className="space-y-2">
              {[
                'Reference 1: UTH Lusaka — Verified by J. Mbewe',
                'Reference 2: Ministry of Health — Verified',
                'ZAMRA registration verified directly',
                'Bank details match PACRA',
                'Warehouse and cold chain capacity confirmed',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-emerald-800">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                  {item}
                </div>
              ))}
              <p className="text-sm font-bold text-emerald-800 mt-2">RESULT: ✅ POST-QUALIFICATION PASSED</p>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-900 mb-3">Final Ranking (system calculated)</h3>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Bidder</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Bid Price K</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-500">CEEC %</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Eval. Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { rank: 1, name: '🥇 Lusaka Reagents', price: '1,155,000', ceec: '12%', evalPrice: '1,016,400' },
                  { rank: 2, name: 'HealthCare Distrib.', price: '1,095,000', ceec: '4%', evalPrice: '1,051,200' },
                  { rank: 3, name: 'Zambia Labs', price: '1,180,000', ceec: '8%', evalPrice: '1,085,600' },
                  { rank: 4, name: 'ABC Office Supplies', price: '1,245,000', ceec: '12%', evalPrice: '1,095,600' },
                  { rank: 5, name: 'MedSupply Zambia', price: '1,320,000', ceec: '0%', evalPrice: '1,320,000' },
                ].map((row) => (
                  <tr key={row.rank} className={row.rank === 1 ? 'bg-emerald-50' : ''}>
                    <td className="px-4 py-2 font-medium">{row.rank}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{row.price}</td>
                    <td className="px-4 py-2 text-center">{row.ceec}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-zammsa-green">{row.evalPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-700">
              6 bids received. 1 eliminated (expired ZRA). 5 evaluated.<br />
              All passed technical threshold. Preference scheme applied.<br />
              Lusaka Reagents recommended: lowest evaluated price K1,016,400<br />
              Post-qualification passed. Award value: K1,155,000.
            </p>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <p className="text-sm font-medium text-gray-700">Committee Signatures:</p>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">✅ Grace Lungu (Chair)</span>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">✅ John Mbewe</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-medium">⏳ Faith Banda</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-medium">⏳ Zulu</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                const id = assignments[0]?.id;
                if (id) genBERMut.mutate(id);
              }}
              disabled={genBERMut.isPending}
              className="px-6 py-2 bg-zammsa-green text-white text-sm font-bold rounded-lg disabled:opacity-50"
            >
              {genBERMut.isPending ? 'Generating...' : 'Generate BER PDF'}
            </button>
            <button
              onClick={() => {
                const id = assignments[0]?.id;
                if (id) { setSignId(id); setShowSign(true); }
              }}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700"
            >
              Submit BER to ZPC for Approval
            </button>
          </div>
        </div>

        {showSign && (
          <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900">Sign BER</h3>
              <p className="text-sm text-gray-500 mt-2">Enter your password to digitally sign the Bid Evaluation Report:</p>
              <input
                type="password"
                value={signPassword}
                onChange={(e) => setSignPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm mt-3"
                placeholder="Enter password..."
              />
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setShowSign(false); setSignPassword(''); setSignId(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => signId && signBERMut.mutate({ id: signId, password: signPassword })} disabled={signBERMut.isPending} className="px-4 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg hover:bg-green-700 disabled:opacity-50">{signBERMut.isPending ? 'Processing...' : 'Sign'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard — {user?.full_name}, Evaluation Committee Member</h1>
          <p className="text-sm text-gray-500">ZAMMSA Procurement Oversight</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMemberTab('dashboard')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${memberTab === 'dashboard' ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-600'}`}>Dashboard</button>
          <button onClick={() => setMemberTab('scoring')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${memberTab === 'scoring' ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-600'}`}>My Evaluations</button>
        </div>
      </div>

      {memberTab === 'dashboard' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">COI Decl. Needed</p>
              <p className="text-3xl font-bold text-red-500 mt-1">{coiNeeded.length}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{coiNeeded.length} Pending
              </span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Prelim. Pending</p>
              <p className="text-3xl font-bold text-amber-500 mt-1">{prelimPending.length}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{prelimPending.length} Pending
              </span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Technical Scoring</p>
              <p className="text-3xl font-bold text-amber-500 mt-1">{scoringPending.length}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{scoringPending.length} Pending
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-red-600 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" /> IMMEDIATE ACTION REQUIRED
            </h2>
            <div className="space-y-3">
              {coiNeeded.length > 0 ? coiNeeded.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between border border-red-200 bg-red-50 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-red-900">{a.solicitation}</p>
                    <p className="text-xs text-red-700">COI Declaration Required</p>
                  </div>
                  <button onClick={() => navigate(`/evaluations/${a.id}`)} className="px-4 py-1.5 text-xs font-bold text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50">Declare Now</button>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-4">All COI declarations completed</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">My Active Assignments</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Solicitation</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Stage</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignments.map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{a.solicitation}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.status === 'coi_needed' || a.status === 'pending_coi' ? 'bg-red-100 text-red-700' :
                          a.status === 'pending' || a.status === 'scoring_pending' ? 'bg-amber-100 text-amber-700' :
                          a.status === 'scoring' ? 'bg-blue-100 text-blue-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            a.status === 'coi_needed' || a.status === 'pending_coi' ? 'bg-red-500' :
                            a.status === 'pending' || a.status === 'scoring_pending' ? 'bg-amber-500' :
                            a.status === 'scoring' ? 'bg-blue-500' :
                            'bg-emerald-500'
                          }`} />
                          {a.status === 'coi_needed' || a.status === 'pending_coi' ? '🔴 COI Needed' :
                           a.status === 'scoring' ? '🟡 Technical Scoring' :
                           a.status === 'completed' ? '✅ Completed' : '🟡 Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.status === 'coi_needed' || a.status === 'pending_coi' ? (
                          <button onClick={() => navigate(`/evaluations/${a.id}`)} className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">Declare COI</button>
                        ) : a.status === 'scoring' ? (
                          <button onClick={() => navigate(`/evaluations/${a.id}/scoring`)} className="px-3 py-1 text-xs font-medium text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg hover:bg-zammsa-green/10">Score Bids</button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No assignments</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Annual COI Declaration Status</h2>
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <p className="text-sm font-medium text-emerald-900">Completed: 15 Jan 2026 — valid for calendar year 2026</p>
                <p className="text-xs text-emerald-700">Annual declaration on file</p>
              </div>
            </div>
          </div>
        </>
      )}

      {memberTab === 'scoring' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">My Evaluations</h2>
                <p className="text-sm text-gray-500 mt-1">Open your assigned committee to continue with COI, Technical Scoring, Financial Evaluation, and BER.</p>
              </div>
              <button
                onClick={() => navigate('/evaluations')}
                className="px-4 py-2 text-sm font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg hover:bg-zammsa-green/10"
              >
                View Committee List
              </button>
            </div>

            <div className="space-y-3">
              {assignments.length > 0 ? assignments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{a.solicitation || 'Assigned solicitation'}</p>
                    <p className="text-xs text-gray-500 mt-1">Status: {a.status || 'pending'}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/evaluations/${a.id}`)}
                    className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold hover:bg-green-700"
                  >
                    Open Committee
                  </button>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-6">No evaluation assignments found.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow Steps</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="font-semibold text-gray-900">Technical Scoring</p>
                <p className="text-gray-500 mt-1">Open the committee and use the scoring tab once COI is complete.</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="font-semibold text-gray-900">Financial Evaluation</p>
                <p className="text-gray-500 mt-1">Chair or delegated procurement lead can move to financial evaluation after technical consolidation.</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="font-semibold text-gray-900">BER</p>
                <p className="text-gray-500 mt-1">Generate, sign, submit to ZPC, and review the approval status from the BER workflow.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluationDashboard;

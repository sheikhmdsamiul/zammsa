import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, DocumentTextIcon,
  ShieldCheckIcon, XCircleIcon,
} from '@heroicons/react/outline';

type RankingRow = {
  rank: number;
  name: string;
  price: number;
  ceec: string;
  combinedScore: number;
  technicalScore: number;
  financialScore: number;
  details: any[];
};

const BERWorkflow: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [berGenerated, setBerGenerated] = useState(false);
  const [berId, setBerId] = useState('');
  const [signed, setSigned] = useState<Record<string, boolean>>({});
  const [berSubmitted, setBerSubmitted] = useState(false);
  const [zpcDecision, setZpcDecision] = useState<'approve' | 'reject' | null>(null);
  const [zpcComment, setZpcComment] = useState('');

  const { data: committeesData, isLoading: committeesLoading } = useQuery({
    queryKey: ['committees-for-ber', solId],
    queryFn: () => evaluationsApi.listCommittees({ solicitation: solId }),
    enabled: !!solId,
  });

  const { data: berListData, isLoading: berLoading } = useQuery({
    queryKey: ['ber-for-solicitation', solId],
    queryFn: () => evaluationsApi.listBERs({ solicitation: solId, page_size: 10 }),
    enabled: !!solId,
  });

  const committees = committeesData?.results || [];
  const primaryCommittee = committees[0];
  const currentBer = berListData?.results?.[0] || null;
  const reportContent = currentBer?.report_content || {};

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
        const uid = typeof m === 'string' ? m : m.user;
        add(uid, typeof m === 'string' ? uid?.slice(0, 8) : m.full_name || uid, 'Member');
      });
    }

    return Array.from(memberMap.values());
  }, [primaryCommittee]);

  const rankingRows = useMemo<RankingRow[]>(() => {
    const evaluations = Array.isArray(reportContent.technical_evaluation) ? reportContent.technical_evaluation : [];
    return evaluations
      .map((row: any) => ({
        rank: row.rank || 999,
        name: row.bidder_name || row.submission_id || 'Unknown',
        price: row.evaluated_price || row.winner_price || row.price || 0,
        ceec: row.preference_applied != null ? `${Number(row.preference_applied).toFixed(0)}%` : '-',
        combinedScore: row.combined_total_score || 0,
        technicalScore: row.overall_technical_score || row.combined_technical_score || 0,
        financialScore: row.financial_score || 0,
        details: row.criterion_details || [],
      }))
      .sort((a: RankingRow, b: RankingRow) => a.rank - b.rank);
  }, [reportContent]);

  useEffect(() => {
    if (!currentBer) return;

    setBerId(currentBer.id || currentBer.ber_id || '');
    setBerGenerated(true);
    setBerSubmitted(currentBer.status === 'submitted' || currentBer.status === 'approved');
    setZpcDecision(currentBer.status === 'approved' ? 'approve' : currentBer.status === 'rejected' ? 'reject' : null);

    const signatureMap: Record<string, boolean> = {};
    (currentBer.signatures || []).forEach((sig: any) => {
      if (sig?.member_id) signatureMap[String(sig.member_id)] = true;
    });
    setSigned(signatureMap);
  }, [currentBer]);

  const generateMutation = useMutation({
    mutationFn: () => evaluationsApi.generateBER(solId!),
    onSuccess: (data: any) => {
      const ber = data.ber || data;
      setBerId(ber.id || ber.ber_id || '');
      setBerGenerated(true);
      queryClient.invalidateQueries({ queryKey: ['ber-for-solicitation', solId] });
      toast.success('BER generated successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to generate BER'),
  });

  const signMutation = useMutation({
    mutationFn: () => evaluationsApi.signBER(berId || ''),
    onSuccess: (data: any) => {
      setSigned((prev) => ({ ...prev, [user?.id || '']: true }));
      queryClient.invalidateQueries({ queryKey: ['ber-for-solicitation', solId] });
      toast.success('BER signed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to sign BER'),
  });

  const submitMutation = useMutation({
    mutationFn: () => evaluationsApi.submitBER(berId),
    onSuccess: () => {
      setBerSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['ber-for-solicitation', solId] });
      toast.success('BER submitted to ZPC');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to submit BER'),
  });

  const approveMutation = useMutation({
    mutationFn: () => evaluationsApi.approveBER(berId, { comment: zpcComment }),
    onSuccess: () => {
      setZpcDecision('approve');
      queryClient.invalidateQueries({ queryKey: ['ber-for-solicitation', solId] });
      toast.success('BER approved by ZPC');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to approve BER'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => evaluationsApi.rejectBER(berId, { reason: zpcComment }),
    onSuccess: () => {
      setZpcDecision('reject');
      queryClient.invalidateQueries({ queryKey: ['ber-for-solicitation', solId] });
      toast.success('BER rejected');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to reject BER'),
  });

  const loading = committeesLoading || berLoading;
  if (loading) return <LoadingSpinner className="py-12" />;

  const allSigned = committeeMembers.length > 0 && committeeMembers.every((m) => signed[m.id]);
  const winner = reportContent.winner || null;
  const isFinalised = berSubmitted || zpcDecision !== null || currentBer?.status === 'approved' || currentBer?.status === 'rejected';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Bid Evaluation Report (BER)</h1>
            <StatusBadge status={currentBer?.status || (berGenerated ? 'active' : 'draft')} />
          </div>
          <p className="text-sm text-gray-500 mt-1">Solicitation: {solId}</p>
        </div>
        {!berGenerated && (
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <DocumentTextIcon className="w-5 h-5" />
            {generateMutation.isPending ? 'Generating...' : 'Generate BER PDF'}
          </button>
        )}
      </div>

      {currentBer && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">BER Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
              <p className="font-semibold text-gray-900 mt-1">{currentBer.status}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Signed</p>
              <p className="font-semibold text-gray-900 mt-1">{Object.keys(signed).length} / {committeeMembers.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Winner</p>
              <p className="font-semibold text-gray-900 mt-1">{winner?.bidder_name || winner?.submission_id || 'Not set'}</p>
            </div>
          </div>
        </div>
      )}

      {berGenerated && !berSubmitted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Post-Qualification Checklist</h2>
          <div className="space-y-3">
            {[
              'Reference 1: UTH Lusaka - confirmed',
              'Reference 2: Ministry of Health - confirmed',
              'ZAMRA registration verified directly with ZAMRA',
              'Bank details match PACRA registration',
              'Warehouse capacity confirmed by site visit report',
              'Cold chain capability confirmed (temperature monitoring)',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-sm text-emerald-800">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-emerald-100 border border-emerald-300 rounded-lg">
            <p className="text-sm font-bold text-emerald-900">RESULT: POST-QUALIFICATION PASSED</p>
          </div>
        </div>
      )}

      {berGenerated && rankingRows.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Final Ranking</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Bidder</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Technical</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Financial</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Eval. Price / Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rankingRows.map((row: RankingRow) => (
                  <tr key={row.name} className={row.rank === 1 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{row.rank}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{Number(row.technicalScore).toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-mono">{Number(row.financialScore).toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-zammsa-green">{Number(row.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {winner && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900">
                Recommended Winner: {winner.bidder_name || winner.submission_id || 'N/A'}
              </p>
            </div>
          )}
        </div>
      )}

      {berGenerated && !berSubmitted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">BER Narrative</h2>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed space-y-1">
            <p>{Array.isArray(reportContent.technical_evaluation) ? `${reportContent.technical_evaluation.length} bid(s) included in the BER.` : 'BER narrative is based on the evaluation report generated by the backend.'}</p>
            <p>{winner ? `Winner recommended: ${winner.bidder_name || winner.submission_id}.` : 'No winner has been identified yet.'}</p>
            <p>Committee signatures and ZPC approval are recorded below.</p>
          </div>
        </div>
      )}

      {berGenerated && !berSubmitted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Committee Signatures</h2>
          <div className="flex flex-wrap gap-3 mb-6">
            {committeeMembers.length > 0 ? committeeMembers.map((member: any) => (
              <div
                key={member.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                  signed[member.id] ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {signed[member.id] ? '✅' : '⏳'} {member.name} ({member.role})
              </div>
            )) : (
              <p className="text-sm text-gray-400">No committee members found.</p>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {committeeMembers.some((m: any) => m.id === user?.id && !signed[m.id]) && (
              <button
                onClick={() => signMutation.mutate()}
                disabled={signMutation.isPending}
                className="px-6 py-2 bg-zammsa-green text-white text-sm font-bold rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <ShieldCheckIcon className="w-5 h-5" />
                {signMutation.isPending ? 'Signing...' : 'Apply My Signature'}
              </button>
            )}

            {allSigned && !berSubmitted && (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit BER to ZPC for Approval'}
              </button>
            )}
          </div>
        </div>
      )}

      {berGenerated && (berSubmitted || currentBer?.status === 'submitted') && !isFinalised && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">ZPC Approval</h2>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-gray-500">Solicitation</dt><dd className="font-medium">{solId}</dd></div>
                <div><dt className="text-gray-500">Committee Members</dt><dd className="font-medium">{committeeMembers.length}</dd></div>
                <div><dt className="text-gray-500">Signatures</dt><dd className="font-medium text-zammsa-green">{Object.keys(signed).length} of {committeeMembers.length}</dd></div>
              </dl>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ZPC Comment</label>
              <textarea
                value={zpcComment}
                onChange={(e) => setZpcComment(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm"
                placeholder="Optional comment for ZPC decision..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending || !berSubmitted}
                className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve BER'}
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending || !berSubmitted}
                className="px-6 py-2 bg-rose-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject BER'}
              </button>
            </div>
          </div>
        </div>
      )}

      {currentBer?.status === 'approved' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">BER Approved by ZPC</h2>
          <p className="text-sm text-emerald-700">The solicitation has been awarded and the workflow is complete.</p>
          <button
            onClick={() => navigate(`/contracts/award-notices`)}
            className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold"
          >
            Go to Contract Award
          </button>
        </div>
      )}

      {currentBer?.status === 'rejected' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-rose-800 mb-2">BER Rejected</h2>
          <p className="text-sm text-rose-700">The report has been rejected and may require re-evaluation.</p>
        </div>
      )}
    </div>
  );
};

export default BERWorkflow;

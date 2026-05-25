import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, DocumentTextIcon,
  ShieldCheckIcon, XCircleIcon,
} from '@heroicons/react/outline';

const BERWorkflow: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [berGenerated, setBerGenerated] = useState(false);
  const [berId, setBerId] = useState('');
  const [signed, setSigned] = useState<Record<string, boolean>>({});
  const [berSubmitted, setBerSubmitted] = useState(false);
  const [zpcDecision, setZpcDecision] = useState<'approve' | 'reject' | null>(null);
  const [zpcComment, setZpcComment] = useState('');

  const { data: committeesData } = useQuery({
    queryKey: ['committees-for-ber', solId],
    queryFn: () => evaluationsApi.listCommittees({ solicitation: solId }),
    enabled: !!solId,
  });

  const committees = committeesData?.results || [];
  const committeeMembers = committees.flatMap((c: any) => {
    const members: { id: string; name: string; role: string }[] = [];
    if (c.chairperson) {
      members.push({ id: c.chairperson, name: c.chairperson_name || c.chairperson, role: 'Chair' });
    }
    if (c.secretary) {
      members.push({ id: c.secretary, name: c.secretary_name || c.secretary, role: 'Secretary' });
    }
    (c.members || []).forEach((m: any) => {
      const uid = typeof m === 'string' ? m : m.user;
      members.push({ id: uid, name: typeof m === 'string' ? uid.slice(0, 8) : m.full_name || uid, role: 'Member' });
    });
    return members;
  });

  const generateMutation = useMutation({
    mutationFn: () => evaluationsApi.generateBER(solId!),
    onSuccess: (data: any) => {
      const ber = data.ber || data;
      setBerId(ber.id || ber.ber_id || '');
      setBerGenerated(true);
      toast.success('BER generated successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to generate BER'),
  });

  const signMutation = useMutation({
    mutationFn: () => evaluationsApi.signBER(berId || ''),
    onSuccess: (data: any) => {
      setSigned(prev => ({ ...prev, [user?.id || '']: true }));
      toast.success('BER signed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to sign BER'),
  });

  const submitMutation = useMutation({
    mutationFn: () => evaluationsApi.submitBER(berId),
    onSuccess: () => {
      setBerSubmitted(true);
      toast.success('BER submitted to ZPC');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to submit BER'),
  });

  const approveMutation = useMutation({
    mutationFn: () => evaluationsApi.approveBER(berId, { comment: zpcComment }),
    onSuccess: () => {
      setZpcDecision('approve');
      toast.success('BER approved by ZPC');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to approve BER'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => evaluationsApi.rejectBER(berId, { reason: zpcComment }),
    onSuccess: () => {
      setZpcDecision('reject');
      toast.success('BER rejected');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to reject BER'),
  });

  const allSigned = committeeMembers.length > 0 && committeeMembers.every(m => signed[m.id]);

  const rankingRows = [
    { rank: 1, name: '🥇 Lusaka Reagents Ltd', price: '1,155,000', ceec: '12%', evalPrice: '1,016,400' },
    { rank: 2, name: 'HealthCare Distributors', price: '1,095,000', ceec: '4%', evalPrice: '1,051,200' },
    { rank: 3, name: 'Zambia Labs', price: '1,180,000', ceec: '8%', evalPrice: '1,085,600' },
    { rank: 4, name: 'ABC Office Supplies', price: '1,245,000', ceec: '12%', evalPrice: '1,095,600' },
    { rank: 5, name: 'MedSupply Zambia', price: '1,320,000', ceec: '0%', evalPrice: '1,320,000' },
  ];

  const pqItems = [
    'Reference 1: UTH Lusaka — Verified by J. Mbewe',
    'Reference 2: Ministry of Health — Verified',
    'ZAMRA registration verified directly',
    'Bank details match PACRA',
    'Warehouse and cold chain capacity confirmed',
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Bid Evaluation Report (BER)</h1>
            <StatusBadge status={berSubmitted ? 'submitted' : berGenerated ? 'active' : 'draft'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">Solicitation: {solId}</p>
        </div>
        {!berGenerated && (
          <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5" />
            {generateMutation.isPending ? 'Generating...' : 'Generate BER PDF'}
          </button>
        )}
      </div>

      {/* Post-Qualification Checklist */}
      {berGenerated && !berSubmitted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Post-Qualification Checklist — Lusaka Reagents Ltd</h2>
          <div className="space-y-3">
            {pqItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-sm text-emerald-800">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-emerald-100 border border-emerald-300 rounded-lg">
            <p className="text-sm font-bold text-emerald-900">RESULT: ✅ POST-QUALIFICATION PASSED</p>
          </div>
        </div>
      )}

      {/* Final Ranking */}
      {berGenerated && !berSubmitted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Final Ranking (system calculated)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Bidder</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Bid Price K</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">CEEC %</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Eval. Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rankingRows.map((row) => (
                  <tr key={row.rank} className={row.rank === 1 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{row.rank}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.price}</td>
                    <td className="px-4 py-3 text-center">{row.ceec}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-zammsa-green">{row.evalPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BER Narrative */}
      {berGenerated && !berSubmitted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">BER Narrative</h2>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
            <p>6 bids received. 1 eliminated (expired ZRA). 5 evaluated.</p>
            <p>All passed technical threshold. Preference scheme applied.</p>
            <p>Lusaka Reagents recommended: lowest evaluated price K1,016,400</p>
            <p>Post-qualification passed. Award value: K1,155,000.</p>
          </div>
        </div>
      )}

      {/* Committee Digital Signatures */}
      {berGenerated && !berSubmitted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Committee Signatures</h2>
          <div className="flex flex-wrap gap-3 mb-6">
            {committeeMembers.length > 0 ? committeeMembers.map((member: any) => (
              <div key={member.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                signed[member.id] ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {signed[member.id] ? '✅' : '⏳'} {member.name} ({member.role})
              </div>
            )) : (
              <p className="text-sm text-gray-400">No committee members found.</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {committeeMembers.filter((m: any) => m.id === user?.id && !signed[m.id]).length > 0 && (
              <button
                onClick={() => signMutation.mutate()}
                disabled={signMutation.isPending}
                className="px-6 py-2 bg-zammsa-green text-white text-sm font-bold rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <ShieldCheckIcon className="w-5 h-5" />
                {signMutation.isPending ? 'Signing...' : 'Apply My Signature'}
              </button>
            )}

            {allSigned && (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg disabled:opacity-50"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit BER to ZPC for Approval'}
              </button>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              {generateMutation.isPending ? 'Regenerating...' : 'Regenerate BER PDF'}
            </button>
          </div>
        </div>
      )}

      {/* ZPC Approval */}
      {berSubmitted && zpcDecision === null && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">ZPC Approval</h2>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-gray-500">Solicitation</dt><dd className="font-medium">{solId}</dd></div>
                <div><dt className="text-gray-500">Committee Members</dt><dd className="font-medium">{committeeMembers.length}</dd></div>
                <div><dt className="text-gray-500">Signatures</dt><dd className="font-medium text-zammsa-green">
                  {Object.keys(signed).length} of {committeeMembers.length}
                </dd></div>
              </dl>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ZPC Decision</label>
              <div className="flex gap-4">
                <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5" /> Approve BER
                </button>
                <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}
                  className="px-6 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                  <XCircleIcon className="w-5 h-5" /> Reject BER
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ZPC Comments</label>
              <textarea value={zpcComment} onChange={(e) => setZpcComment(e.target.value)} rows={3} className="w-full border rounded-lg px-4 py-3 text-sm" placeholder="Enter ZPC comments..." />
            </div>
          </div>
        </div>
      )}

      {zpcDecision === 'approve' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">BER Approved by ZPC</h2>
          <p className="text-emerald-700 mb-6">Proceed to generate the Contract Award Notice.</p>
          <button
            onClick={() => navigate(`/contracts/create?solicitation=${solId}`)}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold"
          >
            Proceed to Contract Award
          </button>
        </div>
      )}

      {zpcDecision === 'reject' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
          <XCircleIcon className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-rose-800 mb-2">BER Rejected</h2>
          <p className="text-rose-700 mb-2">Reason: {zpcComment || 'Returned for re-evaluation'}</p>
          <button onClick={() => navigate('/evaluations')} className="px-6 py-3 bg-gray-600 text-white rounded-xl font-bold">
            Back to Evaluations
          </button>
        </div>
      )}
    </div>
  );
};

export default BERWorkflow;

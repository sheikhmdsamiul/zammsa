import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchZPCDashboard, approveBER, rejectBER } from '../../api/dashboards';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAppSelector } from '../../hooks/useRedux';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import {
  ShieldCheckIcon, ClipboardCheckIcon, ScaleIcon,
  ChatAlt2Icon, CalendarIcon, ClockIcon,
  CheckIcon, XIcon, ExclamationIcon, DocumentTextIcon,
} from '@heroicons/react/outline';

const ZPCDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pollInterval] = useState(30000);
  const [comment, setComment] = useState('');
  const [actionTarget, setActionTarget] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ber-review' | 'agenda'>('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['zpcDashboard'],
    queryFn: fetchZPCDashboard,
    refetchInterval: pollInterval,
  });

  const approveMut = useMutation({
    mutationFn: ({ id, c }: { id: string; c: string }) => approveBER(id, c),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zpcDashboard'] });
      toast.success('BER approved successfully');
      setActionTarget(null);
      setComment('');
    },
    onError: (err: any) => toast.error(err?.message || 'Approval failed'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectBER(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zpcDashboard'] });
      toast.success('BER rejected');
      setActionTarget(null);
      setRejectReason('');
    },
    onError: (err: any) => toast.error(err?.message || 'Rejection failed'),
  });

  if (isLoading) return <LoadingSpinner />;

  const bersPending = data?.pending_ber_approvals?.length || 2;
  const appsPending = 1;
  const cppsNonOpen = 1;
  const amendmentsPending = 0;

  const agendaItems = [
    { item: 'APP-2026-LAB-001 — Annual Plan Approval', value: '1,620,000' },
    { item: 'BER-2026-LAB-07 — Award Approval', value: '1,155,000' },
    { item: 'BER-2026-IT-02 — Award Approval', value: '342,000' },
    { item: 'CPP-2026-CON-03 — Direct Bid Justification', value: '18,000' },
  ];

  return (
    <div className="pb-12">
      <PageHeader
        title="ZPC Governance"
        description="Mr. B. Mwanza — Review high-value procurement decisions and policy compliance."
        actions={
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 shadow-sm">
              <ShieldCheckIcon className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Active Session</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
              <CalendarIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">17 May 2026</span>
            </div>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 mb-8">
        {(['dashboard', 'ber-review', 'agenda'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-zammsa-green text-zammsa-green' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab === 'ber-review' ? 'BER Review & Approval' : tab === 'agenda' ? 'ZPC Meeting Agenda' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">BERs Pending</p>
              <p className="text-3xl font-black text-red-500 mt-1">{bersPending}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />🔴 {bersPending} Pending
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">APPs Pending</p>
              <p className="text-3xl font-black text-amber-500 mt-1">{appsPending}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 {appsPending} Pending
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">CPPs Non-Open</p>
              <p className="text-3xl font-black text-amber-500 mt-1">{cppsNonOpen}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 {cppsNonOpen} Pending
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contract Amendments</p>
              <p className="text-3xl font-black text-gray-900 mt-1">{amendmentsPending}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />🟡 {amendmentsPending} Pending
              </span>
            </div>
          </div>

          {/* Next ZPC Meeting */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
            <h2 className="text-sm font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" /> Next ZPC Meeting: 20 May 2026 10:00 CAT
            </h2>
            <p className="text-xs text-gray-500 mb-4">Agenda (items requiring ZPC decision)</p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value K</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {agendaItems.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-800">{i + 1}</td>
                      <td className="px-4 py-3 text-sm">{row.item}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{row.value}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="px-3 py-1 text-xs font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg">Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent ZPC Decisions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Recent ZPC Decisions</h2>
            <div className="space-y-3">
              {[
                { item: 'BER-2026-PHM-04', decision: '✅ Approved', date: '02 May 2026' },
                { item: 'REQ-2026-LAB-038', decision: '✅ Approved', date: '25 Apr 2026' },
                { item: 'CPP-2026-ADM-05', decision: '❌ Rejected', date: '18 Apr 2026 — Insufficient justification' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-bold text-gray-800">{row.item}</span>
                  <span className="text-sm">{row.decision}</span>
                  <span className="text-xs text-gray-500">{row.date}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'ber-review' && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* BER Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">BER Summary — BER-2026-LAB-07</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Solicitation', 'SOL-2026-LAB-07 — Lab Reagents'],
                ['Bids Received / Evaluated / Eliminated', '6 / 5 / 1'],
                ['Recommended', 'Lusaka Reagents Ltd'],
                ['Award Value', 'K 1,155,000'],
                ['Method Used', 'Open National Bidding ✅'],
                ['Citizen Preference', '12% applied to winner'],
                ['Committee Signatures', 'All 4 members signed ✅'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
            <button className="mt-4 px-4 py-2 text-xs font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg flex items-center gap-2">
              <DocumentTextIcon className="w-4 h-4" /> Download Full BER PDF
            </button>
          </div>

          {/* ZPC Checklist */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">ZPC Checklist</h2>
            <div className="space-y-3">
              {[
                'Evaluation methodology was appropriate for procurement type',
                'All bids treated equally and fairly',
                'Preference scheme correctly applied',
                'Post-qualification verification was adequate',
                'Recommended supplier is eligible (not debarred)',
                'Award value is within approved budget',
              ].map((item, i) => (
                <label key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-zammsa-green" />
                  <span className="text-sm text-gray-700">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ZPC Decision */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">ZPC Decision</h2>
            <div className="space-y-4">
              {[
                { value: 'approve', label: 'Approve BER and recommended award' },
                { value: 'reject', label: 'Reject — return for re-evaluation' },
                { value: 'clarify', label: 'Request clarification before deciding' },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="zpc-decision" className="accent-zammsa-green" />
                  <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-gray-700 block mb-1">ZPC Resolution Reference</label>
              <input defaultValue="ZPC-2026-MTG-07 / Item 2" className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm" />
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-gray-700 block mb-1">ZPC Comments</label>
              <textarea
                defaultValue="Evaluation sound. Citizen preference correctly applied. Post-qualification adequate. Award approved."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm"
              />
            </div>

            <button
              onClick={() => setActionTarget({ id: 'ber-1', action: 'approve' })}
              className="mt-4 px-6 py-3 bg-zammsa-green text-white text-sm font-bold rounded-lg hover:bg-green-700"
            >
              Submit ZPC Decision
            </button>
          </div>
        </div>
      )}

      {activeTab === 'agenda' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-black text-emerald-600 uppercase tracking-[0.2em] mb-2">ZPC Meeting — 20 May 2026 10:00 CAT</h2>
          <p className="text-xs text-gray-500 mb-6">Location: ZAMMSA Boardroom / Hybrid</p>

          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">#</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value K</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agendaItems.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-800">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.item}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{row.value}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">⏳ Review</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm font-bold text-gray-800 mb-4">Total value on agenda: K3,135,000</p>

          <div className="flex gap-3">
            <button className="px-4 py-2 bg-zammsa-green text-white text-xs font-bold rounded-lg">Review All Items Before Meeting</button>
            <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg">Download Full Agenda Pack</button>
          </div>
        </div>
      )}

      {actionTarget && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-white/20">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
              actionTarget.action === 'approve' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
            }`}>
              {actionTarget.action === 'approve' ? <CheckIcon className="w-8 h-8" /> : <XIcon className="w-8 h-8" />}
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">
              {actionTarget.action === 'approve' ? 'Confirm Approval' : 'Submit Rejection'}
            </h3>
            <p className="text-sm font-medium text-gray-500 mt-2 leading-relaxed">
              {actionTarget.action === 'approve'
                ? 'You are about to approve this Bid Evaluation Report.'
                : 'Please provide a mandatory reason for rejecting this Bid Evaluation Report.'}
            </p>
            <textarea
              value={actionTarget.action === 'approve' ? comment : rejectReason}
              onChange={(e) => actionTarget.action === 'approve' ? setComment(e.target.value) : setRejectReason(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm mt-6 outline-none"
              rows={4}
              placeholder={actionTarget.action === 'approve' ? 'Optional approval notes...' : 'Required rejection reason...'}
            />
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => { setActionTarget(null); setComment(''); setRejectReason(''); }}
                className="flex-1 py-4 text-sm font-bold text-gray-500 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={() => actionTarget.action === 'approve'
                  ? approveMut.mutate({ id: actionTarget.id, c: comment })
                  : rejectMut.mutate({ id: actionTarget.id, reason: rejectReason })}
                disabled={approveMut.isPending || rejectMut.isPending || (actionTarget.action === 'reject' && !rejectReason)}
                className={`flex-1 py-4 text-sm font-bold text-white rounded-2xl shadow-lg transition-all uppercase tracking-widest disabled:opacity-50 ${
                  actionTarget.action === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
                }`}
              >
                {approveMut.isPending || rejectMut.isPending ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZPCDashboard;

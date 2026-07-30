import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchZPCDashboard, approveBER, rejectBER } from '../../api/dashboards';
import { evaluationsApi } from '../../api/evaluations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAppSelector } from '../../hooks/useRedux';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import {
  ShieldCheckIcon, ClipboardCheckIcon, ScaleIcon,
  ChatAlt2Icon, CalendarIcon, ClockIcon,
  CheckIcon, XIcon, ExclamationIcon, DocumentTextIcon, EyeIcon,
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

  const { data: bers } = useQuery({
    queryKey: ['zpc-ber-list'],
    queryFn: () => evaluationsApi.listBERs({ status: 'submitted', page_size: 50 }),
  });
  const pendingBERs = bers?.results || [];

  const approveMut = useMutation({
    mutationFn: ({ id, c }: { id: string; c: string }) => approveBER(id, c),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zpcDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['zpc-ber-list'] });
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
      queryClient.invalidateQueries({ queryKey: ['zpc-ber-list'] });
      toast.success('BER rejected');
      setActionTarget(null);
      setRejectReason('');
    },
    onError: (err: any) => toast.error(err?.message || 'Rejection failed'),
  });

  if (isLoading) return <LoadingSpinner />;

  const bersPending = pendingBERs.length || data?.pending_ber_approvals?.length || 0;
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">BERs Pending Review ({pendingBERs.length})</h2>
            <button
              onClick={() => navigate('/evaluations/zpc-approval')}
              className="px-4 py-2 text-xs font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg"
            >
              View All BERs
            </button>
          </div>

          {pendingBERs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <CheckIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No BERs pending approval</p>
              <p className="text-sm text-gray-400 mt-1">Submitted BERs will appear here for ZPC review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingBERs.slice(0, 5).map((ber: any) => (
                <div key={ber.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{ber.solicitation_title || 'BER'}</p>
                      <p className="text-xs text-gray-500">{ber.solicitation_number || ''} — BER-{ber.id?.slice(0, 8) || ''}</p>
                    </div>
                    <StatusBadge status={ber.status || 'submitted'} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Award Value</p>
                      <p className="font-bold text-gray-900 font-mono">
                        {ber.report_content?.winner?.price
                          ? `ZMW ${Number(ber.report_content.winner.price).toLocaleString()}`
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Signatures</p>
                      <p className="font-bold text-gray-900">{ber.signed_count || 0}/{ber.required_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Submitted</p>
                      <p className="font-bold text-gray-900">{ber.submitted_at ? new Date(ber.submitted_at).toLocaleDateString() : '-'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        evaluationsApi.downloadBER(ber.id).then((blob: Blob) => {
                          const url = window.URL.createObjectURL(blob);
                          window.open(url, '_blank');
                          setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                        }).catch(() => toast.error('Failed to load BER PDF'));
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg flex items-center gap-1"
                    >
                      <DocumentTextIcon className="w-3.5 h-3.5" /> View BER
                    </button>
                    <button
                      onClick={() => setActionTarget({ id: ber.id, action: 'approve' })}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setActionTarget({ id: ber.id, action: 'reject' })}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-rose-500 rounded-lg hover:bg-rose-600"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingBERs.length > 5 && (
                <button
                  onClick={() => navigate('/evaluations/zpc-approval')}
                  className="w-full py-3 text-sm font-bold text-zammsa-green bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  View all {pendingBERs.length} pending BERs
                </button>
              )}
            </div>
          )}
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

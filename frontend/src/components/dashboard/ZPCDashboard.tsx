import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchZPCDashboard, approveBER, rejectBER } from '../../api/dashboards';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAppSelector } from '../../hooks/useRedux';
import { PageHeader } from '../common/PageHeader';
import { 
  ShieldCheckIcon, ClipboardCheckIcon, ScaleIcon, 
  ChatAlt2Icon, CalendarIcon, ClockIcon,
  CheckIcon, XIcon, ExclamationIcon
} from '@heroicons/react/outline';

const ZPCDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const queryClient = useQueryClient();
  const [pollInterval] = useState(30000);
  const [comment, setComment] = useState('');
  const [actionTarget, setActionTarget] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  return (
    <div className="pb-12">
      <PageHeader 
        title="ZPC Governance"
        description="Review high-value procurement decisions and policy compliance."
        actions={
          <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 shadow-sm shadow-emerald-50">
             <ShieldCheckIcon className="w-5 h-5 text-emerald-600" />
             <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Active Session</span>
          </div>
        }
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pending BER Approvals</h2>
          <ClipboardCheckIcon className="w-5 h-5 text-gray-200" />
        </div>
        
        {data?.pending_ber_approvals && data.pending_ber_approvals.length > 0 ? (
          <div className="overflow-x-auto -mx-6">
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Tender Title</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Evaluation Team</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Score</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Recommendation Summary</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Decisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.pending_ber_approvals.map((ber) => (
                  <tr key={ber.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{ber.title}</td>
                    <td className="px-6 py-4">
                       <p className="text-sm font-medium text-gray-700">{ber.submitted_by}</p>
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Submitted: {new Date(ber.submitted_at).toLocaleDateString('en-GB')}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl border-2 font-black text-sm ${
                        ber.total_score >= 80 ? 'text-emerald-600 border-emerald-50 bg-emerald-50/30' : 
                        ber.total_score >= 60 ? 'text-amber-600 border-amber-50 bg-amber-50/30' : 'text-rose-600 border-rose-50 bg-rose-50/30'
                      }`}>
                        {ber.total_score}%
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-500 max-w-xs truncate italic">"{ber.recommendations}"</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setActionTarget({ id: ber.id, action: 'approve' })}
                          className="p-2 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all"
                          title="Approve BER"
                        >
                           <CheckIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setActionTarget({ id: ber.id, action: 'reject' })}
                          className="p-2 bg-rose-500 text-white rounded-lg shadow-lg shadow-rose-100 hover:bg-rose-600 transition-all"
                          title="Reject BER"
                        >
                           <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
             <ScaleIcon className="w-12 h-12 mx-auto opacity-10 mb-4" />
             <p className="text-xs font-bold uppercase tracking-widest">No pending BER approvals</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Contract Variations</h2>
            <ExclamationIcon className="w-5 h-5 text-gray-200" />
          </div>
          {data?.pending_amendments && data.pending_amendments.length > 0 ? (
            <div className="space-y-4">
              {data.pending_amendments.map((am) => (
                <div key={am.id} className="group p-5 rounded-2xl border border-gray-100 hover:border-zammsa-green/30 hover:bg-zammsa-green/5 transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-gray-800">{am.contract}</p>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${
                      am.variation_percentage > 20 ? 'bg-rose-50 text-rose-600' :
                      am.variation_percentage > 10 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {am.variation_percentage.toFixed(1)}% VARIATION
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3 leading-relaxed italic">"{am.description}"</p>
                  <div className="flex items-center justify-between">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Impact Value</span>
                     <span className="text-sm font-black text-gray-900">ZMW {am.value_change.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 italic text-xs">No pending contract amendments</div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Direct Selection Review</h2>
            <ChatAlt2Icon className="w-5 h-5 text-gray-200" />
          </div>
          {data?.pending_justifications && data.pending_justifications.length > 0 ? (
            <div className="space-y-4">
              {data.pending_justifications.map((j) => (
                <div key={j.id} className="p-5 rounded-2xl bg-gray-50/50 border border-transparent hover:border-gray-100 hover:bg-white transition-all duration-300 shadow-sm">
                  <p className="font-bold text-gray-800 mb-2">{j.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 italic mb-4">"{j.justification}"</p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Est. Value</span>
                       <span className="text-sm font-black text-gray-900">ZMW {j.amount.toLocaleString()}</span>
                    </div>
                    <button className="px-4 py-2 bg-white border border-gray-200 text-[10px] font-black text-zammsa-green uppercase tracking-widest rounded-xl hover:bg-zammsa-green hover:text-white hover:border-zammsa-green transition-all shadow-sm">Full Review</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 italic text-xs">No pending direct-award justifications</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Approval History */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Decision History</h2>
            <ClockIcon className="w-5 h-5 text-gray-200" />
          </div>
          {data?.approval_history && data.approval_history.length > 0 ? (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-100 before:to-transparent">
              {data.approval_history.map((h) => (
                <div key={h.id} className="relative flex items-center gap-4 group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white z-10 shadow-lg ${
                    h.action === 'approved' ? 'bg-emerald-500 shadow-emerald-50' : 
                    h.action === 'rejected' ? 'bg-rose-500 shadow-rose-50' : 'bg-amber-500 shadow-amber-50'
                  }`}>
                    {h.action === 'approved' ? <CheckIcon className="w-5 h-5" /> : <XIcon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 leading-snug">
                       <span className="font-bold text-gray-900">ZPC Decision:</span> <span className="capitalize">{h.action}</span> by {h.user}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{new Date(h.created_at).toLocaleString('en-GB')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-center py-12 text-gray-400 italic text-xs">No historical decisions recorded</div>}
        </div>

        {/* Meeting Schedule */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Governance Meetings</h2>
            <CalendarIcon className="w-5 h-5 text-gray-200" />
          </div>
          {data?.upcoming_meetings && data.upcoming_meetings.length > 0 ? (
            <div className="space-y-4">
              {data.upcoming_meetings.map((m) => (
                <div key={m.id} className="flex items-center gap-5 p-4 rounded-2xl border border-gray-50 hover:border-emerald-100 hover:bg-emerald-50/10 transition-all group">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center group-hover:border-emerald-200 transition-colors">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{new Date(m.date).toLocaleDateString('en', { month: 'short' })}</span>
                    <span className="text-2xl font-black text-gray-900 leading-none">{new Date(m.date).getDate()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 mb-1">{m.title}</p>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       <span className="w-1 h-1 rounded-full bg-gray-300" />
                       <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Conf. Room 1</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-center py-12 text-gray-400 italic text-xs">No scheduled ZPC meetings</div>}
        </div>
      </div>

      {actionTarget && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-white/20 transform animate-in zoom-in-95 duration-300">
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
                 ? 'You are about to approve this Bid Evaluation Report. Please provide optional comments below.' 
                 : 'Please provide a mandatory reason for rejecting this Bid Evaluation Report.'}
            </p>

            <textarea
              value={actionTarget.action === 'approve' ? comment : rejectReason}
              onChange={(e) => actionTarget.action === 'approve' ? setComment(e.target.value) : setRejectReason(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm mt-6 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
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
                className={`flex-1 py-4 text-sm font-bold text-white rounded-2xl shadow-lg transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionTarget.action === 'approve' ? 'bg-emerald-500 shadow-emerald-100 hover:bg-emerald-600' : 'bg-rose-500 shadow-rose-100 hover:bg-rose-600'
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
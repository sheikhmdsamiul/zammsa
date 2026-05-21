import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { ContractProcurementPlan } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { 
  ArrowLeftIcon, CheckIcon, XIcon, PencilIcon, 
  LightningBoltIcon, ClipboardListIcon, CashIcon, 
  ClockIcon, ShieldCheckIcon, DocumentTextIcon,
  ExclamationIcon, ChatAlt2Icon, DatabaseIcon
} from '@heroicons/react/outline';

const CPP_WORKFLOW_STAGES = [
  { key: 'draft', label: 'Drafting' },
  { key: 'pending_zpc', label: 'ZPC Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'active', label: 'In Force' },
  { key: 'completed', label: 'Closed' },
] as const;

const METHOD_LABELS: Record<string, string> = {
  open_tender: 'Open National Bidding',
  international: 'Open International Bidding',
  limited: 'Limited Bidding',
  simplified: 'Simplified Bidding',
  direct: 'Direct Procurement',
};

export default function CPPDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cpp, setCpp] = useState<ContractProcurementPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await procurementPlanningApi.contractPlans.detail(id);
      setCpp(res);
    } catch {
      toast.error('Failed to load strategy details');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const approveCPP = async () => {
    if (!id) return;
    setActionLoading('approve');
    try {
      await procurementPlanningApi.contractPlans.approve(id);
      toast.success('Strategy approved');
      loadData();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Approval failed'); }
    setActionLoading('');
  };

  const submitToZPC = async () => {
    if (!id) return;
    setActionLoading('submit');
    try {
      await procurementPlanningApi.contractPlans.submit(id);
      toast.success('Submitted to ZPC registry');
      loadData();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Submission failed'); }
    setActionLoading('');
  };

  const rejectCPP = async (returnForRevision = false) => {
    if (!id || !reason.trim()) return;
    setActionLoading('reject');
    try {
      await procurementPlanningApi.contractPlans.reject(id, reason.trim(), returnForRevision);
      toast.success('Decision recorded');
      setShowReject(false);
      setReason('');
      loadData();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Action failed'); }
    setActionLoading('');
  };

  if (loading) return <LoadingSpinner className="py-24" />;
  if (!cpp) return <div className="text-center py-24 text-gray-500 font-bold uppercase tracking-widest">Strategy not found</div>;

  const status = cpp.status || 'draft';
  const role = user?.role || '';
  const canZPCAction = status === 'pending_zpc' && ['zpc_member', 'director_procurement', 'system_admin'].includes(role);
  const canSubmitToZPC = status === 'draft' && ['procurement_officer', 'system_admin'].includes(role);

  return (
    <div className="pb-12 max-w-7xl mx-auto">
      <PageHeader 
        title={`Procurement Strategy: ${cpp.requisition_number || '---'}`}
        description={`CPP Reference ID: ${cpp.cpp_id.slice(0, 8)}`}
        breadcrumbs={[
          { label: 'Planning', path: '/procurement-planning' },
          { label: 'Strategies', path: '/procurement-planning/cpp' },
          { label: 'View Strategy' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/procurement-planning/cpp" className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-all">
               <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <StatusBadge status={status} className="py-2 px-4 shadow-sm" />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <StatCard 
               label="Current Strategy"
               value={METHOD_LABELS[cpp.method || '']?.split(' ')[0] || 'TBD'}
               icon={<LightningBoltIcon className="w-6 h-6" />}
               color="blue"
               description={METHOD_LABELS[cpp.method || ''] || 'Awaiting definition'}
             />
             <StatCard 
               label="Milestones"
               value={cpp.milestones?.length || 0}
               icon={<ClipboardListIcon className="w-6 h-6" />}
               color="orange"
               description="Critical path steps"
             />
              <StatCard 
                label="Risk Rating"
                value={cpp.risks?.length ? 'LOGGED' : 'NONE'}
                icon={<ExclamationIcon className="w-6 h-6" />}
                color={cpp.risks?.length ? 'red' : 'green'}
                description={`${cpp.risks?.length || 0} items identified`}
              />
          </div>

          {/* Primary Details */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
             <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Strategy Overview</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><DocumentTextIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Requisition Ref</p><p className="text-sm font-bold text-gray-900">{cpp.requisition_number || cpp.requisition}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><DatabaseIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Method Recommendation</p><p className="text-sm font-bold text-gray-900 capitalize">{METHOD_LABELS[cpp.recommended_method || ''] || 'N/A'}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><ShieldCheckIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Method Override</p><p className="text-sm font-bold text-gray-900">{cpp.method_override ? 'YES (ZPC ACTION)' : 'NO'}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><ClockIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Planning Date</p><p className="text-sm font-bold text-gray-900">{new Date(cpp.created_at).toLocaleDateString('en-GB')}</p></div>
                </div>
             </div>
             {cpp.override_reason && (
                <div className="mt-12 pt-8 border-t border-gray-50">
                   <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Justification for Method Choice</h3>
                   <p className="text-sm text-gray-700 leading-relaxed font-medium bg-gray-50/50 p-6 rounded-2xl italic">"{cpp.override_reason}"</p>
                </div>
             )}
          </div>

          {/* Milestones Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-8 border-b border-gray-50">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Strategy Milestones</h2>
             </div>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-50">
                   <thead className="bg-gray-50/30">
                      <tr>
                         <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Milestone Activity</th>
                         <th className="px-8 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Planned Date</th>
                         <th className="px-8 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Actual Date</th>
                         <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {cpp.milestones?.map((m: any, i: number) => (
                         <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-8 py-5">
                               <p className="text-sm font-bold text-gray-800">{m.activity || m.milestone_type}</p>
                            </td>
                            <td className="px-8 py-5 text-center text-sm font-medium text-gray-500">
                               {m.planned_date ? new Date(m.planned_date).toLocaleDateString('en-GB') : '-'}
                            </td>
                            <td className="px-8 py-5 text-center text-sm font-medium text-emerald-600">
                               {m.actual_date ? new Date(m.actual_date).toLocaleDateString('en-GB') : <span className="text-gray-300">Pending</span>}
                            </td>
                            <td className="px-8 py-5 text-right">
                               <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                                  m.actual_date ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                               }`}>
                                  {m.actual_date ? 'COMPLETED' : 'PLANNED'}
                               </span>
                            </td>
                         </tr>
                      ))}
                      {(!cpp.milestones || cpp.milestones.length === 0) && (
                         <tr><td colSpan={4} className="px-8 py-12 text-center text-gray-400 italic text-sm">No milestones defined for this strategy.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
           {/* Workflow Tracking */}
           <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Process Status</h2>
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-1.5 before:h-full before:w-0.5 before:bg-gray-100">
                 {CPP_WORKFLOW_STAGES.map((step, i) => {
                    const isCurrent = status === step.key;
                    const stageIdx = CPP_WORKFLOW_STAGES.findIndex(s => s.key === status);
                    const isDone = stageIdx > i;

                    return (
                       <div key={i} className="relative flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full z-10 ring-4 ring-white ${
                             isDone ? 'bg-emerald-500 shadow-lg shadow-emerald-100' : isCurrent ? 'bg-amber-500 animate-pulse shadow-lg shadow-amber-100' : 'bg-gray-200'
                          }`} />
                          <span className={`text-xs font-bold uppercase tracking-widest ${
                             isDone ? 'text-gray-400' : isCurrent ? 'text-amber-600' : 'text-gray-300'
                          }`}>
                             {step.label}
                          </span>
                       </div>
                    );
                 })}
              </div>
           </div>

           {/* Operations */}
           {(canSubmitToZPC || canZPCAction) && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                 <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Decision Actions</h2>
                 <div className="space-y-3">
                    {canSubmitToZPC && (
                       <button onClick={submitToZPC} disabled={actionLoading !== ''} className="w-full py-4 bg-amber-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all disabled:opacity-50">Registry Submit</button>
                    )}
                    {canZPCAction && (
                       <>
                          <button onClick={approveCPP} disabled={actionLoading !== ''} className="w-full py-4 bg-zammsa-green text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-zammsa-green/20 hover:bg-zammsa-green-dark transition-all disabled:opacity-50">Confirm Strategy</button>
                          <button onClick={() => setShowReject(true)} disabled={actionLoading !== ''} className="w-full py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all disabled:opacity-50">Reject / Return</button>
                       </>
                    )}
                 </div>
              </div>
           )}

           {/* History / Decisions */}
           <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
              <ChatAlt2Icon className="w-8 h-8 text-gray-100 mx-auto mb-3" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Internal Discussion</p>
              <p className="text-xs text-gray-400 mt-1">Comments and decision logs for this strategy will appear here.</p>
           </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full p-10 border border-white/20 transform animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-8">
               <XIcon className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Strategy Decision</h3>
            <p className="text-sm font-medium text-gray-500 mt-2 mb-8">Provide a clear reason for rejecting or returning this strategy to the procurement officer.</p>
            
            <textarea 
               value={reason} 
               onChange={(e) => setReason(e.target.value)} 
               rows={4} 
               placeholder="Decision details..." 
               className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm outline-none focus:ring-4 focus:ring-rose-500/5 transition-all" 
            />
            
            <div className="flex gap-4 mt-10">
              <button onClick={() => { setShowReject(false); setReason(''); }} className="flex-1 py-4 text-sm font-bold text-gray-400 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all uppercase tracking-widest">Cancel</button>
              <button 
                onClick={() => rejectCPP(true)}
                disabled={!reason.trim() || actionLoading !== ''} 
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-rose-100 hover:bg-rose-700 disabled:opacity-50 transition-all"
              >
                 Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
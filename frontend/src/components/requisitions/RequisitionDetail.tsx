import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requisitionsApi } from '../../api/requisitions';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { useAuth } from '../../hooks/useAuth';
import { 
  PencilIcon, CheckIcon, XIcon, ArrowLeftIcon, 
  DocumentTextIcon, ClipboardListIcon, CashIcon, 
  ClockIcon, LocationMarkerIcon, UserCircleIcon,
  ShieldCheckIcon, LightningBoltIcon, OfficeBuildingIcon,
  CalendarIcon
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

const WORKFLOW_STEPS = [
  { label: 'Submission', statuses: ['draft', 'submitted', 'pending_dept_head'] },
  { label: 'Dept Review', statuses: ['pending_dept_head', 'pending_finance', 'pending_dg', 'pending_zpc', 'approved'] },
  { label: 'Finance', statuses: ['pending_finance', 'pending_dg', 'pending_zpc', 'approved'] },
  { label: 'Executive', statuses: ['pending_dg', 'pending_zpc', 'approved'] },
  { label: 'ZPC Panel', statuses: ['pending_zpc', 'approved'] },
  { label: 'Approved', statuses: ['approved'] },
];

export default function RequisitionDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [comment, setComment] = useState('');

  const { data: req, isLoading } = useQuery({
    queryKey: ['requisition', id],
    queryFn: () => requisitionsApi.get(id!),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['requisition', id] });

  const submitMutation = useMutation({
    mutationFn: () => requisitionsApi.submit(id!),
    onSuccess: (res) => { invalidate(); toast.success(res.message || 'Requisition submitted'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Submit failed'),
  });

  const budgetValidateMutation = useMutation({
    mutationFn: () => requisitionsApi.budgetValidate(id!),
    onSuccess: (res) => { invalidate(); toast.success(res.message || 'Budget validated'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Budget validation failed'),
  });

  const approveMutation = useMutation({
    mutationFn: () => requisitionsApi.approve(id!, { comment, decision: 'approved' }),
    onSuccess: (res) => { invalidate(); setComment(''); toast.success(res.message || 'Decision recorded'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Action failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => requisitionsApi.reject(id!, { reason: comment || 'No reason provided' }),
    onSuccess: (res) => { invalidate(); setComment(''); toast.success(res.message || 'Requisition rejected'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Reject failed'),
  });

  const returnMutation = useMutation({
    mutationFn: () => requisitionsApi.returnForRevision(id!, comment || 'Returned for revision'),
    onSuccess: (res) => { invalidate(); setComment(''); toast.success(res.message || 'Returned for revision'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Return failed'),
  });

  if (isLoading) return <LoadingSpinner className="py-24" />;
  if (!req) return <div className="text-center py-24 text-gray-500 font-bold uppercase tracking-widest">Requisition not found</div>;

  const role = user?.role || '';
  const status = req.status || '';
  const estimatedValue = Number(req.estimated_value || req.estimated_total || 0);

  const canSubmit = status === 'draft' && role === 'user_dept_staff';
  const canApproveDeptHead = status === 'pending_dept_head' && role === 'department_head';
  const canApproveFinance = status === 'pending_finance' && role === 'finance_officer';
  const canApproveDG = status === 'pending_dg' && role === 'director_general';
  const canApproveZPC = status === 'pending_zpc' && role === 'zpc_member' && estimatedValue > 250000;
  const canRejectReturn = (status === 'pending_dept_head' && role === 'department_head') ||
    (status === 'pending_finance' && role === 'finance_officer') ||
    (status === 'pending_dg' && role === 'director_general') ||
    (status === 'pending_zpc' && role === 'zpc_member');
  const canBudgetValidate = ['draft', 'submitted', 'pending_finance'].includes(status) && role === 'finance_officer';

  const showActions = canSubmit || canApproveDeptHead || canApproveFinance || canApproveDG || canApproveZPC || canRejectReturn || canBudgetValidate;

  return (
    <div className="pb-12 max-w-7xl mx-auto">
      <PageHeader 
        title={(req.title || req.req_number) || "Requisition Details"}
        description={`Internal Requisition Reference: ${req.req_number || 'N/A'}`}
        breadcrumbs={[
          { label: 'Requisitions', path: '/requisitions' },
          { label: 'View Details' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/requisitions" className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-all">
               <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            {status === 'draft' && (
              <Link 
                to={`/requisitions/${id}/edit`} 
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-xs font-bold text-gray-500 hover:text-blue-600 transition-all"
              >
                <PencilIcon className="w-4 h-4" />
                <span className="uppercase tracking-widest">Edit Draft</span>
              </Link>
            )}
            <StatusBadge status={status} className="py-2 px-4 shadow-sm" />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <StatCard 
               label="Estimated Value"
               value={`ZMW ${estimatedValue.toLocaleString()}`}
               icon={<CashIcon className="w-6 h-6" />}
               color="green"
               description="Total requirement cost"
             />
             <StatCard 
               label="Priority Level"
               value={req.priority?.toUpperCase() || 'NORMAL'}
               icon={<LightningBoltIcon className="w-6 h-6" />}
               color={req.priority === 'urgent' ? 'red' : req.priority === 'high' ? 'orange' : 'blue'}
               description="Operational urgency"
             />
             <StatCard 
               label="Budget Status"
               value={req.budget_validated ? 'VALIDATED' : 'PENDING'}
               icon={<ShieldCheckIcon className="w-6 h-6" />}
               color={req.budget_validated ? 'green' : 'orange'}
               description={req.encumbrance_ref || 'Awaiting validation'}
             />
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
             <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Requisition Metadata</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-12">
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><OfficeBuildingIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Requesting Dept</p><p className="text-sm font-bold text-gray-900">{req.department_name || req.department}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><UserCircleIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Requested By</p><p className="text-sm font-bold text-gray-900">{req.requester_name || req.created_by}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><CalendarIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Date Required</p><p className="text-sm font-bold text-gray-900">{req.date_required ? new Date(req.date_required).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Asap'}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><LocationMarkerIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Delivery Point</p><p className="text-sm font-bold text-gray-900">{req.delivery_location || 'Main Warehouse'}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><ClipboardListIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Procurement Method</p><p className="text-sm font-bold text-gray-900 capitalize">{req.procurement_method || 'Standard'}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><DocumentTextIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">APP Reference</p><p className="text-sm font-bold text-gray-900">{req.app_line_item_ref || 'N/A'}</p></div>
                </div>
             </div>

             {req.description && (
                <div className="mt-12 pt-8 border-t border-gray-50">
                   <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Justification & Description</h3>
                   <p className="text-sm text-gray-700 leading-relaxed font-medium bg-gray-50/50 p-6 rounded-2xl italic">"{req.description}"</p>
                </div>
             )}
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-8 flex items-center justify-between border-b border-gray-50">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Required Items ({req.items?.length || 0})</h2>
                <span className="text-xs font-black text-zammsa-green uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg">Estimated Total: ZMW {estimatedValue.toLocaleString()}</span>
             </div>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-50">
                   <thead className="bg-gray-50/30">
                      <tr>
                         <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">#</th>
                         <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Item Details</th>
                         <th className="px-8 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantity</th>
                         <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Unit Est.</th>
                         <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Subtotal</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {req.items?.map((item: any, idx: number) => {
                         const lineTotal = Number(item.total_estimate || (item.quantity * (item.estimated_unit_cost || item.unit_price_estimate || 0)));
                         return (
                            <tr key={item.id || item.item_id} className="hover:bg-gray-50/50 transition-colors">
                               <td className="px-8 py-5 text-sm font-black text-gray-300 italic">{idx + 1}</td>
                               <td className="px-8 py-5">
                                  <p className="text-sm font-bold text-gray-800">{item.description}</p>
                                  <p className="text-[10px] font-mono text-gray-400 uppercase">CODE: {item.item_code || '---'}</p>
                               </td>
                               <td className="px-8 py-5 text-center">
                                  <span className="inline-block px-3 py-1 bg-white border border-gray-100 rounded-lg text-sm font-black text-gray-700">{item.quantity} <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">{item.unit || item.uom_name || 'Units'}</span></span>
                               </td>
                               <td className="px-8 py-5 text-right text-sm font-bold text-gray-500">ZMW {Number(item.estimated_unit_cost || item.unit_price_estimate || 0).toLocaleString()}</td>
                               <td className="px-8 py-5 text-right text-sm font-black text-gray-900">ZMW {lineTotal.toLocaleString()}</td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          </div>

          {req.specifications && req.specifications.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
               <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Technical Specifications</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {req.specifications.map((spec: any, i: number) => (
                    <div key={spec.id || i} className="p-6 rounded-2xl bg-gray-50/50 border border-gray-100">
                       <p className="text-[10px] font-black text-zammsa-green uppercase tracking-[0.2em] mb-4">{spec.specification_type || 'STANDARD SPEC'}</p>
                       {typeof spec.content === 'string' ? (
                          <p className="text-sm font-medium text-gray-700 leading-relaxed">{spec.content}</p>
                       ) : (
                          <div className="space-y-2">
                             {Object.entries(spec.content || {}).map(([key, value]) => (
                                <div key={key} className="flex justify-between border-b border-gray-100 pb-1">
                                   <span className="text-[10px] font-bold text-gray-400 uppercase">{key.replace(/_/g, ' ')}</span>
                                   <span className="text-xs font-bold text-gray-800">{String(value)}</span>
                                </div>
                             ))}
                          </div>
                       )}
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Workflow Tracking</h2>
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-1.5 before:h-full before:w-0.5 before:bg-gray-100">
              {WORKFLOW_STEPS.map((step, i) => {
                const isCurrent = step.statuses.includes(status);
                const isDone = !isCurrent && status !== 'draft' && status !== 'rejected' && WORKFLOW_STEPS.slice(i+1).some(s => s.statuses.includes(status));
                const isRejected = status === 'rejected' && isCurrent;

                return (
                  <div key={i} className="relative flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full z-10 ring-4 ring-white ${
                      isDone ? 'bg-emerald-500' : isCurrent ? (isRejected ? 'bg-rose-500 animate-pulse' : 'bg-amber-500 animate-pulse') : 'bg-gray-200'
                    }`} />
                    <span className={`text-xs font-bold uppercase tracking-widest ${
                      isDone ? 'text-gray-400' : isCurrent ? (isRejected ? 'text-rose-600' : 'text-amber-600') : 'text-gray-300'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {status === 'rejected' && (
              <div className="mt-8 p-4 bg-rose-50 rounded-xl border border-rose-100">
                 <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Status Notification</p>
                 <p className="text-xs font-medium text-rose-700">This requisition has been rejected and archived.</p>
              </div>
            )}
          </div>

          {showActions && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Decision Actions</h2>
              <div className="space-y-4">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Decision notes..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-zammsa-green/5 outline-none transition-all"
                />
                <div className="space-y-2">
                   {canSubmit && (
                     <button onClick={() => submitMutation.mutate()} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">Submit to Head</button>
                   )}
                   {canBudgetValidate && (
                     <button onClick={() => budgetValidateMutation.mutate()} className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">Verify Budget</button>
                   )}
                   {(canApproveDeptHead || canApproveFinance || canApproveDG || canApproveZPC) && (
                     <button onClick={() => approveMutation.mutate()} className="w-full py-4 bg-zammsa-green text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-zammsa-green/10 hover:bg-zammsa-green-dark transition-all">
                       {canApproveDG && estimatedValue > 250000 ? 'Approve & Move ZPC' : 'Grant Approval'}
                     </button>
                   )}
                   {canRejectReturn && (
                     <>
                       <button onClick={() => rejectMutation.mutate()} className="w-full py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all">Reject Request</button>
                       <button onClick={() => returnMutation.mutate()} className="w-full py-4 bg-white border border-gray-200 text-amber-600 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-amber-50 hover:border-amber-100 transition-all">Return to Staff</button>
                     </>
                   )}
                </div>
              </div>
            </div>
          )}

          {req.approvals && req.approvals.length > 0 && (
             <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                <div className="flex items-center justify-between mb-8">
                   <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Approval Log</h2>
                   <ClockIcon className="w-5 h-5 text-gray-200" />
                </div>
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gray-50">
                   {req.approvals.map((a: any) => (
                      <div key={a.approval_id || a.id} className="relative flex items-start gap-4">
                         <div className={`w-10 h-10 rounded-xl border-4 border-white shadow-sm flex items-center justify-center shrink-0 z-10 ${
                           a.decision === 'approved' ? 'bg-emerald-500 text-white' : a.decision === 'rejected' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                         }`}>
                            {a.decision === 'approved' ? <CheckIcon className="w-5 h-5" /> : <XIcon className="w-5 h-5" />}
                         </div>
                         <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-800">{a.approver_name || a.approver}</p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{a.approval_level.replace(/_/g, ' ')}</p>
                            {a.comments && <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-3 rounded-xl italic">"{a.comments}"</p>}
                            <p className="text-[9px] font-bold text-gray-300 uppercase mt-2">{a.approved_at ? new Date(a.approved_at).toLocaleString('en-GB') : 'Pending'}</p>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
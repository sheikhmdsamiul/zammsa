import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { procurementPlanningApi, budgetApi } from '../../api/procurement_planning';
import { AnnualProcurementPlan, BudgetSummary, APPLineItem } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { 
  ArrowLeftIcon, PencilIcon, CheckCircleIcon, XIcon, 
  CalendarIcon, OfficeBuildingIcon, 
  UserCircleIcon, GlobeIcon, CashIcon,
  ClipboardListIcon, DownloadIcon, ShieldCheckIcon, ClockIcon,
  DatabaseIcon, LightningBoltIcon
} from '@heroicons/react/outline';

const METHOD_LABELS_SHORT: Record<string, string> = {
  open_national_bidding: 'ONB',
  open_international_bidding: 'OIB',
  limited_selection: 'LS',
  simplified_bidding: 'SIM',
  direct_selection: 'DIR',
};

const WORKFLOW_STEPS = [
  { label: 'Drafting', statuses: ['draft'] },
  { label: 'Internal Review', statuses: ['dept_head_review', 'procurement_review'] },
  { label: 'Director Review', statuses: ['director_review'] },
  { label: 'ZPC Panel', statuses: ['zpc_review'] },
  { label: 'Approved', statuses: ['approved', 'published'] },
  { label: 'Published', statuses: ['published'] },
];

export default function APPDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [app, setApp] = useState<AnnualProcurementPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [reason, setReason] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showConsolidateModal, setShowConsolidateModal] = useState(false);
  const [consolidateTarget, setConsolidateTarget] = useState('');
  const [showZPPAModal, setShowZPPAModal] = useState(false);
  const [zppaRef, setZppaRef] = useState('');
  const [showQuarterlyModal, setShowQuarterlyModal] = useState(false);
  const [quarterlyJustification, setQuarterlyJustification] = useState('');
  const [quarterlyItems, setQuarterlyItems] = useState<any[]>([]);
  
  const [selectedTargets, setSelectedTargets] = useState(['zammsa_website', 'zppa_egp', 'supplier_notifications']);
  const [gpnContent, setGpnContent] = useState({
    notice_heading: '',
    notice_body: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    issuing_authority: '',
    gpn_reference: ''
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [res] = await Promise.all([
        procurementPlanningApi.get(id),
      ]);
      setApp(res);
      
      if (res.department_name) {
        setGpnContent(prev => ({
          ...prev,
          notice_heading: `GENERAL PROCUREMENT NOTICE — ZAMMSA ANNUAL PROCUREMENT PLAN ${res.fiscal_year_code}`,
          notice_body: `The Zambia Medicines and Medical Supplies Agency (ZAMMSA) intends to procure the following goods and services during the financial year ${res.fiscal_year_code} and invites eligible suppliers to register their interest.`
        }));
      }
    } catch {
      toast.error('Failed to load APP details');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const doAction = async (action: string, data?: any) => {
    if (!id) return;
    setActionLoading(action);
    try {
      let res;
      switch (action) {
        case 'submit': res = await procurementPlanningApi.submit(id); break;
        case 'approve': res = await procurementPlanningApi.approve(id, data); break;
        case 'return': res = await procurementPlanningApi.returnForRevision(id, data.reason); break;
        case 'reject': res = await procurementPlanningApi.reject(id, data.reason); break;
        case 'compliance': res = await procurementPlanningApi.complianceCheck(id, data); break;
        case 'consolidate': res = await procurementPlanningApi.consolidate(id, data); break;
        case 'publish': 
           res = await procurementPlanningApi.publish(id, { ...gpnContent, publication_targets: selectedTargets }); 
           break;
        case 'zppa-submit': res = await procurementPlanningApi.submitToZPPA(id, zppaRef); break;
      }
      toast.success(res?.message || 'Action completed successfully');
      loadData();
      setShowReturnModal(false); setShowRejectModal(false); 
      setShowComplianceModal(false); setShowConsolidateModal(false);
      setShowZPPAModal(false); setReason('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
    setActionLoading('');
  };

  if (loading) return <div className="p-12 flex justify-center"><LoadingSpinner /></div>;
  if (!app) return <div className="text-center py-24 text-slate-500 font-semibold uppercase tracking-widest">Plan not found</div>;

  const status = app.status;
  const role = user?.role || '';
  
  const canSubmit = status === 'draft' && role === 'user_dept_staff';
  const canApprove = (
    (status === 'dept_head_review' && role === 'department_head') ||
    (status === 'procurement_review' && role === 'procurement_officer') ||
    (status === 'director_review' && role === 'director_procurement') ||
    (status === 'zpc_review' && role === 'zpc_member')
  );
  const canRejectReturn = canApprove;
  const canCompliance = status === 'procurement_review' && role === 'procurement_officer';
  const canConsolidate = status === 'procurement_review' && role === 'procurement_officer';
  const canPublish = status === 'approved' && role === 'procurement_officer';
  const canSubmitToZPPA = status === 'published' && role === 'zppa_reporting_officer';
  const canQuarterlyUpdate = ['approved', 'published'].includes(status) && ['procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'].includes(role);

  const estimatedValue = Number(app.total_estimated_value || 0);

  return (
    <div className="space-y-8">
      <PageHeader 
        title={`${app.department_name} APP`}
        description={`Fiscal Year ${app.fiscal_year_code} • ID: ${app.app_id.slice(0, 8)}`}
        breadcrumbs={[
          { label: 'Procurement Planning', path: '/procurement-planning' },
          { label: 'View APP' }
        ]}
        actions={
          <div className="flex items-center gap-3">
            <Link to="/procurement-planning" className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
               <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            {status === 'draft' && (
               <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-zammsa-green transition-all shadow-sm">
                  <PencilIcon className="w-4 h-4" />
                  <span>Edit Plan</span>
               </button>
            )}
            <StatusBadge status={status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <StatCard 
               label="Total Estimated Value"
               value={`ZMW ${estimatedValue.toLocaleString()}`}
               icon={<CashIcon />}
               color="green"
             />
             <StatCard 
               label="Planned Items"
               value={app.line_items?.length || 0}
               icon={<ClipboardListIcon />}
               color="blue"
             />
             <StatCard 
               label="Registry Status"
               value={app.zppa_submitted ? 'PUBLISHED' : app.zppa_status?.toUpperCase() || 'PENDING'}
               icon={<GlobeIcon />}
               color={app.zppa_submitted ? 'green' : app.zppa_status === 'overdue' ? 'red' : 'orange'}
             />
          </div>

          {/* Core Info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Plan Overview</h2>
             </div>
             <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-slate-50 rounded-lg shrink-0"><OfficeBuildingIcon className="w-5 h-5 text-slate-400"/></div>
                   <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</p><p className="text-sm font-semibold text-slate-900">{app.department_name}</p></div>
                </div>
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-slate-50 rounded-lg shrink-0"><CalendarIcon className="w-5 h-5 text-slate-400"/></div>
                   <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fiscal Year</p><p className="text-sm font-semibold text-slate-900">{app.fiscal_year_code}</p></div>
                </div>
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-slate-50 rounded-lg shrink-0"><UserCircleIcon className="w-5 h-5 text-slate-400"/></div>
                   <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created By</p><p className="text-sm font-semibold text-slate-900">{app.created_by_name || 'System'}</p></div>
                </div>
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg shrink-0"><ShieldCheckIcon className="w-5 h-5 text-slate-400"/></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Structure</p><p className="text-sm font-semibold text-slate-900">{app.is_consolidated ? 'Master Consolidated APP' : 'Stand-alone Dept APP'}</p></div>
                 </div>
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg shrink-0"><DatabaseIcon className="w-5 h-5 text-slate-400"/></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Version</p><p className="text-sm font-semibold text-slate-900">v{app.version || 1}{app.amends ? ` (amends ${app.amends_app_number || app.amends?.slice(0, 8)})` : ''}</p></div>
                 </div>
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-slate-50 rounded-lg shrink-0"><ClockIcon className="w-5 h-5 text-slate-400"/></div>
                   <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Creation Date</p><p className="text-sm font-semibold text-slate-900">{new Date(app.created_at).toLocaleDateString('en-GB')}</p></div>
                </div>
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-slate-50 rounded-lg shrink-0"><DatabaseIcon className="w-5 h-5 text-slate-400"/></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Modified</p><p className="text-sm font-semibold text-slate-900">{app.updated_at ? new Date(app.updated_at).toLocaleDateString('en-GB') : '---'}</p></div>
                </div>
             </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Planned Line Items</h2>
                <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-zammsa-green transition-colors">
                   <DownloadIcon className="w-4 h-4" />
                   CSV
                </button>
             </div>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                   <thead className="bg-slate-50/50">
                      <tr>
                         <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                         <th className="px-6 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                         <th className="px-6 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Issue Date</th>
                         <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Value (ZMW)</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50 bg-white">
                      {app.line_items?.map((item: any) => (
                         <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                            <td className="px-6 py-4">
                               <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.procurement_type}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                               <span className="inline-block px-2 py-0.5 border border-slate-200 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  {METHOD_LABELS_SHORT[item.recommended_method] || item.recommended_method}
                               </span>
                            </td>
                            <td className="px-6 py-4 text-center text-sm font-medium text-slate-500">
                               {item.planned_issue_date ? new Date(item.planned_issue_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '-'}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                               {Number(item.estimated_value).toLocaleString()}
                            </td>
                         </tr>
                      ))}
                      {(!app.line_items || app.line_items.length === 0) && (
                         <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm italic">No line items defined.</td></tr>
                      )}
                   </tbody>
                   {app.line_items && app.line_items.length > 0 && (
                      <tfoot className="bg-slate-50/50">
                         <tr>
                            <td colSpan={3} className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Estimated Value:</td>
                            <td className="px-6 py-3 text-right text-sm font-bold text-zammsa-green">ZMW {estimatedValue.toLocaleString()}</td>
                         </tr>
                      </tfoot>
                   )}
                </table>
             </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
           {/* Workflow Tracking */}
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Workflow Tracking</h2>
              <div className="space-y-5 relative before:absolute before:inset-0 before:ml-1.5 before:h-full before:w-px before:bg-slate-100">
                 {WORKFLOW_STEPS.map((step, i) => {
                    const isCurrent = step.statuses.includes(status);
                    const isDone = !isCurrent && status !== 'draft' && status !== 'rejected' && WORKFLOW_STEPS.slice(i+1).some(s => s.statuses.includes(status));
                    const isRejected = status === 'rejected' && isCurrent;

                    return (
                       <div key={i} className="relative flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full z-10 ring-4 ring-white ${
                             isDone ? 'bg-emerald-500 shadow-sm' : isCurrent ? (isRejected ? 'bg-rose-500 animate-pulse' : 'bg-amber-500 animate-pulse') : 'bg-slate-200'
                          }`} />
                          <span className={`text-[11px] font-semibold uppercase tracking-tight ${
                             isDone ? 'text-slate-400' : isCurrent ? (isRejected ? 'text-rose-600' : 'text-amber-600') : 'text-slate-300'
                          }`}>
                             {step.label}
                          </span>
                       </div>
                    );
                 })}
              </div>
           </div>

           {/* Actions Area */}
            { (canSubmit || canApprove || canRejectReturn || canCompliance || canConsolidate || canPublish || canSubmitToZPPA || canQuarterlyUpdate) && (
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Operations</h2>
                  <div className="space-y-3">
                     {canSubmit && (
                        <button onClick={() => doAction('submit')} disabled={actionLoading !== ''} className="w-full py-2.5 bg-zammsa-green text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-zammsa-green-dark transition-all disabled:opacity-50">Submit Plan</button>
                     )}
                     {canApprove && (
                        <button onClick={() => doAction('approve')} disabled={actionLoading !== ''} className="w-full py-2.5 bg-zammsa-green text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-zammsa-green-dark transition-all disabled:opacity-50">Approve Plan</button>
                     )}
                     {canCompliance && (
                        <button onClick={() => setShowComplianceModal(true)} className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-all">Verify Compliance</button>
                     )}
                     {canConsolidate && (
                        <button onClick={() => setShowConsolidateModal(true)} className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-all">Consolidate</button>
                     )}
                     {canQuarterlyUpdate && (
                        <button onClick={() => setShowQuarterlyModal(true)} className="w-full py-2.5 bg-amber-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-amber-600 transition-all">Quarterly Update</button>
                     )}
                     {canPublish && (
                        <button onClick={() => doAction('publish')} disabled={actionLoading !== ''} className="w-full py-2.5 bg-zammsa-green text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-zammsa-green-dark transition-all">Publish GPN</button>
                     )}
                    {canSubmitToZPPA && (
                       <button onClick={() => setShowZPPAModal(true)} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-indigo-700 transition-all">Registry Submit</button>
                    )}
                    {canRejectReturn && (
                       <div className="grid grid-cols-2 gap-2 mt-4">
                          <button onClick={() => setShowReturnModal(true)} className="py-2 border border-amber-200 text-amber-600 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-50">Return</button>
                          <button onClick={() => setShowRejectModal(true)} className="py-2 border border-rose-200 text-rose-600 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-rose-50">Reject</button>
                       </div>
                    )}
                 </div>
              </div>
           )}

           {/* Approval Trail */}
           {app.approval_trail && app.approval_trail.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                 <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Decision Trail</h2>
                 <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:h-full before:w-px before:bg-slate-100">
                    {app.approval_trail.map((entry, i) => (
                       <div key={i} className="relative flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg border-2 border-white shadow-sm flex items-center justify-center shrink-0 z-10 ${
                             entry.action.includes('approved') ? 'bg-emerald-500 text-white' : entry.action.includes('rejected') ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                          }`}>
                             {entry.action.includes('approved') ? <CheckCircleIcon className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                             <p className="text-xs font-semibold text-slate-900">{entry.user_name}</p>
                             <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{entry.role.replace(/_/g, ' ')}</p>
                             <p className="text-[10px] font-bold text-emerald-600 uppercase mt-1 tracking-wider">{entry.action.replace(/_/g, ' ')}</p>
                             {entry.details?.reason && <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg italic leading-snug">"{entry.details.reason}"</p>}
                             <p className="text-[9px] font-semibold text-slate-300 uppercase mt-2">{new Date(entry.timestamp).toLocaleString('en-GB')}</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           )}
        </div>
      </div>

      {/* Simplified Modal Overlays */}
      {(showReturnModal || showRejectModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h3 className="text-xl font-bold text-slate-900">{showReturnModal ? 'Return for Revision' : 'Reject APP'}</h3>
            <p className="text-sm text-slate-500 mt-2">Please provide a justification for this decision.</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Details..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm mt-4 focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green outline-none transition-all" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowReturnModal(false); setShowRejectModal(false); setReason(''); }} className="flex-1 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all uppercase">Cancel</button>
              <button onClick={() => doAction(showReturnModal ? 'return' : 'reject', { reason })} disabled={!reason || actionLoading !== ''} className={`flex-1 py-2.5 text-xs font-bold text-white rounded-lg transition-all uppercase ${showReturnModal ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showComplianceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h3 className="text-xl font-bold text-slate-900">Compliance Review</h3>
            <p className="text-sm text-slate-500 mt-2">Verify that this APP aligns with procurement regulations.</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Verification notes..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm mt-4 outline-none focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green transition-all mb-4" />
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => doAction('compliance', { compliance_status: 'compliant', notes: reason })} disabled={actionLoading !== ''} className="py-2.5 bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase hover:bg-emerald-600 transition-all">Compliant</button>
               <button onClick={() => doAction('compliance', { compliance_status: 'non_compliant', notes: reason })} disabled={actionLoading !== '' || !reason} className="py-2.5 bg-rose-500 text-white rounded-lg text-xs font-bold uppercase hover:bg-rose-600 transition-all">Non-Compliant</button>
            </div>
              <button onClick={() => setShowComplianceModal(false)} className="w-full mt-3 py-2 text-xs font-bold text-slate-400 uppercase hover:text-slate-600">Cancel</button>
           </div>
         </div>
       )}

      {/* Quarterly Update Modal */}
      {showQuarterlyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
            <h3 className="text-xl font-bold text-slate-900">Quarterly APP Update</h3>
            <p className="text-sm text-slate-500 mt-2">
              Create a new version of this APP with updated line items. 
              Changes within 20% of the original total value will auto-advance to procurement review.
            </p>
            <div className="space-y-4 mt-6">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Change Justification *</label>
                <textarea
                  value={quarterlyJustification}
                  onChange={(e) => setQuarterlyJustification(e.target.value)}
                  rows={3}
                  placeholder="Explain the reason for this quarterly update..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                  Line Items (updated) — {app.line_items?.length || 0} current items will be copied; modify values below
                </label>
                <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-3">
                  {(app.line_items || []).map((item: any, i: number) => (
                    <div key={item.line_item_id || i} className="flex gap-2 items-center">
                      <input
                        data-qty-desc
                        type="text"
                        defaultValue={item.description}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-zammsa-green"
                      />
                      <input
                        data-qty-val
                        type="number"
                        defaultValue={item.estimated_value}
                        className="w-28 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium text-right outline-none focus:ring-1 focus:ring-zammsa-green"
                      />
                    </div>
                  ))}
                  {(!app.line_items || app.line_items.length === 0) && (
                    <p className="text-xs text-slate-400 italic text-center py-4">No existing line items. Add items after creation.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowQuarterlyModal(false); setQuarterlyJustification(''); setQuarterlyItems([]); }}
                className="flex-1 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all uppercase"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const items = (app.line_items || []).map((item: any, i: number) => {
                    const descInput = document.querySelectorAll<HTMLInputElement>('[data-qty-desc]')[i];
                    const valInput = document.querySelectorAll<HTMLInputElement>('[data-qty-val]')[i];
                    return {
                      description: descInput?.value || item.description,
                      estimated_value: parseFloat(valInput?.value || item.estimated_value) || 0,
                      procurement_type: item.procurement_type || 'goods',
                      funding_source: item.funding_source,
                      commodity: item.commodity,
                      is_citizen_reserved: item.is_citizen_reserved,
                    };
                  });
                  try {
                    const res = await procurementPlanningApi.createQuarterlyUpdate(id!, {
                      change_justification: quarterlyJustification,
                      items,
                    });
                    toast.success(res.message || 'Quarterly update created');
                    setShowQuarterlyModal(false);
                    setQuarterlyJustification('');
                    loadData();
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || 'Failed to create quarterly update');
                  }
                }}
                disabled={!quarterlyJustification}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-all uppercase disabled:opacity-50"
              >
                Create Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
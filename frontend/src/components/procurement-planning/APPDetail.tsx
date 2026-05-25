import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { procurementPlanningApi, budgetApi } from '../../api/procurement_planning';
import { AnnualProcurementPlan, BudgetSummary } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { 
  ArrowLeftIcon, PencilIcon, CheckCircleIcon, XIcon, 
  DocumentTextIcon, CalendarIcon, OfficeBuildingIcon, 
  UserCircleIcon, GlobeIcon, ExclamationIcon, CashIcon,
  ClipboardListIcon, DownloadIcon, ShieldCheckIcon, ClockIcon,
  DatabaseIcon, LightningBoltIcon, ChatAlt2Icon
} from '@heroicons/react/outline';

const METHOD_LABELS: Record<string, string> = {
  open_national_bidding: 'Open National Bidding',
  open_international_bidding: 'Open International Bidding',
  limited_selection: 'Limited Selection',
  simplified_bidding: 'Simplified Bidding',
  direct_selection: 'Direct Selection',
};

const METHOD_LABELS_SHORT: Record<string, string> = {
  open_national_bidding: 'ONB',
  open_international_bidding: 'OIB',
  limited_selection: 'LS',
  simplified_bidding: 'SIM',
  direct_selection: 'DIR',
};

const PUBLICATION_TARGETS = [
  { key: 'zammsa_website', label: 'ZAMMSA Website', icon: GlobeIcon, description: 'Auto-publish to public notices portal' },
  { key: 'zppa_egp', label: 'ZPPA e-GP Portal', icon: ShieldCheckIcon, description: 'Automatic API submission to regulatory portal' },
  { key: 'supplier_notifications', label: 'Supplier Email Alerts', icon: LightningBoltIcon, description: 'Notify registered vendors in relevant categories' },
];

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
  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
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
  
  // GPN State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishingGPN, setPublishingGPN] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState(['zammsa_website', 'zppa_egp', 'supplier_notifications']);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [gpnPreviewData, setGpnPreviewData] = useState<any>(null);
  const [gpnContent, setGpnContent] = useState({
    notice_heading: '',
    notice_body: '',
    contact_name: 'Director of Procurement',
    contact_email: 'procurement@zammsa.gov.zm',
    contact_phone: '+260 211 123456',
    contact_address: 'Plot 1, Government Road, Lusaka',
    issuing_authority: 'Zambia Medicines and Medical Supplies Agency',
    gpn_reference: ''
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [res, budgetRes] = await Promise.all([
        procurementPlanningApi.get(id),
        budgetApi.summary()
      ]);
      setApp(res);
      setBudgets([budgetRes]);
      
      // Initialize GPN content if available
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
           setPublishingGPN(true);
           res = await procurementPlanningApi.publish(id, { ...gpnContent, publication_targets: selectedTargets }); 
           setPublishingGPN(false);
           setPublishSuccess(true);
           break;
        case 'zppa-submit': res = await procurementPlanningApi.submitToZPPA(id, zppaRef); break;
        case 'generate-gpn': res = await procurementPlanningApi.generateGPN(id); break;
      }
      toast.success(res?.message || 'Action completed successfully');
      loadData();
      // Reset modals
      setShowReturnModal(false); setShowRejectModal(false); 
      setShowComplianceModal(false); setShowConsolidateModal(false);
      setShowZPPAModal(false); setReason('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
    setActionLoading('');
  };

  const handleGPNInputChange = (field: string, value: string) => {
    setGpnContent(prev => ({ ...prev, [field]: value }));
  };

  const togglePublicationTarget = (target: string) => {
    setSelectedTargets(prev => 
      prev.includes(target) ? prev.filter(t => t !== target) : [...prev, target]
    );
  };

  if (loading) return <LoadingSpinner className="py-24" />;
  if (!app) return <div className="text-center py-24 text-gray-500 font-bold uppercase tracking-widest">Plan not found</div>;

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
  const canGenerateGPN = status === 'approved' && role === 'procurement_officer';
  const canPublish = status === 'approved' && role === 'procurement_officer';
  const isAlreadyPublished = status === 'published';
  const canSubmitToZPPA = status === 'published' && role === 'zppa_reporting_officer';

  const estimatedValue = Number(app.total_estimated_value || 0);

  return (
    <div className="pb-12 max-w-7xl mx-auto">
      <PageHeader 
        title={`${app.department_name} - APP ${app.fiscal_year_code}`}
        description={`Procurement Plan ID: ${app.app_id.slice(0, 8)}`}
        breadcrumbs={[
          { label: 'Procurement Planning', path: '/procurement-planning' },
          { label: 'View APP' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/procurement-planning" className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-all">
               <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            {status === 'draft' && (
               <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-xs font-bold text-gray-500 hover:text-blue-600 transition-all">
                  <PencilIcon className="w-4 h-4" />
                  <span className="uppercase tracking-widest">Edit Plan</span>
               </button>
            )}
            <StatusBadge status={status} className="py-2 px-4 shadow-sm" />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <StatCard 
               label="Consolidated Value"
               value={`ZMW ${estimatedValue.toLocaleString()}`}
               icon={<CashIcon className="w-6 h-6" />}
               color="green"
               description="Total plan estimate"
             />
             <StatCard 
               label="Line Items"
               value={app.line_items?.length || 0}
               icon={<ClipboardListIcon className="w-6 h-6" />}
               color="blue"
               description="Planned procurements"
             />
             <StatCard 
               label="Registry Status"
               value={app.zppa_submitted ? 'PUBLISHED' : app.zppa_status?.toUpperCase() || 'WAITING'}
               icon={<GlobeIcon className="w-6 h-6" />}
               color={app.zppa_submitted ? 'green' : app.zppa_status === 'overdue' ? 'red' : 'orange'}
               description={app.zppa_reference || 'ZPPA regulatory status'}
             />
          </div>

          {/* Core Info */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
             <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Plan Details</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-12">
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><OfficeBuildingIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Department</p><p className="text-sm font-bold text-gray-900">{app.department_name}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><CalendarIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fiscal Year</p><p className="text-sm font-bold text-gray-900">{app.fiscal_year_code}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><UserCircleIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Owner</p><p className="text-sm font-bold text-gray-900">{app.created_by_name || 'System'}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><ShieldCheckIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Consolidation</p><p className="text-sm font-bold text-gray-900">{app.is_consolidated ? 'Master APP' : 'Single Dept APP'}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><ClockIcon className="w-5 h-5 text-gray-400"/></div>
                   <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Created</p><p className="text-sm font-bold text-gray-900">{new Date(app.created_at).toLocaleDateString('en-GB')}</p></div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><DatabaseIcon className="w-5 h-5 text-gray-400"/></div>
                    <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Update</p><p className="text-sm font-bold text-gray-900">{app.updated_at ? new Date(app.updated_at).toLocaleDateString('en-GB') : '---'}</p></div>
                </div>
             </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-8 flex items-center justify-between border-b border-gray-50">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Planned Line Items</h2>
                <button className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-100 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-zammsa-green transition-colors">
                   <DownloadIcon className="w-3 h-3" />
                   Download CSV
                </button>
             </div>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-50">
                   <thead className="bg-gray-50/30">
                      <tr>
                         <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                         <th className="px-8 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Method</th>
                         <th className="px-8 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Planned Issue</th>
                         <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value (ZMW)</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {app.line_items?.map((item: any) => (
                         <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="px-8 py-5">
                               <p className="text-sm font-bold text-gray-800">{item.description}</p>
                               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{item.procurement_type}</p>
                            </td>
                            <td className="px-8 py-5 text-center">
                               <span className="inline-block px-2.5 py-1 bg-white border border-gray-100 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:border-zammsa-green transition-colors">
                                  {METHOD_LABELS_SHORT[item.recommended_method] || item.recommended_method}
                               </span>
                            </td>
                            <td className="px-8 py-5 text-center text-sm font-medium text-gray-500">
                               {item.planned_issue_date ? new Date(item.planned_issue_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '-'}
                            </td>
                            <td className="px-8 py-5 text-right text-sm font-black text-gray-900">
                               {Number(item.estimated_value).toLocaleString()}
                            </td>
                         </tr>
                      ))}
                      {(!app.line_items || app.line_items.length === 0) && (
                         <tr><td colSpan={4} className="px-8 py-12 text-center text-gray-400 italic text-sm">No line items defined for this plan.</td></tr>
                      )}
                   </tbody>
                   {app.line_items && app.line_items.length > 0 && (
                      <tfoot className="bg-gray-50/50 font-black">
                         <tr>
                            <td colSpan={3} className="px-8 py-4 text-right text-[10px] text-gray-400 uppercase tracking-widest">Consolidated Estimated Total:</td>
                            <td className="px-8 py-4 text-right text-zammsa-green">ZMW {estimatedValue.toLocaleString()}</td>
                         </tr>
                      </tfoot>
                   )}
                </table>
             </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
           {/* Workflow Tracking */}
           <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Workflow Status</h2>
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-1.5 before:h-full before:w-0.5 before:bg-gray-100">
                 {WORKFLOW_STEPS.map((step, i) => {
                    const isCurrent = step.statuses.includes(status);
                    const isDone = !isCurrent && status !== 'draft' && status !== 'rejected' && WORKFLOW_STEPS.slice(i+1).some(s => s.statuses.includes(status));
                    const isRejected = status === 'rejected' && isCurrent;

                    return (
                       <div key={i} className="relative flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full z-10 ring-4 ring-white ${
                             isDone ? 'bg-emerald-500 shadow-lg shadow-emerald-100' : isCurrent ? (isRejected ? 'bg-rose-500 animate-pulse' : 'bg-amber-500 animate-pulse shadow-lg shadow-amber-100') : 'bg-gray-200'
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
           </div>

           {/* Actions */}
           { (canSubmit || canApprove || canRejectReturn || canCompliance || canConsolidate || canPublish || canSubmitToZPPA) && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                 <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Operations</h2>
                 <div className="space-y-3">
                    {canSubmit && (
                       <button onClick={() => doAction('submit')} disabled={actionLoading !== ''} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50">Submit Plan</button>
                    )}
                    {canApprove && (
                       <button onClick={() => doAction('approve')} disabled={actionLoading !== ''} className="w-full py-4 bg-zammsa-green text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-zammsa-green/20 hover:bg-zammsa-green-dark transition-all disabled:opacity-50">Approve Plan</button>
                    )}
                    {canCompliance && (
                       <button onClick={() => setShowComplianceModal(true)} className="w-full py-4 bg-white border border-indigo-200 text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">Verify Compliance</button>
                    )}
                    {canConsolidate && (
                       <button onClick={() => setShowConsolidateModal(true)} className="w-full py-4 bg-white border border-purple-200 text-purple-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-purple-50 transition-all">Consolidate</button>
                    )}
                    {canPublish && (
                       <button onClick={() => setShowPublishModal(true)} className="w-full py-4 bg-zammsa-green text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-zammsa-green/20 hover:bg-zammsa-green-dark transition-all">Publish GPN</button>
                    )}
                    {canSubmitToZPPA && (
                       <button onClick={() => setShowZPPAModal(true)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Registry Submit</button>
                    )}
                    {canRejectReturn && (
                       <div className="grid grid-cols-2 gap-2 mt-4">
                          <button onClick={() => setShowReturnModal(true)} className="py-3 border border-amber-200 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50">Return</button>
                          <button onClick={() => setShowRejectModal(true)} className="py-3 border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50">Reject</button>
                       </div>
                    )}
                 </div>
              </div>
           )}

           {/* Approval Trail */}
           {app.approval_trail && app.approval_trail.length > 0 && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Decision Trail</h2>
                    <ClockIcon className="w-5 h-5 text-gray-200" />
                 </div>
                 <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gray-50">
                    {app.approval_trail.map((entry, i) => (
                       <div key={i} className="relative flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl border-4 border-white shadow-sm flex items-center justify-center shrink-0 z-10 ${
                             entry.action.includes('approved') ? 'bg-emerald-500 text-white' : entry.action.includes('rejected') ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                          }`}>
                             {entry.action.includes('approved') ? <CheckCircleIcon className="w-5 h-5" /> : <XIcon className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                             <p className="text-xs font-bold text-gray-800">{entry.user_name}</p>
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{entry.role.replace(/_/g, ' ')}</p>
                             <p className="text-[10px] font-black text-emerald-600 uppercase mt-1 tracking-widest">{entry.action.replace(/_/g, ' ')}</p>
                             {entry.details?.reason && <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-3 rounded-xl italic leading-relaxed">"{entry.details.reason}"</p>}
                             <p className="text-[9px] font-bold text-gray-300 uppercase mt-2">{new Date(entry.timestamp).toLocaleString('en-GB')}</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           )}
        </div>
      </div>

      {/* Action Modals */}
      {(showReturnModal || showRejectModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-white/20 transform animate-in zoom-in-95 duration-300">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
              showReturnModal ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
            }`}>
               {showReturnModal ? <ArrowLeftIcon className="w-8 h-8" /> : <XIcon className="w-8 h-8" />}
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{showReturnModal ? 'Return for Revision' : 'Reject APP'}</h3>
            <p className="text-sm font-medium text-gray-500 mt-2 leading-relaxed">Please provide a detailed reason for this decision. This will be visible to the department staff.</p>
            
            <textarea 
               value={reason} 
               onChange={(e) => setReason(e.target.value)} 
               rows={4} 
               placeholder="Decision details..." 
               className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm mt-6 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all" 
            />
            
            <div className="flex gap-4 mt-8">
              <button onClick={() => { setShowReturnModal(false); setShowRejectModal(false); setReason(''); }} className="flex-1 py-4 text-sm font-bold text-gray-500 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all uppercase tracking-widest">Cancel</button>
              <button 
                onClick={() => doAction(showReturnModal ? 'return' : 'reject', { reason })}
                disabled={!reason || actionLoading !== ''} 
                className={`flex-1 py-4 text-sm font-bold text-white rounded-2xl shadow-lg transition-all uppercase tracking-widest disabled:opacity-50 ${showReturnModal ? 'bg-amber-500 shadow-amber-100 hover:bg-amber-600' : 'bg-rose-500 shadow-rose-100 hover:bg-rose-600'}`}>
                {actionLoading ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Modal */}
      {showComplianceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
             <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-6">
                <ShieldCheckIcon className="w-8 h-8" />
             </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Compliance Review</h3>
            <p className="text-sm font-medium text-gray-500 mt-2 mb-6">Verify that this APP aligns with public procurement regulations and agency policies.</p>
            
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Verification notes..." className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all mb-6" />
            
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => doAction('compliance', { compliance_status: 'compliant', notes: reason })} disabled={actionLoading !== ''} className="py-4 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-600 disabled:opacity-50 transition-all">Mark Compliant</button>
                 <button onClick={() => doAction('compliance', { compliance_status: 'non_compliant', notes: reason })} disabled={actionLoading !== '' || !reason} className="py-4 bg-rose-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-100 hover:bg-rose-600 disabled:opacity-50 transition-all">Non-Compliant</button>
              </div>
              <button onClick={() => setShowComplianceModal(false)} className="py-3 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Consolidate Modal */}
      {showConsolidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-white/20">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-6">
               <DatabaseIcon className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Consolidate Plan</h3>
            <p className="text-sm font-medium text-gray-500 mt-2">Merge these line items into a Master APP for ZAMMSA-wide reporting.</p>
            
            <input 
               value={consolidateTarget} 
               onChange={(e) => setConsolidateTarget(e.target.value)} 
               placeholder="Target APP UUID Reference" 
               className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm mt-6 font-mono focus:ring-4 focus:ring-purple-500/5 outline-none transition-all" 
            />
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Consolidation notes (optional)" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm mt-3 outline-none focus:ring-4 focus:ring-purple-500/5 transition-all" />
            
            <div className="flex gap-4 mt-8">
              <button onClick={() => { setShowConsolidateModal(false); setConsolidateTarget(''); setReason(''); }} className="flex-1 py-4 text-sm font-bold text-gray-500 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all uppercase tracking-widest">Cancel</button>
              <button onClick={() => doAction('consolidate', { consolidate_into: consolidateTarget, notes: reason })} disabled={!consolidateTarget || actionLoading !== ''} className="flex-1 py-4 bg-purple-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-purple-100 hover:bg-purple-700 disabled:opacity-50 transition-all">Merge now</button>
            </div>
          </div>
        </div>
      )}

      {/* Publish / GPN Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-md overflow-y-auto p-6">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-6xl w-full transform animate-in slide-in-from-bottom-8 duration-500">
            <div className="flex items-center justify-between p-10 border-b border-gray-50">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">General Procurement Notice</h2>
                <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-widest">
                  Ready for Global Publication &bull; FY {app?.fiscal_year_code}
                </p>
              </div>
              <button onClick={() => { setShowPublishModal(false); setPublishSuccess(false); }} className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:text-rose-600 transition-all">
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            {publishSuccess && (
              <div className="bg-emerald-500 p-6 flex items-center justify-center gap-4 text-white">
                <CheckCircleIcon className="w-8 h-8" />
                <p className="text-lg font-black uppercase tracking-widest">Plan successfully published to registry</p>
              </div>
            )}

            <div className="p-10 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                {/* Left Section - Config */}
                <div className="lg:col-span-3 space-y-10">
                   <div className="bg-gray-50/50 rounded-3xl border border-gray-100 p-8">
                      <div className="flex items-center justify-between mb-8">
                         <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Contact Metadata</h3>
                         <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">Auto-Assigned</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-1">
                             <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Issuing Authority</label>
                            <input value={gpnContent.issuing_authority} onChange={e => handleGPNInputChange('issuing_authority', e.target.value)} className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                         </div>
                         <div className="space-y-1">
                             <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Contact Name</label>
                            <input value={gpnContent.contact_name} onChange={e => handleGPNInputChange('contact_name', e.target.value)} className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                         </div>
                         <div className="space-y-1">
                             <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Email Address</label>
                            <input value={gpnContent.contact_email} onChange={e => handleGPNInputChange('contact_email', e.target.value)} className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                         </div>
                         <div className="space-y-1">
                             <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Phone Reference</label>
                            <input value={gpnContent.contact_phone} onChange={e => handleGPNInputChange('contact_phone', e.target.value)} className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                         </div>
                      </div>
                      <div className="mt-6 space-y-1">
                         <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Physical Address</label>
                         <textarea value={gpnContent.contact_address} onChange={e => handleGPNInputChange('contact_address', e.target.value)} rows={2} className="w-full bg-white border border-gray-100 rounded-2xl p-5 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                      </div>
                   </div>

                   <div className="space-y-6">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Registry Publication Channels</h3>
                      <div className="grid grid-cols-1 gap-4">
                         {PUBLICATION_TARGETS.map(channel => (
                            <div key={channel.key} onClick={() => togglePublicationTarget(channel.key)} className={`group flex items-start gap-5 p-6 rounded-3xl border transition-all cursor-pointer ${
                               selectedTargets.includes(channel.key) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100 hover:border-gray-200'
                            }`}>
                               <div className={`p-4 rounded-2xl shrink-0 transition-colors ${
                                  selectedTargets.includes(channel.key) ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'
                               }`}>
                                  <channel.icon className="w-6 h-6" />
                               </div>
                               <div>
                                  <div className="flex items-center gap-3 mb-1">
                                     <p className={`font-black text-sm uppercase tracking-widest ${selectedTargets.includes(channel.key) ? 'text-emerald-900' : 'text-gray-900'}`}>{channel.label}</p>
                                     {selectedTargets.includes(channel.key) && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
                                  </div>
                                  <p className="text-sm font-medium text-gray-500 leading-relaxed">{channel.description}</p>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Right Section - Items Preview */}
                <div className="lg:col-span-2 space-y-8">
                   <div className="bg-gray-900 rounded-3xl p-8 shadow-xl shadow-gray-200">
                      <div className="flex items-center justify-between mb-8">
                         <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Notice Content</h3>
                         <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      </div>
                      <div className="space-y-6">
                         <div>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Heading</p>
                            <p className="text-sm font-bold text-white leading-snug">{gpnContent.notice_heading}</p>
                         </div>
                         <div className="h-px bg-white/5" />
                         <div>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Notice Body</p>
                            <p className="text-xs text-white/70 leading-relaxed italic line-clamp-4">"{gpnContent.notice_body}"</p>
                         </div>
                         <div className="pt-4">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4">Registry Line Items (Top 5)</p>
                            <div className="space-y-3">
                               {(app.line_items || []).slice(0, 5).map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-4">
                                     <p className="text-xs font-bold text-white/90 truncate">{item.description}</p>
                                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter shrink-0">{item.recommended_method ? (METHOD_LABELS_SHORT[item.recommended_method] || '---') : '---'}</span>
                                  </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="bg-amber-50 rounded-3xl border border-amber-100 p-8">
                      <div className="flex items-center gap-4 mb-4 text-amber-700">
                         <ExclamationIcon className="w-8 h-8 shrink-0" />
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest">Compliance Deadline</p>
                            <p className="text-lg font-black tracking-tight">ZPPA Regulatory Limit</p>
                         </div>
                      </div>
                      <p className="text-sm font-medium text-amber-800 leading-relaxed mb-6">According to Article 45, you must submit this GPN to the ZPPA Registry within 30 days of approval.</p>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-white/50 p-4 rounded-2xl border border-amber-100">
                            <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Approval Date</p>
                            <p className="text-sm font-black text-gray-900">{app?.approved_at ? new Date(app.approved_at).toLocaleDateString('en-GB') : '---'}</p>
                         </div>
                         <div className="bg-white/50 p-4 rounded-2xl border border-amber-100">
                            <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Due Deadline</p>
                            <p className="text-sm font-black text-rose-600">{app?.zppa_deadline ? new Date(app.zppa_deadline).toLocaleDateString('en-GB') : '---'}</p>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-10 border-t border-gray-50 bg-gray-50/50 rounded-b-[32px]">
              <button 
                onClick={() => setShowPDFPreview(true)}
                className="flex items-center gap-3 px-6 py-4 bg-white border border-gray-200 text-sm font-black text-gray-500 uppercase tracking-widest rounded-2xl hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
              >
                <DocumentTextIcon className="w-5 h-5" />
                Inspect PDF Draft
              </button>
              <div className="flex items-center gap-4">
                <button onClick={() => { setShowPublishModal(false); setPublishSuccess(false); }} className="px-8 py-4 text-sm font-black text-gray-400 uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => doAction('publish')} 
                  disabled={publishingGPN || selectedTargets.length === 0} 
                  className="px-10 py-5 bg-zammsa-green text-white rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-zammsa-green/30 hover:bg-zammsa-green-dark transition-all disabled:opacity-50 flex items-center gap-3"
                >
                  {publishingGPN ? <LoadingSpinner size="sm" className="text-white" /> : <LightningBoltIcon className="w-5 h-5 animate-pulse" />}
                  {publishingGPN ? 'Dispatching...' : 'Publish Global GPN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZPPA Modal */}
      {showZPPAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-white/20 transform animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-6">
               <ShieldCheckIcon className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">ZPPA Registry Submission</h3>
            <p className="text-sm font-medium text-gray-500 mt-2 leading-relaxed">Enter the official reference number provided by the ZPPA e-GP Portal to finalize this plan's registry status.</p>
            
            <div className="mt-8 space-y-6">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">ZPPA Reference ID</label>
                  <input 
                     value={zppaRef} 
                     onChange={(e) => setZppaRef(e.target.value)} 
                     placeholder="e.g. ZPPA/2026/GPN/1234" 
                     className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-black text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                  />
               </div>
               
               {app.zppa_deadline && (
                 <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 text-amber-700">
                    <span className="text-[10px] font-black uppercase tracking-widest">Target Deadline</span>
                    <span className="text-xs font-black">{new Date(app.zppa_deadline).toLocaleDateString('en-GB')}</span>
                 </div>
               )}
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowZPPAModal(false)} className="flex-1 py-4 text-sm font-bold text-gray-500 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all uppercase tracking-widest">Cancel</button>
              <button onClick={() => doAction('zppa-submit')} disabled={!zppaRef || actionLoading !== ''} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50">Link Registry</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Full Modal */}
      {showPDFPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/90 backdrop-blur-xl p-4 sm:p-10 overflow-y-auto">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-5xl w-full">
            <div className="flex items-center justify-between p-10 border-b border-gray-50">
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">Registry Document Preview</h3>
              <button onClick={() => setShowPDFPreview(false)} className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:text-rose-600 transition-all">
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-10">
               {/* Document simulation */}
               <div className="border-8 border-gray-50 rounded-[32px] p-12 bg-white max-w-3xl mx-auto shadow-inner min-h-[800px] flex flex-col font-serif">
                  <div className="text-center mb-16 pb-8 border-b-2 border-gray-800">
                     <h1 className="text-3xl font-bold text-gray-900 mb-2 uppercase tracking-tighter">Zambia Medicines and Medical Supplies Agency</h1>
                     <h2 className="text-xl font-bold text-gray-800 underline uppercase">General Procurement Notice</h2>
                     <p className="text-sm font-bold text-gray-500 mt-8">NOTICE REFERENCE: {gpnContent.gpn_reference || 'ZPPA/2026/GPN/TBD'}</p>
                  </div>
                  
                  <div className="space-y-12 flex-1">
                     <section>
                        <h4 className="font-bold text-lg mb-2 uppercase text-gray-900 underline decoration-1 underline-offset-4">1. General Overview</h4>
                        <p className="text-base text-gray-800 leading-loose text-justify">{gpnContent.notice_body}</p>
                     </section>
                     
                     <section>
                        <h4 className="font-bold text-lg mb-4 uppercase text-gray-900 underline decoration-1 underline-offset-4">2. Summary of Requirements</h4>
                        <table className="w-full border-collapse border border-gray-800 text-sm">
                           <thead>
                              <tr className="bg-gray-100">
                                 <th className="border border-gray-800 p-3 text-left">Description of Goods / Services</th>
                                 <th className="border border-gray-800 p-3 text-right">Estimated Value (ZMW)</th>
                                 <th className="border border-gray-800 p-3 text-center">Method</th>
                              </tr>
                           </thead>
                           <tbody>
                              {(app.line_items || []).slice(0, 10).map((item: any, i: number) => (
                                 <tr key={i}>
                                    <td className="border border-gray-800 p-3 font-medium">{item.description}</td>
                                    <td className="border border-gray-800 p-3 text-right font-bold">{Number(item.estimated_value).toLocaleString()}</td>
                                    <td className="border border-gray-800 p-3 text-center uppercase">{METHOD_LABELS_SHORT[item.recommended_method] || '---'}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </section>
                     
                     <section className="bg-gray-50/50 p-8 border border-gray-200">
                        <h4 className="font-bold text-lg mb-4 uppercase text-gray-900 underline decoration-1 underline-offset-4">3. Point of Contact</h4>
                        <div className="grid grid-cols-2 gap-4 text-base">
                           <p><strong>Authority:</strong> {gpnContent.issuing_authority}</p>
                           <p><strong>Contact:</strong> {gpnContent.contact_name}</p>
                           <p><strong>Email:</strong> {gpnContent.contact_email}</p>
                           <p><strong>Phone:</strong> {gpnContent.contact_phone}</p>
                           <p className="col-span-2"><strong>Address:</strong> {gpnContent.contact_address}</p>
                        </div>
                     </section>
                  </div>
                  
                  <div className="pt-12 text-center text-xs text-gray-400 font-sans tracking-widest uppercase">
                     Official GPN Registry Draft &bull; Internal System Generated &bull; {new Date().getFullYear()}
                  </div>
               </div>
            </div>
            <div className="flex justify-end gap-3 p-10 border-t border-gray-50 bg-gray-50/50 rounded-b-[40px]">
              <button onClick={() => setShowPDFPreview(false)} className="px-8 py-4 text-sm font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">Close View</button>
              <button 
                 onClick={() => toast.success('Generation queued for background worker')}
                 className="flex items-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-[24px] text-sm font-black uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                <DownloadIcon className="w-5 h-5" />
                Commit to Disk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
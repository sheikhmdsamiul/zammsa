import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { procurementPlanningApi, budgetApi } from '../../api/procurement_planning';
import { AnnualProcurementPlan, BudgetSummary } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  CurrencyDollarIcon, CheckCircleIcon, XCircleIcon,
  DocumentTextIcon, ExclamationIcon, ReplyIcon,
  PencilAltIcon, GlobeIcon, MailIcon, OfficeBuildingIcon,
} from '@heroicons/react/outline';

const APPROVAL_CHAIN = [
  { stage: 'draft', label: 'Dept Staff', role: 'user_dept_staff' },
  { stage: 'dept_head_review', label: 'Dept Head', role: 'department_head' },
  { stage: 'procurement_review', label: 'Procurement Officer', role: 'procurement_officer' },
  { stage: 'director_review', label: 'Director of Procurement', role: 'director_procurement' },
  { stage: 'zpc_review', label: 'ZPC', role: 'zpc_member' },
  { stage: 'approved', label: 'Approved', role: null },
  { stage: 'published', label: 'Published', role: null },
];

const PUBLICATION_TARGETS = [
  { key: 'zammsa_website', label: 'ZAMMSA Website', description: 'Auto-published immediately upon clicking Publish', icon: GlobeIcon },
  { key: 'egp_portal', label: 'ZPPA e-GP Portal', description: 'API call triggered automatically', icon: OfficeBuildingIcon },
  { key: 'registered_supplier_email', label: 'Registered Supplier Email Notifications', description: '47 registered suppliers in relevant categories will receive email notification', icon: MailIcon },
  { key: 'govt_gazette', label: 'Government Gazette', description: 'System generates Gazette-formatted file for upload (submitted manually to Government Printer)', icon: DocumentTextIcon },
];

const METHOD_LABELS_SHORT: Record<string, string> = {
  open_tender: 'ONB',
  international: 'INT',
  limited: 'LIM',
  simplified: 'SIM',
  direct: 'Direct',
};

const METHOD_LABELS: Record<string, string> = {
  open_tender: 'Open National Bidding (ONB)',
  international: 'International Bidding (INT)',
  limited: 'Limited Bidding (LIM)',
  simplified: 'Simplified Bidding (SIM)',
  direct: 'Direct Procurement',
};

const APPDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [app, setApp] = useState<AnnualProcurementPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showConsolidateModal, setShowConsolidateModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showZPPAModal, setShowZPPAModal] = useState(false);
  const [reason, setReason] = useState('');
  const [consolidateTarget, setConsolidateTarget] = useState('');
  const [zppaRef, setZppaRef] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['zammsa_website', 'egp_portal', 'registered_supplier_email']);
  
  // GPN Preview state
  const [gpnContent, setGpnContent] = useState<Record<string, any>>({});
  const [gpnGenerating, setGpnGenerating] = useState(false);
  const [publishingGPN, setPublishingGPN] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [gpnPreviewData, setGpnPreviewData] = useState<{
    reference: string;
    fiscalYear: string;
    department: string;
    departmentCode: string;
    totalValue: number;
    lineItems: any[];
    zpcApprovedAt: string;
    zppaDeadline: string;
  } | null>(null);


  const generateGPNPreview = (appData: AnnualProcurementPlan) => {
    const fiscalYear = appData.fiscal_year_code || appData.fiscal_year || '';
    const deptCode = appData.department_code || '';
    const seq = '001';
    const reference = `GPN-${fiscalYear.replace('/', '-')}-${deptCode}-${seq}`;
    
    setGpnPreviewData({
      reference,
      fiscalYear,
      department: appData.department_name || '',
      departmentCode: deptCode,
      totalValue: appData.total_estimated_value || 0,
      lineItems: appData.line_items || [],
      zpcApprovedAt: appData.approved_at || '',
      zppaDeadline: appData.zppa_deadline || '',
    });
    
    setGpnContent({
      gpn_reference: reference,
      issuing_authority: 'ZAMMSA — Zambia Medicines and Medical Supplies Agency',
      contact_name: 'Director of Procurement',
      contact_email: 'procurement@zammsa.gov.zm',
      contact_phone: '+260 211 123456',
      contact_address: 'Plot 1, Government Road, Lusaka',
      notice_heading: `GENERAL PROCUREMENT NOTICE — ZAMMSA ANNUAL PROCUREMENT PLAN ${fiscalYear}`,
      notice_body: `The Zambia Medicines and Medical Supplies Agency (ZAMMSA) intends to procure the following goods and services during the financial year ${fiscalYear} and invites eligible suppliers to register their interest.\n\nEligible suppliers are encouraged to register on the ZAMMSA Supplier Portal at: https://portal.zammsa.gov.zm/suppliers`,
    });
  };

  const handleGPNInputChange = (field: string, value: string) => {
    setGpnContent((prev) => ({ ...prev, [field]: value }));
  };

  const togglePublicationTarget = (key: string) => {
    setSelectedTargets((prev) => {
      if (prev.includes(key)) {
        return prev.filter((t) => t !== key);
      }
      return [...prev, key];
    });
  };

  const loadAPP = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await procurementPlanningApi.detail(id);
      setApp(data);
      
      // If APP is approved and has GPN, load GPN content for preview
      if (data.status === 'approved' && data.gpns && data.gpns.length > 0) {
        const gpn = data.gpns[0];
        setGpnContent(gpn.content || {});
      } else if (data.status === 'approved') {
        // Generate GPN preview data from APP
        generateGPNPreview(data);
      }
    } catch { setApp(null); }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAPP(); }, [loadAPP]);

  const fetchBudget = useCallback(async (a: AnnualProcurementPlan) => {
    if (!a.department_code || !a.fiscal_year_code) return;
    setBudgetLoading(true);
    try {
      const res = await budgetApi.summary({ entity_code: a.department_code, fiscal_year: a.fiscal_year_code });
      setBudget(res);
    } catch {
      setBudget(null);
    }
    setBudgetLoading(false);
  }, []);

  useEffect(() => {
    if (app) fetchBudget(app);
  }, [app, fetchBudget]);

  const doAction = async (action: string, data?: any) => {
    setActionLoading(action);
    try {
      let res: any;
      switch (action) {
        case 'submit':
          res = await procurementPlanningApi.submit(id!);
          break;
        case 'approve':
          res = await procurementPlanningApi.approve(id!, data);
          toast.success(res.message);
          if (res.gpn) toast.success('GPN auto-generated');
          break;
        case 'reject':
          res = await procurementPlanningApi.reject(id!, data.reason);
          break;
        case 'return':
          res = await procurementPlanningApi.returnForRevision(id!, data.reason);
          break;
        case 'compliance':
          res = await procurementPlanningApi.complianceCheck(id!, data);
          break;
        case 'consolidate':
          res = await procurementPlanningApi.consolidate(id!, data.consolidate_into, data.notes);
          break;
        case 'publish':
          // First ensure GPN exists, then publish both APP and GPN
          if (!app?.gpns || app.gpns.length === 0) {
            await doAction('generate-gpn');
          }
          setPublishingGPN(true);
          try {
            // Publish GPN first
            if (app?.gpns && app.gpns.length > 0) {
              const gpnId = app.gpns[0].gpn_id;
              const emailStats = { count: 47, failed: 0 };
              await procurementPlanningApi.gpn.publish(gpnId, selectedTargets, [], {}, emailStats);
            }
            // Then publish APP
            res = await procurementPlanningApi.publishAPP(id!, { targets: selectedTargets, proofs: {} });
            setPublishSuccess(true);
            setTimeout(() => setPublishSuccess(false), 5000);
          } catch (err: any) {
            throw err;
          } finally {
            setPublishingGPN(false);
          }
          break;
        case 'generate-gpn':
          setGpnGenerating(true);
          try {
            res = await procurementPlanningApi.generateGPN(id!);
            setApp(prev => prev ? { ...prev, gpns: [res.gpn] } : null);
            setGpnContent(res.gpn.content || {});
            toast.success('GPN generated successfully');
          } finally {
            setGpnGenerating(false);
          }
          return res; // Return early to avoid duplicate toast
        case 'zppa-submit':
          res = await procurementPlanningApi.submitToZPPA(id!, zppaRef);
          break;
      }
      toast.success(res?.message || `${action} successful`);
      setShowReturnModal(false);
      setShowRejectModal(false);
      setShowConsolidateModal(false);
      setShowComplianceModal(false);
      setShowPublishModal(false);
      setShowZPPAModal(false);
      setReason('');
      setConsolidateTarget('');
      setZppaRef('');
      loadAPP();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || `${action} failed`);
    }
    setActionLoading('');
  };

  const role = user?.role || '';
  const status = app?.status || '';

  const currentStageIndex = APPROVAL_CHAIN.findIndex(s => s.stage === status);

  const canSubmit = status === 'draft' && role === 'user_dept_staff';
  const canApprove =
    (status === 'dept_head_review' && role === 'department_head') ||
    (status === 'procurement_review' && ['procurement_officer', 'procurement_manager', 'system_admin'].includes(role)) ||
    (status === 'director_review' && role === 'director_procurement') ||
    (status === 'zpc_review' && ['zpc_member', 'director_general'].includes(role)) ||
    (status === 'pending_zpc' && ['director_procurement', 'zpc_member', 'system_admin'].includes(role));
  const canRejectReturn = (status === 'dept_head_review' && role === 'department_head') ||
    (status === 'procurement_review' && ['procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'].includes(role)) ||
    (status === 'director_review' && role === 'director_procurement') ||
    (status === 'zpc_review' && ['zpc_member', 'director_general'].includes(role));
  const canCompliance = status === 'procurement_review' && ['procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'].includes(role);
  const canConsolidate = status === 'procurement_review' && ['procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'].includes(role);
  const canPublish = status === 'approved' && ['procurement_officer', 'procurement_manager', 'system_admin'].includes(role);
  const isAlreadyPublished = status === 'published';
  const canGenerateGPN = status === 'approved' && (!app?.gpns || app.gpns.length === 0);
  const canSubmitToZPPA = ['approved', 'published'].includes(status) && !app?.zppa_submitted && ['procurement_officer', 'procurement_manager', 'system_admin'].includes(role);
  const canEdit = status === 'draft' && role === 'user_dept_staff';

  const getZPPABadgeColor = (s?: string) => {
    switch (s) {
      case 'submitted': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'approaching': return 'bg-yellow-100 text-yellow-800';
      case 'on_track': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-ZM', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (d?: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-ZM');
  };

  const planTotal = app?.line_items?.reduce((s, i) => s + Number(i.estimated_value || 0), 0) || 0;
  const budgetRemaining = budget ? budget.total_available - planTotal : 0;
  const budgetOk = budgetRemaining >= 0;

  if (loading) return <div className="p-12"><LoadingSpinner size="lg" /></div>;
  if (!app) return <div className="p-12 text-center text-gray-500">APP not found</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Annual Procurement Plan</h1>
            <StatusBadge status={status} />
            {app.is_consolidated && (
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                Consolidated
              </span>
            )}
            {app.zppa_status && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getZPPABadgeColor(app.zppa_status)}`}>
                ZPPA: {app.zppa_status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {app.department_name} — FY {app.fiscal_year_code}
          </p>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            ID: {app.app_id} &middot; Created: {formatDate(app.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canEdit && (
            <Link
              to={`/procurement-planning/create?edit=${app.app_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <PencilAltIcon className="w-4 h-4" />
              Edit
            </Link>
          )}
          <button onClick={() => navigate('/procurement-planning')} className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to List
          </button>
        </div>
      </div>

      {/* Approval Chain */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {APPROVAL_CHAIN.map((stage, i) => {
            const isCompleted = currentStageIndex > i || status === stage.stage;
            const isCurrent = status === stage.stage;
            return (
              <React.Fragment key={stage.stage}>
                {i > 0 && <div className={`w-8 h-0.5 flex-shrink-0 ${isCompleted ? 'bg-zammsa-green' : 'bg-gray-300'}`} />}
                <div className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium text-center min-w-[80px] ${
                  isCurrent ? 'bg-zammsa-green text-white shadow-sm' : isCompleted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                }`}>
                  {stage.label}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Estimated Value</p>
          <p className="text-xl font-bold text-gray-900 mt-1">ZMW {Number(app.total_estimated_value).toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Submitted By</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{app.submitted_by_name || <span className="text-gray-400 italic">Not submitted</span>}</p>
          {app.submitted_at && <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(app.submitted_at)}</p>}
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Approved By</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{app.approved_by_name || <span className="text-gray-400 italic">Not approved</span>}</p>
          {app.approved_at && <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(app.approved_at)}</p>}
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Line Items</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{app.line_items?.length || 0}</p>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5 text-gray-500" />
            Budget Overview
          </h2>
          <button
            onClick={() => app && fetchBudget(app)}
            disabled={budgetLoading}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            {budgetLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {budget ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Allocated</p>
              <p className="text-lg font-bold text-gray-900">ZMW {Number(budget.total_allocated).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Encumbered</p>
              <p className="text-lg font-bold text-gray-900">ZMW {Number(budget.total_encumbered).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Available</p>
              <p className="text-lg font-bold text-gray-900">ZMW {Number(budget.total_available).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Plan Total</p>
              <p className={`text-lg font-bold ${budgetOk ? 'text-zammsa-green' : 'text-red-600'}`}>
                ZMW {planTotal.toLocaleString()}
              </p>
              {budget && (
                <p className={`text-xs mt-0.5 ${budgetOk ? 'text-green-600' : 'text-red-600'}`}>
                  {budgetOk ? 'Within budget' : `Over by ZMW ${Math.abs(budgetRemaining).toLocaleString()}`}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No budget allocation found for {app.department_code || 'this department'} / FY {app.fiscal_year_code}</p>
        )}
      </div>

      {/* ZPPA Deadline */}
      {app.zppa_deadline && (
        <div className={`rounded-lg border p-4 ${app.zppa_status === 'overdue' ? 'bg-red-50 border-red-200' : app.zppa_status === 'approaching' ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExclamationIcon className={`w-5 h-5 ${app.zppa_status === 'overdue' ? 'text-red-500' : app.zppa_status === 'approaching' ? 'text-yellow-500' : 'text-gray-400'}`} />
              <div>
                <p className="text-sm font-medium">ZPPA Submission Deadline</p>
                <p className="text-xs text-gray-500">Must be submitted within 30 days of approval</p>
              </div>
            </div>
            <div className="text-right">
              {app.zppa_submitted ? (
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-700">Submitted</p>
                    <p className="text-xs text-gray-500">Ref: {app.zppa_submission_ref}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className={`text-lg font-bold ${app.zppa_status === 'overdue' ? 'text-red-700' : app.zppa_status === 'approaching' ? 'text-yellow-700' : 'text-gray-900'}`}>
                    {app.zppa_days_remaining !== undefined && app.zppa_days_remaining !== null ? `${app.zppa_days_remaining} days remaining` : ''}
                  </p>
                  <p className="text-xs text-gray-500">Deadline: {formatDate(app.zppa_deadline)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GPN Publication Status */}
      {app.gpn_publication_targets && app.gpn_publication_targets.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">GPN Publication Status</h2>
            {app.gpns && app.gpns.length > 0 && (
              <Link to={`/procurement-planning/gpns/${app.gpns[0].gpn_id}`} className="text-sm text-zammsa-green hover:underline">View GPN &rarr;</Link>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {PUBLICATION_TARGETS.map(target => {
              const isPublished = app.gpn_publication_targets?.includes(target.key);
              return (
                <div key={target.key} className={`p-3 rounded-lg border ${isPublished ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <p className="text-sm font-medium">{target.label}</p>
                  <p className={`text-xs mt-1 ${isPublished ? 'text-green-700' : 'text-gray-400'}`}>
                    {isPublished ? 'Published' : 'Not published'}
                  </p>
                </div>
              );
            })}
          </div>
          {app.gpn_published_at && <p className="text-xs text-gray-400 mt-3">Published at: {formatDateTime(app.gpn_published_at)}</p>}
        </div>
      )}

      {/* Rejection Details */}
      {app.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Rejected</p>
              {app.rejected_by_name && <p className="text-xs text-red-600">By: {app.rejected_by_name}</p>}
              {app.rejected_at && <p className="text-xs text-red-500">{formatDateTime(app.rejected_at)}</p>}
              <p className="text-sm text-red-700 mt-1 bg-red-100 rounded px-2 py-1">{app.rejection_reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Notes */}
      {app.compliance_notes && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Compliance Notes</p>
              <p className="text-sm text-blue-700 mt-1">{app.compliance_notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Consolidation Details */}
      {(app.is_consolidated || (app.consolidated_from_count && app.consolidated_from_count > 0)) && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ReplyIcon className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-purple-800">Consolidation</p>
              {app.consolidated_from_count && app.consolidated_from_count > 0 && (
                <p className="text-xs text-purple-600">Consolidated from {app.consolidated_from_count} APP(s)</p>
              )}
              {app.consolidation_notes && (
                <p className="text-sm text-purple-700 mt-1">{app.consolidation_notes}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ZPC Resolution */}
      {app.zpc_resolution && Object.keys(app.zpc_resolution).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">ZPC Resolution</h2>
          <pre className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 overflow-x-auto">{JSON.stringify(app.zpc_resolution, null, 2)}</pre>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Line Items ({app.line_items?.length || 0})</h2>
          <span className="text-sm text-gray-500">Total: ZMW {Number(app.total_estimated_value).toLocaleString()}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Commodity</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Funding Source</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Citizen Reserved</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Method</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Issue Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Award Date</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Value (ZMW)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {app.line_items?.map((item, idx) => (
                <tr key={item.line_item_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-900 max-w-[200px]">
                    <p className="truncate font-medium" title={item.description}>{item.description}</p>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600">{item.procurement_type_display || item.procurement_type || '-'}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[160px]">
                    {item.commodity_name ? (
                      <>
                        <p className="truncate" title={item.commodity_name}>{item.commodity_name}</p>
                        {item.commodity_category && <p className="text-xs text-gray-400 truncate">{item.commodity_category}</p>}
                      </>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[140px]">
                    <p className="truncate" title={item.funding_source_name || ''}>{item.funding_source_name || '-'}</p>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {item.is_citizen_reserved !== undefined ? (
                      item.is_citizen_reserved
                        ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full"><CheckCircleIcon className="w-3 h-3" />Yes</span>
                        : <span className="text-xs text-gray-400">No</span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[140px]">
                    <span className="truncate block" title={METHOD_LABELS[item.recommended_method || ''] || item.recommended_method || ''}>
                      {METHOD_LABELS[item.recommended_method || ''] || item.recommended_method?.replace(/_/g, ' ') || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">{item.planned_issue_date ? formatDate(item.planned_issue_date) : '-'}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">{item.planned_award_date ? formatDate(item.planned_award_date) : '-'}</td>
                  <td className="px-3 py-2.5 text-sm text-right font-medium whitespace-nowrap">{Number(item.estimated_value).toLocaleString()}</td>
                </tr>
              ))}
              {(!app.line_items || app.line_items.length === 0) && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Trail */}
      {app.approval_trail && app.approval_trail.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Approval Trail</h2>
          <div className="space-y-3">
            {app.approval_trail.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-zammsa-green flex-shrink-0" />
                  {i < app.approval_trail!.length - 1 && <div className="w-0.5 h-full min-h-[24px] bg-green-200 mt-1" />}
                </div>
                <div className="pb-3">
                  <span className="font-medium capitalize text-gray-900">{entry.action.replace(/_/g, ' ')}</span>
                  <span className="text-gray-500"> by {entry.user_name} ({entry.role.replace(/_/g, ' ')})</span>
                  <p className="text-xs text-gray-400">{formatDateTime(entry.timestamp)}</p>
                  {entry.details?.reason && <p className="text-xs text-gray-500 mt-0.5">Reason: {entry.details.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Actions</h2>
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <button onClick={() => doAction('submit')} disabled={actionLoading === 'submit'} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {actionLoading === 'submit' ? 'Submitting...' : 'Submit for Dept Head Review'}
            </button>
          )}
          {canApprove && (
            <button onClick={() => status === 'zpc_review' ? doAction('approve', { zpc_minutes: '', zpc_resolution_number: '' }) : doAction('approve')}
              disabled={actionLoading === 'approve'} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
              {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
            </button>
          )}
          {canRejectReturn && (
            <>
              <button onClick={() => setShowReturnModal(true)} className="px-4 py-2 border border-yellow-400 text-yellow-700 rounded-lg text-sm hover:bg-yellow-50">
                Return for Revision
              </button>
              <button onClick={() => setShowRejectModal(true)} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">
                Reject
              </button>
            </>
          )}
          {canCompliance && (
            <button onClick={() => setShowComplianceModal(true)} className="px-4 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm hover:bg-blue-50">
              Compliance Check
            </button>
          )}
          {canConsolidate && (
            <button onClick={() => setShowConsolidateModal(true)} className="px-4 py-2 border border-purple-300 text-purple-600 rounded-lg text-sm hover:bg-purple-50">
              Consolidate
            </button>
          )}
          {canGenerateGPN && (
            <button onClick={() => doAction('generate-gpn')} disabled={actionLoading === 'generate-gpn'} className="px-4 py-2 border border-teal-300 text-teal-600 rounded-lg text-sm hover:bg-teal-50">
              {actionLoading === 'generate-gpn' ? 'Generating...' : 'Generate GPN'}
            </button>
          )}
          {canPublish && (
            <button onClick={() => setShowPublishModal(true)} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark">
              Publish APP & GPN
            </button>
          )}
          {isAlreadyPublished && (
            <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm inline-flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4" />
              Already Published
            </span>
          )}
          {canSubmitToZPPA && (
            <button onClick={() => setShowZPPAModal(true)} className="px-4 py-2 border border-indigo-300 text-indigo-600 rounded-lg text-sm hover:bg-indigo-50">
              Submit to ZPPA
            </button>
          )}
        </div>
      </div>

      {/* Modals - unchanged */}
      {showReturnModal || showRejectModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium">{showReturnModal ? 'Return for Revision' : 'Reject APP'}</h3>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Enter reason..." className="w-full mt-3 border border-gray-300 rounded-md p-2 text-sm" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowReturnModal(false); setShowRejectModal(false); setReason(''); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => doAction(showReturnModal ? 'return' : 'reject', { reason })}
                disabled={!reason || actionLoading !== ''} className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${showReturnModal ? 'bg-yellow-600' : 'bg-red-600'}`}>
                {actionLoading ? 'Processing...' : showReturnModal ? 'Return' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showComplianceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium">Compliance Check</h3>
            <div className="mt-3 space-y-3">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Compliance notes..." className="w-full border border-gray-300 rounded-md p-2 text-sm" />
              <div className="flex gap-2">
                <button onClick={() => doAction('compliance', { compliance_status: 'compliant', notes: reason })} disabled={actionLoading !== ''} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">
                  Mark Compliant
                </button>
                <button onClick={() => doAction('compliance', { compliance_status: 'non_compliant', notes: reason })} disabled={actionLoading !== '' || !reason} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                  Mark Non-Compliant
                </button>
                <button onClick={() => setShowComplianceModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConsolidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium">Consolidate APP</h3>
            <p className="text-sm text-gray-500 mt-1">Move all line items into another APP</p>
            <input value={consolidateTarget} onChange={(e) => setConsolidateTarget(e.target.value)} placeholder="Target APP ID (UUID)" className="w-full mt-3 border border-gray-300 rounded-md px-3 py-2 text-sm" />
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Consolidation notes (optional)" className="w-full mt-2 border border-gray-300 rounded-md p-2 text-sm" />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowConsolidateModal(false); setConsolidateTarget(''); setReason(''); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => doAction('consolidate', { consolidate_into: consolidateTarget, notes: reason })} disabled={!consolidateTarget || actionLoading !== ''} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50">
                {actionLoading ? 'Consolidating...' : 'Consolidate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full m-4">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">General Procurement Notice</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {gpnPreviewData?.department || app?.department_name} — FY {gpnPreviewData?.fiscalYear || app?.fiscal_year_code}
                </p>
              </div>
              <button onClick={() => { setShowPublishModal(false); setPublishSuccess(false); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Success Banner */}
            {publishSuccess && (
              <div className="bg-green-50 border-b border-green-200 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                  <div>
                    <p className="font-medium text-green-800">APP & GPN Published Successfully</p>
                    <p className="text-sm text-green-700">The procurement notice is now live on all selected channels</p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* GPN Content Section */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">GPN Content</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Auto-populated — Review and confirm</span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Contact Info */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">GPN Reference</p>
                      <p className="text-sm font-medium text-gray-900">{gpnContent.gpn_reference || gpnPreviewData?.reference || 'Auto-generated'}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Issuing Authority</p>
                      <p className="text-sm text-gray-900">{gpnContent.issuing_authority}</p>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Contact Information</p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-500">Contact Name</label>
                          <input
                            value={gpnContent.contact_name || ''}
                            onChange={(e) => handleGPNInputChange('contact_name', e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Email</label>
                          <input
                            value={gpnContent.contact_email || ''}
                            onChange={(e) => handleGPNInputChange('contact_email', e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Phone</label>
                          <input
                            value={gpnContent.contact_phone || ''}
                            onChange={(e) => handleGPNInputChange('contact_phone', e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Address</label>
                          <input
                            value={gpnContent.contact_address || ''}
                            onChange={(e) => handleGPNInputChange('contact_address', e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Planned Procurements Table */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Planned Procurements</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Value (K)</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Method</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(gpnPreviewData?.lineItems || app?.line_items || []).slice(0, 5).map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-sm text-gray-900 truncate max-w-[120px]">{item.description}</td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">
                                {Number(item.estimated_value).toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-sm text-center">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                  {METHOD_LABELS_SHORT[item.recommended_method || ''] || '-'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">Total</td>
                            <td className="px-3 py-2 text-sm text-right font-bold text-gray-900">
                              {Number(gpnPreviewData?.totalValue || app?.total_estimated_value || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {(gpnPreviewData?.lineItems || app?.line_items || []).length > 5 && (
                      <p className="text-xs text-gray-500 mt-2">Showing 5 of {(gpnPreviewData?.lineItems || app?.line_items || []).length} items</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Publication Channels */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <GlobeIcon className="w-5 h-5 text-gray-400" />
                  Publication Channels
                </h3>
                <div className="space-y-3">
                  {PUBLICATION_TARGETS.map((channel) => {
                    const ChannelIcon = channel.icon;
                    const isChecked = selectedTargets.includes(channel.key);
                    return (
                      <div key={channel.key} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-teal-300 transition-colors">
                        <div className="flex-shrink-0 mt-0.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePublicationTarget(channel.key)}
                            className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <ChannelIcon className="w-5 h-5 text-gray-400" />
                            <p className="font-medium text-gray-900">{channel.label}</p>
                            {isChecked && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1 ml-7">{channel.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ZPPA Submission Tracking */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ExclamationIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800">ZPPA Submission Tracking</h4>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-yellow-700">ZPC Approval Date:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {app?.approved_at ? new Date(app.approved_at).toLocaleDateString('en-ZM', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-yellow-700">ZPPA Deadline:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {app?.zppa_deadline ? new Date(app.zppa_deadline).toLocaleDateString('en-ZM', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                        </span>
                      </div>
                    </div>
                    {app?.zppa_deadline && (() => {
                      const daysRemaining = Math.ceil((new Date(app.zppa_deadline).getTime() - Date.now()) / (1000 * 3600 * 24));
                      return (
                        <p className={`text-xs mt-2 font-medium ${
                          daysRemaining <= 3 ? 'text-red-600' : daysRemaining <= 7 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {daysRemaining} days remaining for ZPPA submission
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <button 
                onClick={() => setShowPDFPreview(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-teal-300 text-teal-700 rounded-lg text-sm hover:bg-teal-50"
              >
                <DocumentTextIcon className="w-4 h-4" />
                Preview GPN PDF
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowPublishModal(false); setPublishSuccess(false); }} 
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => doAction('publish')} 
                  disabled={publishingGPN || selectedTargets.length === 0} 
                  className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {publishingGPN ? (
                    <>
                      <LoadingSpinner size="sm" className="text-white" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-4 h-4" />
                      🚀 Publish APP & GPN
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showZPPAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium">Submit to ZPPA</h3>
            <p className="text-sm text-gray-500 mt-1">Enter ZPPA submission reference</p>
            <input value={zppaRef} onChange={(e) => setZppaRef(e.target.value)} placeholder="ZPPA Reference Number" className="w-full mt-3 border border-gray-300 rounded-md px-3 py-2 text-sm" />
            {app.zppa_deadline && (
              <p className="text-xs text-gray-500 mt-2">Deadline: {formatDate(app.zppa_deadline)} ({app.zppa_days_remaining} days remaining)</p>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowZPPAModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => doAction('zppa-submit')} disabled={!zppaRef || actionLoading !== ''} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">
                {actionLoading ? 'Submitting...' : 'Submit to ZPPA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPDFPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">GPN PDF Preview</h3>
              <button onClick={() => setShowPDFPreview(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* PDF Preview Content - Simulated */}
              <div className="border border-gray-300 rounded-lg p-8 bg-white shadow-sm">
                {/* Header */}
                <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
                  <h2 className="text-2xl font-bold text-gray-900">GENERAL PROCUREMENT NOTICE</h2>
                  <p className="text-lg text-gray-700 mt-2">
                    {gpnContent.notice_heading || `GENERAL PROCUREMENT NOTICE — ZAMMSA ANNUAL PROCUREMENT PLAN ${gpnPreviewData?.fiscalYear}`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Reference: {gpnContent.gpn_reference || gpnPreviewData?.reference}</p>
                </div>

                {/* Issuing Authority */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-2">Issuing Authority</h4>
                  <p className="text-sm text-gray-700">{gpnContent.issuing_authority}</p>
                </div>

                {/* Notice Body */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-2">Notice</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{gpnContent.notice_body}</p>
                </div>

                {/* Contact Information */}
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <p><strong>Name:</strong> {gpnContent.contact_name}</p>
                    <p><strong>Email:</strong> {gpnContent.contact_email}</p>
                    <p><strong>Phone:</strong> {gpnContent.contact_phone}</p>
                    <p><strong>Address:</strong> {gpnContent.contact_address}</p>
                  </div>
                </div>

                {/* Planned Procurements Table */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Planned Procurements</h4>
                  <table className="min-w-full border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">Description</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">Type</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-medium">Estimated Value (ZMW)</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-medium">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(gpnPreviewData?.lineItems || app?.line_items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="border border-gray-300 px-3 py-2">{item.description}</td>
                          <td className="border border-gray-300 px-3 py-2 capitalize">{item.procurement_type || '-'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right font-medium">
                            {Number(item.estimated_value).toLocaleString()}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {METHOD_LABELS_SHORT[item.recommended_method || ''] || '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td className="border border-gray-300 px-3 py-2" colSpan={2}>Total</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {Number(gpnPreviewData?.totalValue || app?.total_estimated_value || 0).toLocaleString()}
                        </td>
                        <td className="border border-gray-300 px-3 py-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t border-gray-300">
                  <p>Issued by: {gpnContent.issuing_authority}</p>
                  <p>Generated on: {new Date().toLocaleString('en-ZM')}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button 
                onClick={() => setShowPDFPreview(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  // In a real implementation, this would generate and download the PDF
                  toast('PDF download would be generated here');
                }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APPDetail;

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
  PencilAltIcon,
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
  { key: 'zammsa_website', label: 'ZAMMSA Website' },
  { key: 'egp_portal', label: 'e-GP Portal (ZPPA)' },
  { key: 'govt_gazette', label: 'Government Gazette' },
];

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
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['zammsa_website']);

  const loadAPP = async () => {
    if (!id) return;
    setLoading(true);
    try { setApp(await procurementPlanningApi.detail(id)); } catch { setApp(null); }
    setLoading(false);
  };

  useEffect(() => { loadAPP(); }, [id]);

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
          res = await procurementPlanningApi.publishAPP(id!, { targets: selectedTargets, proofs: {} });
          break;
        case 'generate-gpn':
          res = await procurementPlanningApi.generateGPN(id!);
          setApp(prev => prev ? { ...prev, gpns: [res.gpn] } : null);
          break;
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
  const canGenerateGPN = ['approved', 'published'].includes(status) && (!app?.gpns || app.gpns.length === 0);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium">Publish APP & GPN</h3>
            <p className="text-sm text-gray-500 mt-1">Select publication targets</p>
            <div className="mt-3 space-y-2">
              {PUBLICATION_TARGETS.map(target => (
                <label key={target.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedTargets.includes(target.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTargets([...selectedTargets, target.key]);
                      } else {
                        setSelectedTargets(selectedTargets.filter(t => t !== target.key));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{target.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowPublishModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => doAction('publish')} disabled={actionLoading !== '' || selectedTargets.length === 0} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm disabled:opacity-50">
                {actionLoading ? 'Publishing...' : 'Publish'}
              </button>
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
    </div>
  );
};

export default APPDetail;

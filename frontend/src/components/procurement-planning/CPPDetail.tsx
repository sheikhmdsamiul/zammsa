import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { ContractProcurementPlan } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const CPP_WORKFLOW_STAGES = [
  { key: 'draft', label: 'Draft', note: 'Prepared by Procurement Officer' },
  { key: 'pending_zpc', label: 'Pending ZPC', note: 'Awaiting ZPC/Director review' },
  { key: 'approved', label: 'Approved', note: 'Procurement may commence' },
  { key: 'rejected', label: 'Rejected', note: 'Returned for revision' },
  { key: 'active', label: 'Active', note: 'Solicitation/procurement ongoing' },
  { key: 'completed', label: 'Completed', note: 'Procurement closed successfully' },
  { key: 'cancelled', label: 'Cancelled', note: 'CPP was cancelled' },
] as const;

const METHOD_LABELS: Record<string, string> = {
  open_tender: 'Open National Bidding (Open Tender)',
  international: 'International Bidding',
  limited: 'Limited Bidding',
  simplified: 'Simplified Bidding',
  direct: 'Direct Procurement',
};

const CPPDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cpp, setCpp] = useState<ContractProcurementPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await procurementPlanningApi.contractPlans.detail(id);
        setCpp(res);
      } catch {
        setCpp(null);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const loadCPP = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await procurementPlanningApi.contractPlans.detail(id);
      setCpp(res);
    } catch {
      setCpp(null);
    }
    setLoading(false);
  };

  const approveCPP = async () => {
    if (!id) return;
    setActionLoading('approve');
    try {
      const res = await procurementPlanningApi.contractPlans.approve(id);
      toast.success(res.message || 'CPP approved');
      await loadCPP();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Approval failed');
    }
    setActionLoading('');
  };

  const approveOverrideCPP = async () => {
    if (!id) return;
    setActionLoading('approveOverride');
    try {
      const res = await procurementPlanningApi.contractPlans.methodOverrideApprove(id, {
        override_reason: cpp?.override_reason || '',
        new_method: cpp?.method || '',
      });
      toast.success(res.message || 'Override approved');
      await loadCPP();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Override approval failed');
    }
    setActionLoading('');
  };

  const submitToZPC = async () => {
    if (!id) return;
    setActionLoading('submit');
    try {
      const res = await procurementPlanningApi.contractPlans.submit(id);
      toast.success(res.message || 'CPP submitted to ZPC');
      await loadCPP();
    } catch (err: any) {
      const data = err.response?.data;
      const msg = data?.details?.length ? data.details.join('; ') : (data?.error || 'Submit failed');
      toast.error(msg);
    }
    setActionLoading('');
  };

  const rejectCPP = async (returnForRevision = false) => {
    if (!id || !reason.trim()) return;
    setActionLoading('reject');
    try {
      const res = await procurementPlanningApi.contractPlans.reject(id, reason.trim(), returnForRevision);
      toast.success(res.message || 'CPP processed');
      setShowReject(false);
      setReason('');
      await loadCPP();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Rejection failed');
    }
    setActionLoading('');
  };

  if (loading) return <div className="p-12"><LoadingSpinner size="lg" /></div>;
  if (!cpp) return <div className="p-12 text-center text-gray-500">CPP not found</div>;
  const isOpenMethod = ['open_tender', 'international'].includes((cpp.method || '') as string);
  const methodLabel = cpp.method ? (METHOD_LABELS[cpp.method] || cpp.method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : '-';
  const recommendedLabel = cpp.recommended_method ? (METHOD_LABELS[cpp.recommended_method] || cpp.recommended_method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : '-';
  const createdAt = cpp.created_at ? new Date(cpp.created_at).toLocaleString() : '-';
  const approvedAt = cpp.approved_at ? new Date(cpp.approved_at).toLocaleString() : '-';
  const currentStatus = cpp.status || 'draft';
  const currentStageIndex = CPP_WORKFLOW_STAGES.findIndex(s => s.key === currentStatus);
  const currentStage = CPP_WORKFLOW_STAGES.find(s => s.key === currentStatus);
  const canZPCAction = currentStatus === 'pending_zpc' && ['zpc_member', 'director_procurement', 'system_admin'].includes(user?.role || '');
  const canSubmitToZPC = currentStatus === 'draft'
    && ['procurement_officer', 'system_admin'].includes(user?.role || '');
  const canApproveOverride = currentStatus === 'draft' && cpp.method_override
    && ['director_procurement', 'system_admin'].includes(user?.role || '');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">CPP Detail</h1>
            <StatusBadge status={cpp.status || 'draft'} />
          </div>
          <p className="text-sm text-gray-500">{cpp.cpp_number || cpp.cpp_id}</p>
        </div>
        <button onClick={() => navigate('/procurement-planning/cpp')} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to List</button>
      </div>

      {cpp.status === 'approved' && isOpenMethod && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="font-semibold text-green-900">Approved — Procurement May Commence</p>
          <p className="text-sm text-green-800 mt-1">Open method selected. No ZPC justification required.</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Approval Workflow Status</h2>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-gray-500">Current Stage:</span>
          <StatusBadge status={currentStatus} />
          <span className="text-gray-700">{currentStage?.note || 'Workflow status recorded'}</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {CPP_WORKFLOW_STAGES.map((stage, idx) => {
            const done = currentStageIndex >= idx && currentStageIndex !== -1;
            const active = stage.key === currentStatus;
            return (
              <React.Fragment key={stage.key}>
                {idx > 0 && <div className={`w-6 h-0.5 flex-shrink-0 ${done ? 'bg-zammsa-green' : 'bg-gray-300'}`} />}
                <div className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                  active ? 'bg-zammsa-green text-white' : done ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                }`}>
                  {stage.label}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {canSubmitToZPC && (
          <div className="mt-4">
            <button
              onClick={submitToZPC}
              disabled={actionLoading !== ''}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {actionLoading === 'submit' ? 'Submitting...' : 'Submit CPP'}
            </button>
            {isOpenMethod && (
              <span className="ml-2 text-xs text-green-700">Open method — will auto-approve on submit</span>
            )}
          </div>
        )}
        {canApproveOverride && (
          <div className="mt-4">
            <button
              onClick={approveOverrideCPP}
              disabled={actionLoading !== ''}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {actionLoading === 'approveOverride' ? 'Approving...' : 'Approve Method Override (R-09)'}
            </button>
          </div>
        )}
        {!canSubmitToZPC && currentStatus === 'draft' && !canApproveOverride && !cpp.method_override && ['procurement_officer', 'system_admin'].includes(user?.role || '') && isOpenMethod && (
          <p className="mt-4 text-sm text-green-700">
            Selected method is Open Tender. Submit to auto-approve.
          </p>
        )}
        {canZPCAction && (
          <div className="mt-4 flex items-center gap-2">
            <button onClick={approveCPP} disabled={actionLoading !== ''} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm disabled:opacity-50">
              {actionLoading === 'approve' ? 'Approving...' : 'Approve CPP'}
            </button>
            <button onClick={() => setShowReject(true)} disabled={actionLoading !== ''} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm disabled:opacity-50">
              Reject / Return
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Requisition</p>
          <p className="text-sm font-medium">{cpp.requisition_number || cpp.requisition}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Department</p>
          <p className="text-sm font-medium">{cpp.requisition_department || '-'}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Estimated Value</p>
          <p className="text-sm font-medium">ZMW {Number(cpp.estimated_value || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Overall Risk</p>
          <p className="text-sm font-medium">{(cpp.overall_risk_level || '-').toString().toUpperCase()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">ZPC Justification</p>
          <p className="text-sm font-medium">{isOpenMethod ? 'Not Required' : (cpp.zpc_approval_required ? 'Required' : 'Not Required')}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Baseline Schedule</p>
          <p className="text-sm font-medium">{cpp.is_baseline_locked ? 'Locked' : 'Not Locked'}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Created At</p>
          <p className="text-sm font-medium">{createdAt}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Approved At</p>
          <p className="text-sm font-medium">{approvedAt}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Method Decision</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500 block">System Recommendation</span>{recommendedLabel}</div>
          <div><span className="text-gray-500 block">Selected Method</span>{methodLabel}</div>
          <div><span className="text-gray-500 block">Method Override</span>{cpp.method_override ? 'Yes' : 'No'}</div>
          <div><span className="text-gray-500 block">Override Reason</span>{cpp.override_reason || '-'}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Milestones</h2>
        {(cpp.milestones || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Milestone</th>
                  <th className="py-2 pr-3">Planned Date</th>
                  <th className="py-2 pr-3">Actual Date</th>
                  <th className="py-2">Variance</th>
                </tr>
              </thead>
              <tbody>
                {(cpp.milestones || []).map((m) => (
                  <tr key={m.milestone_id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">{m.sequence_number}</td>
                    <td className="py-2 pr-3">{m.milestone_name}</td>
                    <td className="py-2 pr-3">{m.planned_date}</td>
                    <td className="py-2 pr-3">{m.actual_date || '-'}</td>
                    <td className="py-2">{m.variance_days ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-400">No milestones</p>}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Risks</h2>
        {(cpp.risks || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Risk</th>
                  <th className="py-2 pr-3">Likelihood</th>
                  <th className="py-2 pr-3">Impact</th>
                  <th className="py-2">Mitigation</th>
                </tr>
              </thead>
              <tbody>
                {(cpp.risks || []).map((r) => (
                  <tr key={r.risk_id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 capitalize">{r.risk_category}</td>
                    <td className="py-2 pr-3">{r.risk_description}</td>
                    <td className="py-2 pr-3 capitalize">{r.likelihood}</td>
                    <td className="py-2 pr-3 capitalize">{r.impact}</td>
                    <td className="py-2">{r.mitigation_strategy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-400">No risks</p>}
      </div>

      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium">Return / Reject CPP</h3>
            <p className="text-sm text-gray-500 mt-1">Provide reason for this decision.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-4 text-sm h-28"
              placeholder="Reason..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowReject(false); setReason(''); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => rejectCPP(false)}
                disabled={!reason.trim() || actionLoading !== ''}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {actionLoading === 'reject' ? 'Submitting...' : 'Final Reject'}
              </button>
              <button
                onClick={() => rejectCPP(true)}
                disabled={!reason.trim() || actionLoading !== ''}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {actionLoading === 'reject' ? 'Submitting...' : 'Return for Revision'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              <strong>Return for Revision:</strong> R-03 revises and resubmits.<br />
              <strong>Final Reject:</strong> Permanently reject this plan.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CPPDetail;

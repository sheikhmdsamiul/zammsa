import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requisitionsApi } from '../../api/requisitions';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const WORKFLOW_STEPS = [
  { label: 'Draft / Submitted', statuses: ['draft', 'submitted'] },
  { label: 'Dept Head Approval', statuses: ['submitted', 'pending_finance', 'pending_dg', 'pending_zpc', 'approved'] },
  { label: 'Finance Validation', statuses: ['pending_finance', 'pending_dg', 'pending_zpc', 'approved'] },
  { label: 'Director General', statuses: ['pending_dg', 'pending_zpc', 'approved'] },
  { label: 'ZPC (> K250,000)', statuses: ['pending_zpc', 'approved'] },
  { label: 'Approved for Procurement', statuses: ['approved'] },
];

const RequisitionDetail: React.FC = () => {
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
    onSuccess: (res) => { invalidate(); toast.success(res.message || 'Requisition submitted'); if (res.budget_validated) toast.success('Budget validated & encumbered'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Submit failed'),
  });

  const budgetValidateMutation = useMutation({
    mutationFn: () => requisitionsApi.budgetValidate(id!),
    onSuccess: (res) => { invalidate(); toast.success(res.message || 'Budget validated'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Budget validation failed'),
  });

  const approveMutation = useMutation({
    mutationFn: () => requisitionsApi.approve(id!, { comment, decision: 'approved' }),
    onSuccess: (res) => { invalidate(); setComment(''); toast.success(res.message || 'Approved'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Approve failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => requisitionsApi.reject(id!, { reason: comment || 'No reason provided' }),
    onSuccess: (res) => { invalidate(); setComment(''); toast.success(res.message || 'Rejected'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Reject failed'),
  });

  const returnMutation = useMutation({
    mutationFn: () => requisitionsApi.returnForRevision(id!, comment || 'Returned for revision'),
    onSuccess: (res) => { invalidate(); setComment(''); toast.success(res.message || 'Returned'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Return failed'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!req) return <p className="text-center text-gray-500 py-12">Requisition not found</p>;

  const role = user?.role || '';
  const status = req.status || '';
  const estimatedValue = Number(req.estimated_value || req.estimated_total || 0);

  const canSubmit = status === 'draft' && role === 'user_dept_staff';
  const canApproveDeptHead = status === 'submitted' && role === 'department_head';
  const canApproveFinance = status === 'pending_finance' && role === 'finance_officer';
  const canApproveDG = status === 'pending_dg' && role === 'director_general';
  const canApproveZPC = status === 'pending_zpc' && role === 'zpc_member' && estimatedValue > 250000;
  const canRejectReturn = (status === 'submitted' && role === 'department_head') ||
    (status === 'pending_finance' && role === 'finance_officer') ||
    (status === 'pending_dg' && role === 'director_general') ||
    (status === 'pending_zpc' && role === 'zpc_member');
  const canBudgetValidate = ['draft', 'submitted', 'pending_finance'].includes(status) && role === 'finance_officer';

  const showActions = canSubmit || canApproveDeptHead || canApproveFinance || canApproveDG || canApproveZPC || canRejectReturn || canBudgetValidate;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{req.title || req.req_number}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {req.req_number} &middot; Created {new Date(req.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {canSubmit && <button onClick={() => submitMutation.mutate()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Submit</button>}
          {(status === 'draft') && <Link to={`/requisitions/${id}/edit`} className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Edit</Link>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Department</dt><dd className="font-medium text-gray-900">{req.department_name || req.department}</dd></div>
              <div><dt className="text-gray-500">Priority</dt><dd className="font-medium">{req.priority || 'N/A'}</dd></div>
              <div><dt className="text-gray-500">Estimated Value</dt><dd className="font-medium">ZMW {estimatedValue.toLocaleString()}</dd></div>
              <div><dt className="text-gray-500">Date Required</dt><dd className="font-medium">{(() => { const d = req.date_required || req.required_date; return d ? new Date(d).toLocaleDateString() : '-'; })()}</dd></div>
              <div><dt className="text-gray-500">Created By</dt><dd className="font-medium">{req.requester_name || req.created_by}</dd></div>
              <div><dt className="text-gray-500">Budget Validated</dt><dd className="font-medium">{req.budget_validated ? <span className="text-green-600">Yes</span> : <span className="text-yellow-600">No</span>}</dd></div>
              {req.encumbrance_ref && <div><dt className="text-gray-500">Encumbrance Ref</dt><dd className="font-medium text-xs">{req.encumbrance_ref}</dd></div>}
            </dl>
            {req.description && <p className="mt-4 text-sm text-gray-700">{req.description}</p>}
          </div>

          {req.specifications && req.specifications.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Specifications</h2>
              {req.specifications.map((spec: any, i: number) => (
                <div key={spec.id || i} className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase font-medium">{spec.specification_type}</p>
                  <pre className="text-sm mt-1 whitespace-pre-wrap">{typeof spec.content === 'string' ? spec.content : JSON.stringify(spec.content, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Items ({req.items?.length || 0})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Code</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Unit</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Unit Cost</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {req.items?.map((item: any) => (
                    <tr key={item.id || item.item_id}>
                      <td className="px-3 py-2">{item.item_code}</td>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{item.unit || item.uom_name}</td>
                      <td className="px-3 py-2 text-right">ZMW {Number(item.estimated_unit_cost || item.unit_price_estimate).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-medium">ZMW {Number(item.total_estimate || (item.quantity * (item.estimated_unit_cost || item.unit_price_estimate))).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {req.approvals && req.approvals.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Approval History</h2>
              <div className="space-y-3">
                {req.approvals.map((a: any) => (
                  <div key={a.approval_id || a.id} className="flex items-start gap-3 text-sm">
                    <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${a.decision === 'approved' ? 'bg-green-500' : a.decision === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div>
                      <p className="font-medium">{a.approver_name || a.approver} &middot; <span className="text-gray-500 capitalize">{a.approval_level.replace(/_/g, ' ')}</span></p>
                      <p className="text-xs text-gray-400">{a.decision} {a.approved_at ? new Date(a.approved_at).toLocaleString() : ''}</p>
                      {a.comments && <p className="text-xs text-gray-500 mt-0.5">{a.comments}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow</h2>
            <div className="space-y-3 text-sm">
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${step.statuses.includes(status) ? 'bg-green-500' : status === 'rejected' ? 'bg-red-500' : 'bg-gray-300'}`} />
                  <span className={step.statuses.includes(status) ? 'text-gray-900 font-medium' : 'text-gray-400'}>{step.label}</span>
                </div>
              ))}
            </div>
            {status === 'rejected' && <p className="mt-3 text-xs text-red-600">This requisition has been rejected.</p>}
          </div>

          {showActions && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add comment..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
                {canSubmit && <button onClick={() => submitMutation.mutate()} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Submit Requisition</button>}
                {canBudgetValidate && <button onClick={() => budgetValidateMutation.mutate()} className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">Validate Budget & Encumber</button>}
                {(canApproveDeptHead || canApproveFinance || canApproveDG || canApproveZPC) && (
                  <button onClick={() => approveMutation.mutate()} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                    {canApproveDG && estimatedValue > 250000 ? 'Approve & Forward to ZPC' : 'Approve'}
                  </button>
                )}
                {canRejectReturn && (
                  <>
                    <button onClick={() => rejectMutation.mutate()} className="w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Reject</button>
                    <button onClick={() => returnMutation.mutate()} className="w-full px-4 py-2 border border-yellow-400 text-yellow-700 rounded-lg text-sm hover:bg-yellow-50">Return for Revision</button>
                  </>
                )}
              </div>
            </div>
          )}

          {req.notes && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
              <p className="text-sm text-gray-700">{req.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequisitionDetail;

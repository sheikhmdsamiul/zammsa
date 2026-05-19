import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { ContractProcurementPlan } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const CPPList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState<ContractProcurementPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const methodLabel = (method?: string) => {
    const map: Record<string, string> = {
      open_tender: 'Open National Bidding',
      international: 'International Bidding',
      limited: 'Limited Bidding',
      simplified: 'Simplified Bidding',
      direct: 'Direct Procurement',
    };
    if (!method) return '-';
    return map[method] || method.replace(/_/g, ' ');
  };

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await procurementPlanningApi.contractPlans.list({ page_size: 50 });
      setPlans(res.results);
    } catch { setPlans([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this CPP?')) return;
    try {
      await procurementPlanningApi.contractPlans.delete(id);
      loadPlans();
    } catch {}
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await procurementPlanningApi.contractPlans.approve(id);
      toast.success(res.message || 'CPP approved');
      loadPlans();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Approval failed');
    }
    setActionLoading('');
  };

  const handleSubmitToZPC = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await procurementPlanningApi.contractPlans.submit(id);
      toast.success(res.message || 'CPP submitted to ZPC');
      loadPlans();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submit failed');
    }
    setActionLoading('');
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Reason for rejection/return?');
    if (!reason || !reason.trim()) return;
    setActionLoading(id);
    try {
      const res = await procurementPlanningApi.contractPlans.reject(id, reason.trim());
      toast.success(res.message || 'CPP rejected');
      loadPlans();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Rejection failed');
    }
    setActionLoading('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contract Procurement Plans</h1>
          <p className="text-sm text-gray-500">Manage CPPs with milestones and risk assessments</p>
        </div>
        {user?.role && ['procurement_officer', 'system_admin'].includes(user.role) && (
          <button onClick={() => navigate('/procurement-planning/cpp/create')} className="px-4 py-2 bg-zammsa-green text-white rounded-lg hover:bg-zammsa-green-dark text-sm font-medium">
            + New CPP
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? <div className="p-8"><LoadingSpinner /></div> : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPP ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requisition</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strategy</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Milestones</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {plans.map((cpp) => (
                <tr key={cpp.cpp_id} onClick={() => navigate(`/procurement-planning/cpp/${cpp.cpp_id}`)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{cpp.cpp_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{cpp.requisition_number || cpp.requisition}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{methodLabel(cpp.method || cpp.procurement_strategy)}</td>
                  <td className="px-4 py-3"><StatusBadge status={cpp.status || 'draft'} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{cpp.milestones?.length || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{new Date(cpp.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {user?.role === 'procurement_officer' && (
                        <>
                          <button onClick={() => navigate(`/procurement-planning/cpp/${cpp.cpp_id}/edit`)} className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                          {cpp.status === 'draft' && ['limited', 'simplified', 'direct'].includes((cpp.method || '') as string) && (
                            <button
                              onClick={() => handleSubmitToZPC(cpp.cpp_id)}
                              disabled={actionLoading === cpp.cpp_id}
                              className="text-amber-600 hover:text-amber-800 text-sm disabled:opacity-50"
                            >
                              Submit to ZPC
                            </button>
                          )}
                          <button onClick={() => handleDelete(cpp.cpp_id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                        </>
                      )}
                      {user?.role === 'zpc_member' && cpp.status === 'pending_zpc' && (
                        <>
                          <button
                            onClick={() => handleApprove(cpp.cpp_id)}
                            disabled={actionLoading === cpp.cpp_id}
                            className="text-green-600 hover:text-green-800 text-sm disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(cpp.cpp_id)}
                            disabled={actionLoading === cpp.cpp_id}
                            className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No contract procurement plans found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CPPList;

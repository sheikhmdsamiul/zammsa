import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { AnnualProcurementPlan } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';

const APPList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState<AnnualProcurementPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [fiscalYearFilter, setFiscalYearFilter] = useState('');
  const [stats, setStats] = useState<any>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: pageSize };
      if (statusFilter) params.status = statusFilter;
      if (fiscalYearFilter) params.fiscal_year = fiscalYearFilter;
      const res = await procurementPlanningApi.list(params);
      setPlans(res.results);
      setTotalPages(res.total_pages);
      setTotalItems(res.count);
      setPage(res.page);
    } catch { setPlans([]); }
    setLoading(false);
  }, [page, pageSize, statusFilter, fiscalYearFilter]);

  const loadStats = async () => {
    try { setStats(await procurementPlanningApi.dashboard()); } catch {}
  };

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { loadStats(); }, []);

  const statuses = ['draft', 'dept_head_review', 'procurement_review', 'director_review', 'zpc_review', 'approved', 'published', 'rejected'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Annual Procurement Plans</h1>
          <p className="text-sm text-gray-500">Manage APP submissions through the approval workflow</p>
        </div>
        {user?.role && ['user_dept_staff', 'procurement_officer', 'system_admin'].includes(user.role) && (
          <button onClick={() => navigate('/procurement-planning/create')} className="px-4 py-2 bg-zammsa-green text-white rounded-lg hover:bg-zammsa-green-dark text-sm font-medium">
            + New APP
          </button>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
              className={`p-3 rounded-lg border text-center transition-colors ${s === statusFilter ? 'border-zammsa-green bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <p className="text-lg font-bold">{stats[s] || 0}</p>
              <p className="text-xs text-gray-500">{s.replace(/_/g, ' ')}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <select value={fiscalYearFilter} onChange={(e) => { setFiscalYearFilter(e.target.value); setPage(1); }} className="border border-gray-300 rounded-md text-sm px-3 py-1.5">
          <option value="">All Fiscal Years</option>
          {['2024', '2025', '2026', '2027'].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {statusFilter && (
          <button onClick={() => setStatusFilter('')} className="text-sm text-gray-500 hover:text-gray-700 underline">Clear filter</button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? <div className="p-8"><LoadingSpinner /></div> : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fiscal Year</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ZPPA</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consolidated</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {plans.map((app) => (
                <tr key={app.app_id} onClick={() => navigate(`/procurement-planning/${app.app_id}`)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{app.department_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{app.fiscal_year_code}</td>
                  <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                  <td className="px-4 py-3 text-sm text-right font-medium">ZMW {Number(app.total_estimated_value).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3">
                    {app.zppa_submitted ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Submitted</span>
                    ) : app.zppa_status === 'overdue' ? (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Overdue</span>
                    ) : app.zppa_status === 'approaching' ? (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{app.zppa_days_remaining}d left</span>
                    ) : app.zppa_status === 'on_track' ? (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{app.zppa_days_remaining}d</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{app.is_consolidated ? <StatusBadge status="consolidated" /> : <span className="text-xs text-gray-400">No</span>}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{new Date(app.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {plans.length === 0 && !loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No procurement plans found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}
    </div>
  );
};

export default APPList;

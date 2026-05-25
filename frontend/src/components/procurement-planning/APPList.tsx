import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { AnnualProcurementPlan } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Pagination } from '../common/Pagination';
import { DataTable } from '../common/DataTable';
import { PageHeader } from '../common/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { PlusIcon, FilterIcon, CalendarIcon } from '@heroicons/react/outline';

export default function APPList() {
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
    } catch (err) { console.error('Failed to load APPs:', err); toast.error('Failed to load annual procurement plans'); setPlans([]); }
    setLoading(false);
  }, [page, pageSize, statusFilter, fiscalYearFilter]);

  const loadStats = async () => {
    try { setStats(await procurementPlanningApi.dashboard()); } catch (err) { console.error('Failed to load APP stats:', err); }
  };

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { loadStats(); }, []);

  const columns = [
    { 
      key: 'department_name', 
      label: 'Department',
      render: (v: string, row: any) => (
        <div className="flex flex-col">
           <span className="font-bold text-gray-900">{v}</span>
           <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">ID: {row.app_id.slice(0, 8)}</span>
        </div>
      )
    },
    { key: 'fiscal_year_code', label: 'Fiscal Year' },
    { 
      key: 'status', 
      label: 'Status', 
      render: (val: string) => <StatusBadge status={val} /> 
    },
    { 
      key: 'total_estimated_value', 
      label: 'Total Value', 
      render: (val: any) => <span className="font-black text-gray-900">ZMW {Number(val).toLocaleString()}</span>
    },
    { 
      key: 'submitted_at', 
      label: 'Submitted', 
      render: (val: string) => val ? new Date(val).toLocaleDateString('en-GB') : <span className="text-gray-300 italic">Not yet</span>
    },
    {
      key: 'zppa_status',
      label: 'ZPPA Registry',
      render: (_: any, row: any) => {
        if (row.zppa_submitted) return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-600">Published</span>;
        if (row.zppa_status === 'overdue') return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-600">Overdue</span>;
        if (row.zppa_status === 'approaching') return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-600">{row.zppa_days_remaining}d left</span>;
        return <span className="text-gray-300">-</span>;
      }
    },
    { 
      key: 'created_at', 
      label: 'Date Created', 
      render: (val: string) => <span className="text-gray-400">{new Date(val).toLocaleDateString('en-GB')}</span>
    },
  ];

  const statuses = ['draft', 'dept_head_review', 'procurement_review', 'director_review', 'zpc_review', 'approved', 'published', 'rejected'];

  return (
    <div className="pb-12">
      <PageHeader 
        title="Procurement Plans"
        description="Manage Annual Procurement Plans (APP) and track approval workflows."
        actions={
          user?.role && ['user_dept_staff', 'procurement_officer', 'system_admin'].includes(user.role) ? (
            <button 
              onClick={() => navigate('/procurement-planning/create')} 
              className="flex items-center gap-2 px-4 py-2 bg-zammsa-green text-white rounded-xl shadow-lg shadow-zammsa-green/20 text-xs font-bold uppercase tracking-widest hover:bg-zammsa-green-dark transition-all"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Create Plan</span>
            </button>
          ) : undefined
        }
      />

      {stats && (
        <div className="flex flex-wrap gap-3 mb-8">
          {statuses.map((s) => (
            <button 
              key={s} 
              onClick={() => { setStatusFilter(s === statusFilter ? '' : s); setPage(1); }}
              className={`px-4 py-3 rounded-2xl border transition-all ${
                s === statusFilter 
                  ? 'border-zammsa-green bg-zammsa-green text-white shadow-lg shadow-zammsa-green/20' 
                  : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:shadow-sm'
              }`}
            >
              <p className={`text-lg font-black leading-none mb-1 ${s === statusFilter ? 'text-white' : 'text-gray-900'}`}>{stats[s] || 0}</p>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${s === statusFilter ? 'text-white/70' : 'text-gray-400'}`}>{s.replace(/_/g, ' ')}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
           <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
           <select 
             value={fiscalYearFilter} 
             onChange={(e) => { setFiscalYearFilter(e.target.value); setPage(1); }} 
             className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-bold text-gray-600 focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all appearance-none"
           >
             <option value="">All Fiscal Years</option>
             {['2024', '2025', '2026', '2027'].map((y) => <option key={y} value={y}>{y}</option>)}
           </select>
        </div>
        
        {statusFilter && (
          <button 
            onClick={() => setStatusFilter('')} 
            className="flex items-center gap-2 px-4 py-2 text-xs font-black text-rose-600 uppercase tracking-widest hover:bg-rose-50 rounded-xl transition-colors"
          >
            <FilterIcon className="w-4 h-4" />
            Clear Filter
          </button>
        )}
      </div>

      <DataTable 
        columns={columns}
        data={plans}
        loading={loading}
        onRowClick={(row) => navigate(`/procurement-planning/${row.app_id}`)}
      />

      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination 
            currentPage={page} 
            totalPages={totalPages} 
            pageSize={pageSize} 
            totalItems={totalItems} 
            onPageChange={setPage} 
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} 
          />
        </div>
      )}
    </div>
  );
}
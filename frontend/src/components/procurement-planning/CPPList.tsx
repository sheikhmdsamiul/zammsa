import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { ContractProcurementPlan } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { DataTable } from '../common/DataTable';
import { PageHeader } from '../common/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { 
  PlusIcon, PencilAltIcon, TrashIcon, CheckIcon, 
  XIcon, LightningBoltIcon, ClipboardCheckIcon
} from '@heroicons/react/outline';

export default function CPPList() {
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
    } catch (err) { console.error('Failed to load CPPs:', err); toast.error('Failed to load contract procurement plans'); setPlans([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this CPP?')) return;
    try {
      await procurementPlanningApi.contractPlans.delete(id);
      toast.success('CPP deleted');
      loadPlans();
    } catch { toast.error('Failed to delete'); }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await procurementPlanningApi.contractPlans.approve(id);
      toast.success(res.message || 'CPP approved');
      loadPlans();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Approval failed'); }
    setActionLoading('');
  };

  const handleSubmitToZPC = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await procurementPlanningApi.contractPlans.submit(id);
      toast.success(res.message || 'CPP submitted to ZPC');
      loadPlans();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Submit failed'); }
    setActionLoading('');
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Reason for rejection/return?');
    if (!reason || !reason.trim()) return;
    setActionLoading(id);
    try {
      const res = await procurementPlanningApi.contractPlans.reject(id, reason.trim());
      toast.success(res.message || 'CPP returned');
      loadPlans();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Rejection failed'); }
    setActionLoading('');
  };

  const columns = [
    { 
      key: 'cpp_id', 
      label: 'CPP Ref', 
      render: (v: string) => <span className="font-mono text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100 uppercase">{v.slice(0, 8)}</span>
    },
    { 
      key: 'requisition_number', 
      label: 'Requisition', 
      render: (v: string, row: any) => <span className="font-bold text-gray-900">{v || row.requisition}</span>
    },
    { 
      key: 'method', 
      label: 'Procurement Strategy', 
      render: (v: string, row: any) => (
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{methodLabel(v || row.procurement_strategy)}</span>
      )
    },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'draft'} /> },
    { 
      key: 'milestones', 
      label: 'Progress', 
      render: (v: any[]) => (
        <div className="flex items-center gap-1.5">
           <div className="flex -space-x-1">
              {[...Array(3)].map((_, i) => (
                 <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (v?.length || 0) ? 'bg-zammsa-green' : 'bg-gray-200'}`} />
              ))}
           </div>
           <span className="text-[10px] font-black text-gray-400">{v?.length || 0} STEPS</span>
        </div>
      )
    },
    { 
      key: 'created_at', 
      label: 'Created', 
      render: (v: string) => <span className="text-gray-400">{new Date(v).toLocaleDateString('en-GB')}</span>
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: (_: any, row: any) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {user?.role === 'procurement_officer' && (
            <>
              <button onClick={() => navigate(`/procurement-planning/cpp/${row.cpp_id}/edit`)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><PencilAltIcon className="w-4 h-4"/></button>
              {row.status === 'draft' && ['limited', 'simplified', 'direct'].includes((row.method || '') as string) && (
                <button onClick={() => handleSubmitToZPC(row.cpp_id)} disabled={actionLoading === row.cpp_id} className="p-2 text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-30" title="Submit to ZPC"><LightningBoltIcon className="w-4 h-4"/></button>
              )}
              <button onClick={() => handleDelete(row.cpp_id)} className="p-2 text-gray-400 hover:text-rose-600 transition-colors" title="Delete"><TrashIcon className="w-4 h-4"/></button>
            </>
          )}
          {user?.role === 'zpc_member' && row.status === 'pending_zpc' && (
            <>
              <button onClick={() => handleApprove(row.cpp_id)} disabled={actionLoading === row.cpp_id} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Approve"><CheckIcon className="w-4 h-4"/></button>
              <button onClick={() => handleReject(row.cpp_id)} disabled={actionLoading === row.cpp_id} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Reject"><XIcon className="w-4 h-4"/></button>
            </>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="pb-12">
      <PageHeader 
        title="Contract Planning"
        description="Individual procurement strategies with custom milestones and risk logs."
        actions={
          user?.role && ['procurement_officer', 'system_admin'].includes(user.role) ? (
            <button 
               onClick={() => navigate('/procurement-planning/cpp/create')}
               className="flex items-center gap-2 px-4 py-2 bg-zammsa-green text-white rounded-xl shadow-lg shadow-zammsa-green/20 text-xs font-bold uppercase tracking-widest hover:bg-zammsa-green-dark transition-all"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Create Strategy</span>
            </button>
          ) : undefined
        }
      />

      <DataTable 
        columns={columns}
        data={plans}
        loading={loading}
        onRowClick={(row) => navigate(`/procurement-planning/cpp/${row.cpp_id}`)}
      />
      
      {plans.length === 0 && !loading && (
         <div className="mt-8 bg-white rounded-3xl border border-gray-100 p-12 text-center">
            <ClipboardCheckIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No strategies found</p>
         </div>
      )}
    </div>
  );
}
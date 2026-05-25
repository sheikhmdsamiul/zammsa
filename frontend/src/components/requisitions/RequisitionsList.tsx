import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requisitionsApi } from '../../api/requisitions';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ConfirmModal } from '../common/ConfirmModal';
import { PageHeader } from '../common/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { 
  PlusIcon, DownloadIcon, TrashIcon, PencilAltIcon, 
  SearchIcon, FilterIcon 
} from '@heroicons/react/outline';
import fileSaver from 'file-saver';
import toast from 'react-hot-toast';

export default function RequisitionsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('-created_at');
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['requisitions', page, pageSize, search, sortKey],
    queryFn: () => requisitionsApi.list({ page, page_size: pageSize, search, ordering: sortKey }),
  });

  React.useEffect(() => { if (isError) toast.error('Failed to load requisitions'); }, [isError]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => requisitionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      setDeleteModal(null);
      toast.success('Requisition deleted successfully');
    },
  });

  const handleExport = async () => {
    const loadingToast = toast.loading('Preparing export...');
    try {
      const blob = await requisitionsApi.export({ search, ordering: sortKey });
      fileSaver.saveAs(blob, 'ZAMMSA_Requisitions.xlsx');
      toast.success('Exported successfully', { id: loadingToast });
    } catch { 
      toast.error('Export failed', { id: loadingToast }); 
    }
  };

  const safeNumber = (value: unknown, fallback = 0): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const columns = [
    { 
      key: 'req_number', 
      label: 'Req #', 
      render: (v: string) => <span className="font-black text-gray-400 text-xs">{v || '---'}</span>
    },
    { 
      key: 'title', 
      label: 'Requisition Title', 
      sortable: true, 
      render: (v: string, row: any) => (
        <div className="flex flex-col">
           <span className="font-bold text-gray-900">{v}</span>
           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{row.department}</span>
        </div>
      )
    },
    { 
      key: 'priority', 
      label: 'Priority', 
      render: (v: string) => (
        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
          v === 'urgent' ? 'bg-rose-50 text-rose-600' : 
          v === 'high' ? 'bg-amber-50 text-amber-600' : 
          'bg-emerald-50 text-emerald-600'
        }`}>
          {v}
        </span>
      )
    },
    { 
      key: 'estimated_value', 
      label: 'Est. Value', 
      render: (v: number) => <span className="font-black text-gray-900">ZMW {safeNumber(v).toLocaleString()}</span>
    },
    { 
      key: 'status', 
      label: 'Status', 
      render: (v: string) => <StatusBadge status={v} /> 
    },
    { 
      key: 'created_at', 
      label: 'Date Created', 
      sortable: true, 
      render: (v: string) => <span className="text-gray-500">{new Date(v).toLocaleDateString('en-GB')}</span>
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: (_: any, row: any) => (
        <div className="flex items-center gap-1">
          {user?.role === 'user_dept_staff' && (
            <button 
              onClick={(e) => { e.stopPropagation(); navigate(`/requisitions/${row.id}/edit`); }} 
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
              title="Edit Requisition"
            >
               <PencilAltIcon className="w-4 h-4" />
            </button>
          )}
          {user?.role === 'user_dept_staff' && (
            <button 
              onClick={(e) => { e.stopPropagation(); setDeleteModal({ id: row.id, title: row.title }); }} 
              className="p-2 text-gray-400 hover:text-rose-600 transition-colors"
              title="Delete"
            >
               <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="pb-12">
      <PageHeader 
        title="Requisitions"
        description="Track and manage internal procurement requests and approvals."
        actions={
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-xs font-bold text-gray-500 hover:text-zammsa-green transition-all"
            >
              <DownloadIcon className="w-4 h-4" />
              <span className="hidden sm:inline uppercase tracking-widest">Export List</span>
            </button>
            {user?.role === 'user_dept_staff' && (
              <button 
                onClick={() => navigate('/requisitions/create')}
                className="flex items-center gap-2 px-4 py-2 bg-zammsa-green text-white rounded-xl shadow-lg shadow-zammsa-green/20 text-xs font-bold uppercase tracking-widest hover:bg-zammsa-green-dark transition-all"
              >
                <PlusIcon className="w-4 h-4" />
                <span>New Request</span>
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
           <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
           <input 
             type="text"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             placeholder="Search by title or req number..."
             className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-zammsa-green/5 focus:border-zammsa-green outline-none transition-all placeholder:text-gray-300"
           />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 hover:border-gray-200 transition-all">
           <FilterIcon className="w-4 h-4" />
           <span>Advanced Filters</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.results || []}
        loading={isLoading}
        sortKey={sortKey.replace('-', '')}
        sortDir={sortKey.startsWith('-') ? 'desc' : 'asc'}
        onSort={(key) => setSortKey(sortKey === key ? `-${key}` : key)}
        onRowClick={(row) => navigate(`/requisitions/${row.id}`)}
      />

      {data && (
        <div className="mt-8">
          <Pagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(safeNumber(data.count) / pageSize))}
            pageSize={pageSize}
            totalItems={safeNumber(data.count)}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </div>
      )}

      <ConfirmModal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={() => deleteModal && deleteMutation.mutate(deleteModal.id)}
        title="Delete Requisition"
        message={`Are you sure you want to delete "${deleteModal?.title}"? This action cannot be undone.`}
        confirmText="Delete Requisition"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
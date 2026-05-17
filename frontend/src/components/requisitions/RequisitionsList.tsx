import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requisitionsApi } from '../../api/requisitions';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ConfirmModal } from '../common/ConfirmModal';
import fileSaver from 'file-saver';
import toast from 'react-hot-toast';

const RequisitionsList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('-created_at');
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['requisitions', page, pageSize, search, sortKey],
    queryFn: () => requisitionsApi.list({ page, page_size: pageSize, search, ordering: sortKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => requisitionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      setDeleteModal(null);
      toast.success('Requisition deleted');
    },
  });

  const handleExport = async () => {
    try {
      const blob = await requisitionsApi.export({ search, ordering: sortKey });
      fileSaver.saveAs(blob, 'requisitions_export.xlsx');
      toast.success('Exported successfully');
    } catch { toast.error('Export failed'); }
  };

  const safeNumber = (value: unknown, fallback = 0): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const columns = [
    { key: 'title', label: 'Title', sortable: true, render: (_: any, row: any) => (
      <Link to={`/requisitions/${row.id}`} className="text-zammsa-green hover:underline font-medium">{row.title}</Link>
    )},
    { key: 'department', label: 'Department', sortable: true },
    { key: 'priority', label: 'Priority', render: (v: string) => (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${v === 'urgent' ? 'bg-red-50 text-red-600' : v === 'high' ? 'bg-orange-50 text-orange-600' : v === 'medium' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>
        {v?.charAt(0).toUpperCase() + v?.slice(1)}
      </span>
    )},
    { key: 'estimated_value', label: 'Value', render: (v: number) => safeNumber(v).toLocaleString() },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'created_at', label: 'Created', sortable: true, render: (v: string) => new Date(v).toLocaleDateString() },
    { key: 'actions', label: '', render: (_: any, row: any) => (
      <div className="flex gap-2">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/requisitions/${row.id}/edit`); }} className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
        <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ id: row.id, title: row.title }); }} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Requisitions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage procurement requisitions</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="text-sm bg-white border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50">Export</button>
          <Link to="/requisitions/create" className="bg-zammsa-green text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zammsa-green-dark transition-colors">+ New Requisition</Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search requisitions..." />
        </div>

        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable
            columns={columns}
            data={data?.results || []}
            sortKey={sortKey.replace('-', '')}
            sortDir={sortKey.startsWith('-') ? 'desc' : 'asc'}
            onSort={(key) => setSortKey(sortKey === key ? `-${key}` : key)}
            onRowClick={(row) => navigate(`/requisitions/${row.id}`)}
          />
        )}

        {data && (
          <Pagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(safeNumber(data.count) / pageSize))}
            pageSize={pageSize}
            totalItems={safeNumber(data.count)}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>

      <ConfirmModal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={() => deleteModal && deleteMutation.mutate(deleteModal.id)}
        title="Delete Requisition"
        message={`Are you sure you want to delete "${deleteModal?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
};

export default RequisitionsList;

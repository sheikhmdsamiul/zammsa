import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { solicitationsApi } from '../../api/solicitations';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import fileSaver from 'file-saver';
import toast from 'react-hot-toast';

const SolicitationsList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('-created_at');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['solicitations', page, pageSize, search, sortKey],
    queryFn: () => solicitationsApi.list({ page, page_size: pageSize, search, ordering: sortKey }),
  });

  React.useEffect(() => { if (isError) toast.error('Failed to load solicitations'); }, [isError]);

  const handleExport = async () => {
    try { const blob = await solicitationsApi.export({ search }); fileSaver.saveAs(blob, 'solicitations_export.xlsx'); toast.success('Exported'); }
    catch { toast.error('Export failed'); }
  };

  const typeColors: Record<string, string> = { rfq: 'bg-blue-50 text-blue-600', rfb: 'bg-green-50 text-green-600', rfp: 'bg-purple-50 text-purple-600', rfi: 'bg-orange-50 text-orange-600' };
  const canCreateSolicitation = user?.role !== 'procurement_manager';

  const columns = [
    { key: 'title', label: 'Title', sortable: true, render: (_: any, row: any) => (
      <Link to={`/solicitations/${row.id}`} className="text-zammsa-green hover:underline font-medium">{row.title}</Link>
    )},
    { key: 'cpp_number', label: 'CPP #', render: (v: string) => v ? <span className="text-xs font-mono font-bold text-gray-600">{v}</span> : '-' },
    { key: 'type', label: 'Type', render: (v: string) => (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${typeColors[v] || ''}`}>{v?.toUpperCase()}</span>
    )},
    { key: 'department', label: 'Department', sortable: true },
    { key: 'closing_date', label: 'Closing', sortable: true, render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'estimated_value', label: 'Value', render: (v: number) => v?.toLocaleString() },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage RFQs, RFBs, RFPs and RFIs</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="text-sm bg-white border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50">Export</button>
          {canCreateSolicitation && (
            <Link to="/solicitations/create" className="bg-zammsa-green text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zammsa-green-dark">+ New Solicitation</Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search solicitations..." />
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={data?.results || []} sortKey={sortKey.replace('-', '')}
            sortDir={sortKey.startsWith('-') ? 'desc' : 'asc'}
            onSort={(key) => setSortKey(sortKey === key ? `-${key}` : key)}
            onRowClick={(row) => navigate(`/solicitations/${row.id}`)}
          />
        )}
        {data && (
          <Pagination currentPage={page} totalPages={Math.ceil(data.count / pageSize)} pageSize={pageSize}
            totalItems={data.count} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default SolicitationsList;

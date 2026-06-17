import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { solicitationsApi } from '../../api/solicitations';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { PlusIcon, DownloadIcon, SearchIcon } from '@heroicons/react/outline';
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
    try { 
      const blob = await solicitationsApi.export({ search }); 
      fileSaver.saveAs(blob, 'ZAMMSA_Solicitations.xlsx'); 
      toast.success('Exported successfully'); 
    } catch { 
      toast.error('Export failed'); 
    }
  };

  const typeColors: Record<string, string> = { 
    rfq: 'bg-blue-50 text-blue-600', 
    rfb: 'bg-emerald-50 text-emerald-600', 
    rfp: 'bg-purple-50 text-purple-600', 
    rfi: 'bg-amber-50 text-amber-600' 
  };
  
  const canCreateSolicitation = user?.role !== 'procurement_manager';

  const columns = [
    { 
      key: 'title', 
      label: 'Title', 
      sortable: true, 
      render: (v: string) => <span className="font-semibold text-slate-900">{v}</span>
    },
    { 
      key: 'cpp_number', 
      label: 'CPP #', 
      render: (v: string) => v ? <span className="text-xs font-semibold text-slate-400">{v}</span> : '-' 
    },
    { 
      key: 'type', 
      label: 'Type', 
      render: (v: string) => (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${typeColors[v] || 'bg-slate-50 text-slate-600'}`}>
          {v?.toUpperCase()}
        </span>
      )
    },
    { key: 'department', label: 'Department', sortable: true },
    { 
      key: 'closing_date', 
      label: 'Closing', 
      sortable: true, 
      render: (v: string) => <span className="text-slate-500 text-sm">{v ? new Date(v).toLocaleDateString('en-GB') : '-'}</span>
    },
    { 
      key: 'estimated_value', 
      label: 'Value', 
      render: (v: number) => <span className="font-semibold text-slate-900">{v?.toLocaleString()}</span>
    },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
  ];

  if (isLoading) return <div className="p-12 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Solicitations"
        description="Manage RFQs, RFBs, RFPs and RFIs"
        actions={
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExport} 
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-zammsa-green hover:border-zammsa-green/30 transition-all shadow-sm"
            >
              <DownloadIcon className="w-4 h-4" />
              <span>Export</span>
            </button>
            {canCreateSolicitation && (
              <button 
                onClick={() => navigate('/solicitations/create')} 
                className="flex items-center gap-2 px-4 py-2 bg-zammsa-green text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-zammsa-green-dark transition-all"
              >
                <PlusIcon className="w-4 h-4" />
                <span>New Solicitation</span>
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
           <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <input 
             type="text"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             placeholder="Search solicitations..."
             className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green outline-none transition-all placeholder:text-slate-300"
           />
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={data?.results || []} 
        sortKey={sortKey.replace('-', '')}
        sortDir={sortKey.startsWith('-') ? 'desc' : 'asc'}
        onSort={(key) => setSortKey(sortKey === key ? `-${key}` : key)}
        onRowClick={(row) => navigate(`/solicitations/${row.id}`)}
      />

      {data && (
        <div className="mt-8">
          <Pagination 
            currentPage={page} 
            totalPages={Math.max(1, Math.ceil(data.count / pageSize))} 
            pageSize={pageSize}
            totalItems={data.count} 
            onPageChange={setPage} 
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </div>
      )}
    </div>
  );
};

export default SolicitationsList;

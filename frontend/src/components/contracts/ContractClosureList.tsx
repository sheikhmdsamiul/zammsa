import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';

const ContractClosureList: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['closures', page, pageSize, search],
    queryFn: () => contractsApi.listClosures({ page, page_size: pageSize, search }),
  });

  const columns = [
    {
      key: 'contract', label: 'Contract',
      render: (v: string) => v ? (
        <Link to={`/contracts/${v}/closure`} className="text-zammsa-green hover:underline font-medium">
          {v.substring(0, 8)}
        </Link>
      ) : '-',
    },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    {
      key: 'is_complete', label: 'Complete',
      render: (v: boolean) => v
        ? <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Yes</span>
        : <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><span className="w-2 h-2 rounded-full bg-amber-500"></span>No</span>,
    },
    {
      key: 'all_deliverables_received', label: 'Deliverables',
      render: (v: boolean) => v ? 'Yes' : 'No',
    },
    {
      key: 'final_inspection_passed', label: 'Inspection',
      render: (v: boolean) => v ? 'Yes' : 'No',
    },
    {
      key: 'all_payments_processed', label: 'Payments',
      render: (v: boolean) => v ? 'Yes' : 'No',
    },
    {
      key: 'performance_security_released', label: 'Security',
      render: (v: boolean) => v ? 'Released' : 'Held',
    },
    {
      key: 'completed_by', label: 'Completed By',
      render: (v: any) => v || '-',
    },
    { key: 'completed_at', label: 'Date', render: (v: string) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
  ];

  const pending = (data?.results || []).filter((c: any) => c.status === 'pending').length;
  const completed = (data?.results || []).filter((c: any) => c.is_complete).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contract Closure</h1>
        <p className="text-sm text-gray-500 mt-1">Track closure checklists across all contracts</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{data?.count || 0}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-amber-700">{pending}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Pending</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-emerald-700">{completed}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Completed</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search closures..." />
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={data?.results || []} />
        )}
        {data && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(data.count / pageSize)}
            pageSize={pageSize}
            totalItems={data.count}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  );
};

export default ContractClosureList;
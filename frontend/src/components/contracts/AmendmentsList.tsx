import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { DataTable } from '../common/DataTable';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';

const AmendmentsList: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['amendments', page, pageSize, search],
    queryFn: () => contractsApi.listAmendments({ page, page_size: pageSize, search }),
  });

  const columns = [
    {
      key: 'amendment_number', label: 'Amd #', sortable: true,
      render: (v: number, row: any) => (
        <Link to={`/contracts/${row.contract}`} className="text-zammsa-green hover:underline font-medium">
          Amd {v}
        </Link>
      ),
    },
    {
      key: 'contract', label: 'Contract',
      render: (v: string) => v ? v.substring(0, 8) + '...' : '-',
    },
    { key: 'description', label: 'Description', render: (v: string) => <span className="truncate max-w-xs block">{v}</span> },
    { key: 'reason', label: 'Reason', render: (v: string) => <span className="truncate max-w-xs block">{v}</span> },
    {
      key: 'value_change', label: 'Value Change',
      render: (v: string) => {
        const num = parseFloat(v || '0');
        return <span className={num >= 0 ? 'text-red-600' : 'text-emerald-600'}>{num >= 0 ? '+' : ''}{num.toLocaleString()}</span>;
      },
    },
    {
      key: 'signed_by_supplier', label: 'Supplier',
      render: (v: boolean) => v ? <span className="text-emerald-600 font-medium">Signed</span> : <span className="text-amber-600 font-medium">Pending</span>,
    },
    {
      key: 'signed_by_authority', label: 'Authority',
      render: (v: boolean) => v ? <span className="text-emerald-600 font-medium">Signed</span> : <span className="text-amber-600 font-medium">Pending</span>,
    },
    { key: 'created_at', label: 'Created', render: (v: string) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
  ];

  const pending = (data?.results || []).filter((a: any) => !(a.signed_by_supplier && a.signed_by_authority)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contract Amendments</h1>
          <p className="text-sm text-gray-500 mt-1">Review and manage amendment requests across contracts</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            Pending: {pending}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            Fully Signed: {(data?.results || []).length - pending}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search amendments..." />
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

export default AmendmentsList;
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { bidsApi } from '../../api/bids';
import { solicitationsApi } from '../../api/solicitations';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { LockOpenIcon } from '@heroicons/react/outline';

const BidOpeningList: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['solicitations-for-opening', page, pageSize, search],
    queryFn: () => solicitationsApi.list({ status: 'published', page, page_size: pageSize, search }),
  });

  const columns = [
    { key: 'sol_number', label: 'Solicitation #', render: (v: string) => <span className="font-medium">{v || '---'}</span> },
    { key: 'title', label: 'Title', render: (v: string) => <span className="text-gray-600">{v || '---'}</span> },
    { key: 'bid_deadline', label: 'Bid Deadline', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'opening_time', label: 'Opening Time', render: (v: string) => v ? new Date(v).toLocaleString() : 'At deadline' },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'published'} /> },
    { key: 'id', label: '', render: (_: any, row: any) => (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/bids/opening/${row.id}`); }}
        className="px-3 py-1.5 bg-zammsa-green text-white text-xs rounded-lg hover:bg-zammsa-green-dark flex items-center gap-1">
        <LockOpenIcon className="w-3.5 h-3.5" />
        Open Bids
      </button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bid Opening</h1>
          <p className="text-sm text-gray-500 mt-1">Select a solicitation to start the public bid opening ceremony</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search solicitations..." />
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable
            columns={columns}
            data={data?.results || []}
            onRowClick={(row) => navigate(`/bids/opening/${row.id}`)}
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

export default BidOpeningList;

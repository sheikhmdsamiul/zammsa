import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { bidsApi } from '../../api/bids';
import { solicitationsApi } from '../../api/solicitations';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { LockOpenIcon } from '@heroicons/react/outline';

const BidsList: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedTender, setSelectedTender] = useState('');

  const { data: tendersData } = useQuery({
    queryKey: ['tenders-for-bids'],
    queryFn: () => solicitationsApi.list({ page_size: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['bids', page, pageSize, search, selectedTender],
    queryFn: () => bidsApi.list({ page, page_size: pageSize, search, solicitation: selectedTender || undefined }),
  });

  const columns = [
    { key: 'bid_number', label: 'Bid #', sortable: true, render: (_: any, row: any) => (
      <Link to={`/bids/${row.id}`} className="text-zammsa-green hover:underline font-medium">{row.bid_number}</Link>
    )},
    { key: 'vendor_name', label: 'Vendor', sortable: true },
    { key: 'bid_amount', label: 'Amount', render: (v: number) => v?.toLocaleString() },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'submitted_at', label: 'Submitted', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'security_verified', label: 'Security', render: (v: boolean) => (
      <span className={`text-xs font-medium ${v ? 'text-green-600' : 'text-yellow-600'}`}>{v ? 'Verified' : 'Pending'}</span>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bids</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage submitted bids</p>
        </div>
        <button onClick={() => navigate('/bids')} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold flex items-center gap-2">
          <LockOpenIcon className="w-4 h-4" />
          Bid Opening
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="flex-1">
            <SearchBar value={search} onChange={setSearch} placeholder="Search bids..." />
          </div>
          <select
            value={selectedTender}
            onChange={(e) => { setSelectedTender(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-zammsa-green focus:border-zammsa-green outline-none"
          >
            <option value="">All Tenders</option>
            {tendersData?.results?.map((t) => (
              <option key={t.id} value={t.id}>{t.sol_number || t.title} — {t.title} ({t.total_bids ?? 0} bids)</option>
            ))}
          </select>
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={data?.results || []} onRowClick={(row) => navigate(`/bids/${row.id}`)} />
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

export default BidsList;

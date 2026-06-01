import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bidsApi } from '../../api/bids';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import {
  XCircleIcon, ClockIcon, ExclamationIcon, BanIcon, FilterIcon,
} from '@heroicons/react/outline';

type FilterType = 'all' | 'late' | 'non_responsive' | 'withdrawn';

const LateRejectedBids: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const lateFilter = filter === 'late' ? { is_late: true } : {};
  const statusFilter = filter === 'non_responsive' ? { status: 'non_responsive' } :
    filter === 'withdrawn' ? { status: 'withdrawn' } : {};

  const { data, isLoading } = useQuery({
    queryKey: ['late-rejected-bids', page, pageSize, search, filter],
    queryFn: () => bidsApi.list({ page, page_size: pageSize, search, ...lateFilter, ...statusFilter }),
  });

  const { data: lateBids } = useQuery({
    queryKey: ['late-bids-count'],
    queryFn: () => bidsApi.listLateBids({ page_size: 1 }),
  });

  const { data: nonRespBids } = useQuery({
    queryKey: ['non-responsive-bids-count'],
    queryFn: () => bidsApi.list({ status: 'non_responsive', page_size: 1 }),
  });

  const { data: withdrawnBids } = useQuery({
    queryKey: ['withdrawn-bids-count'],
    queryFn: () => bidsApi.list({ status: 'withdrawn', page_size: 1 }),
  });

  const bids = data?.results || [];
  const lateCount = lateBids?.count || 0;
  const nonRespCount = nonRespBids?.count || 0;
  const withdrawnCount = withdrawnBids?.count || 0;

  const columns = [
    { key: 'submission_id', label: 'BID #', render: (v: string) => <span className="font-medium font-mono text-xs">{v || '---'}</span> },
    { key: 'supplier_name', label: 'Supplier', render: (v: string) => v || '-' },
    { key: 'solicitation_title', label: 'Solicitation', render: (v: string, row: any) => (
      <div className="max-w-[180px]">
        <p className="text-sm truncate">{v || row.solicitation_title || '-'}</p>
        <p className="text-xs text-gray-400">{row.solicitation_number || ''}</p>
      </div>
    )},
    { key: 'submitted_at', label: 'Submitted', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { key: 'bid_price', label: 'Amount', render: (v: number) => v != null ? `K ${v.toLocaleString()}` : '-' },
    { key: 'is_late', label: 'Late', render: (v: boolean) => v
      ? <span className="text-rose-600 text-xs font-bold flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" /> Late</span>
      : <span className="text-gray-400 text-xs">No</span>
    },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'unknown'} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Late & Rejected Bids"
        description="Bids submitted after deadline, non-responsive, or withdrawn"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Late Submissions" value={lateCount} icon={<ClockIcon className="w-6 h-6" />} color="red"
          description="Submitted after the deadline" />
        <StatCard label="Non-Responsive" value={nonRespCount} icon={<XCircleIcon className="w-6 h-6" />} color="orange"
          description="Failed eligibility or responsiveness" />
        <StatCard label="Withdrawn" value={withdrawnCount} icon={<BanIcon className="w-6 h-6" />} color="gray"
          description="Bids withdrawn by suppliers" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-100">
          <div className="flex">
            {([
              { key: 'all', label: 'All' },
              { key: 'late', label: 'Late Submissions' },
              { key: 'non_responsive', label: 'Non-Responsive' },
              { key: 'withdrawn', label: 'Withdrawn' },
            ] as { key: FilterType; label: string }[]).map((f) => (
              <button key={f.key}
                onClick={() => { setFilter(f.key); setPage(1); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  filter === f.key ? 'border-zammsa-green text-zammsa-green' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by bid # or supplier..." />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FilterIcon className="w-4 h-4" />
              <span>{(filter === 'all' ? lateCount + nonRespCount + withdrawnCount : data?.count) || 0} bids</span>
            </div>
          </div>
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={bids} />
        )}
        {!bids.length && !isLoading && (
          <div className="py-12 text-center text-gray-400">
            <ExclamationIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">No late or rejected bids found</p>
            <p className="text-sm mt-1">Bids that are late, non-responsive, or withdrawn will appear here</p>
          </div>
        )}
        {data && (
          <Pagination currentPage={page} totalPages={Math.ceil((data.count || 0) / pageSize)} pageSize={pageSize}
            totalItems={data.count || 0} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default LateRejectedBids;

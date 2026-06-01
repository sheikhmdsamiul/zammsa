import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';

const MilestonesList: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['milestones', page, pageSize, search],
    queryFn: () => contractsApi.listMilestones({ page, page_size: pageSize, search }),
  });

  const columns = [
    {
      key: 'milestone_name', label: 'Milestone', sortable: true,
      render: (v: string, row: any) => (
        <Link to={`/contracts/${row.contract}/milestones`} className="text-zammsa-green hover:underline font-medium">
          {v}
        </Link>
      ),
    },
    {
      key: 'contract', label: 'Contract',
      render: (v: string) => v ? v.substring(0, 8) + '...' : '-',
    },
    { key: 'due_date', label: 'Due Date', sortable: true, render: (v: string) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
    { key: 'completed_at', label: 'Completed', render: (v: string) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
    {
      key: 'status', label: 'Status',
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      key: 'notes', label: 'Notes',
      render: (v: string) => v ? <span className="text-gray-600 truncate max-w-[200px] block">{v}</span> : '-',
    },
  ];

  const stats = [
    { label: 'Total', count: data?.count || 0, color: 'text-gray-900' },
    { label: 'Overdue', count: (data?.results || []).filter((m: any) => m.status === 'overdue').length, color: 'text-red-600' },
    { label: 'Completed', count: (data?.results || []).filter((m: any) => m.status === 'completed').length, color: 'text-emerald-600' },
    { label: 'Pending', count: (data?.results || []).filter((m: any) => m.status === 'pending').length, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contract Milestones</h1>
        <p className="text-sm text-gray-500 mt-1">Track key dates and deliverables across all contracts</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search milestones..." />
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

export default MilestonesList;
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ApiPerformance {
  performance_id: string;
  supplier: string;
  contract: string | null;
  evaluation_date: string;
  metrics: Record<string, number>;
  overall_score: string;
  needs_improvement: boolean;
  improvement_notes: string;
}

const SupplierPerformanceList: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-performances', page, pageSize, search],
    queryFn: () =>
      api.get('/suppliers/performances/', { params: { page, page_size: pageSize, search } })
        .then(r => r.data),
  });

  const columns = [
    {
      key: 'supplier', label: 'Supplier',
      render: (v: string) => v ? v.substring(0, 8) + '...' : '-',
    },
    {
      key: 'contract', label: 'Contract',
      render: (v: string | null) => v ? v.substring(0, 8) + '...' : 'N/A',
    },
    {
      key: 'overall_score', label: 'Score', sortable: true,
      render: (v: string) => {
        const score = parseFloat(v);
        const color = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
        return <span className={`font-bold ${color}`}>{score}%</span>;
      },
    },
    {
      key: 'needs_improvement', label: 'Status',
      render: (v: boolean) => v
        ? <StatusBadge status="needs_improvement" />
        : <StatusBadge status="active" />,
    },
    { key: 'evaluation_date', label: 'Evaluated', sortable: true, render: (v: string) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
    { key: 'improvement_notes', label: 'Notes', render: (v: string) => v || '-' },
  ];

  const performances: ApiPerformance[] = data?.results || [];
  const avgScore = performances.length
    ? Math.round(performances.reduce((s, p) => s + parseFloat(p.overall_score), 0) / performances.length)
    : 0;
  const needsImprovement = performances.filter(p => p.needs_improvement).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Supplier Performance</h1>
        <p className="text-sm text-gray-500 mt-1">Evaluation records across all suppliers and contracts</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{data?.count || 0}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Total Evaluations</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-emerald-700">{avgScore}%</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Average Score</p>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-red-700">{needsImprovement}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Needs Improvement</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search evaluations..." />
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={performances} />
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

export default SupplierPerformanceList;
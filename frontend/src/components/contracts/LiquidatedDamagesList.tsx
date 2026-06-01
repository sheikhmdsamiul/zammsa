import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';

const LiquidatedDamagesList: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['liquidated-damages', page, pageSize, search],
    queryFn: () => contractsApi.listLiquidatedDamages({ page, page_size: pageSize, search }),
  });

  const columns = [
    { key: 'assessment_date', label: 'Date', sortable: true, render: (v: string) => v ? new Date(v).toLocaleDateString('en-GB') : '-' },
    {
      key: 'contract', label: 'Contract',
      render: (v: string) => v ? v.substring(0, 8) + '...' : '-',
    },
    { key: 'days_delayed', label: 'Days Late', sortable: true, render: (v: number) => <span className="font-bold text-red-600">{v}</span> },
    {
      key: 'calculated_amount', label: 'Calculated',
      render: (v: string) => `ZMW ${parseFloat(v || '0').toLocaleString()}`,
    },
    {
      key: 'applied_amount', label: 'Applied',
      render: (v: string, row: any) => v ? `ZMW ${parseFloat(v).toLocaleString()}` : (
        <Link to={`/contracts/${row.contract}/ld`} className="text-zammsa-green hover:underline text-xs font-medium">Apply</Link>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (v: string) => <StatusBadge status={v} />,
    },
  ];

  const totalAssessed = (data?.results || []).reduce((sum: number, ld: any) => sum + parseFloat(ld.calculated_amount || '0'), 0);
  const totalApplied = (data?.results || []).reduce((sum: number, ld: any) => sum + parseFloat(ld.applied_amount || '0'), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquidated Damages</h1>
          <p className="text-sm text-gray-500 mt-1">Assess and track penalty charges for delayed deliveries</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{data?.count || 0}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Total Assessments</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-amber-700">ZMW {totalAssessed.toLocaleString()}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Total Calculated</p>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-red-700">ZMW {totalApplied.toLocaleString()}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Total Applied</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search assessments..." />
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

export default LiquidatedDamagesList;
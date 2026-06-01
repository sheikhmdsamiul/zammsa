import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  ShieldCheckIcon, ExclamationIcon, CheckCircleIcon, ClockIcon,
} from '@heroicons/react/outline';

const PerformanceSecurity: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['performance-securities', page, pageSize, search],
    queryFn: () => contractsApi.list({ page, page_size: pageSize, search }),
  });

  const contracts = data?.results || [];

  const required = contracts.filter((c: any) => c.performance_bond_required && !c.performance_bond_amount).length;
  const uploaded = contracts.filter((c: any) => c.performance_bond_required && c.performance_bond_amount && c.status === 'active').length;
  const expiring = contracts.filter((c: any) => {
    if (!c.performance_bond_expiry) return false;
    const daysLeft = Math.ceil((new Date(c.performance_bond_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 30;
  }).length;
  const expired = contracts.filter((c: any) => {
    if (!c.performance_bond_expiry) return false;
    return new Date(c.performance_bond_expiry) < new Date();
  }).length;

  const columns = [
    { key: 'contract_number', label: 'Contract', render: (v: string) => <span className="font-medium">{v || '---'}</span> },
    { key: 'title', label: 'Title', render: (v: string) => <span className="text-gray-600 truncate max-w-[180px] block">{v || '-'}</span> },
    { key: 'vendor_name', label: 'Supplier', render: (v: string) => v || '-' },
    { key: 'performance_bond_amount', label: 'Bond Amount', render: (v: number, row: any) => (
      <span>{v ? `K ${v.toLocaleString()}` : row.performance_bond_required ? <span className="text-amber-600 text-xs">Required</span> : <span className="text-gray-400">N/A</span>}</span>
    )},
    { key: 'performance_bond_expiry', label: 'Expiry', render: (v: string) => {
      if (!v) return <span className="text-gray-400">-</span>;
      const days = Math.ceil((new Date(v).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return (
        <span className={days <= 0 ? 'text-rose-600 font-medium' : days <= 30 ? 'text-amber-600 font-medium' : ''}>
          {new Date(v).toLocaleDateString()} {days <= 0 ? '(Expired)' : days <= 30 ? `(${days}d)` : ''}
        </span>
      );
    }},
    { key: 'status', label: 'Contract Status', render: (v: string) => <StatusBadge status={v || 'draft'} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Security"
        description="Track performance bonds and security guarantees across all contracts"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Bond Required" value={required} icon={<ExclamationIcon className="w-6 h-6" />} color="orange" description="Awaiting submission" />
        <StatCard label="Active Bonds" value={uploaded} icon={<ShieldCheckIcon className="w-6 h-6" />} color="green" description="Validated and active" />
        <StatCard label="Expiring Soon" value={expiring} icon={<ClockIcon className="w-6 h-6" />} color="red" description="Within 30 days" />
        <StatCard label="Expired" value={expired} icon={<ExclamationIcon className="w-6 h-6" />} color="gray" description="Past expiry date" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by contract # or supplier..." />
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={contracts} />
        )}
        {!contracts.length && !isLoading && (
          <div className="py-12 text-center text-gray-400">
            <ShieldCheckIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">No performance security records</p>
            <p className="text-sm mt-1">Performance bonds will appear when contracts require them</p>
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

export default PerformanceSecurity;

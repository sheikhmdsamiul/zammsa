import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import { useSearchParams } from 'react-router-dom';
import fileSaver from 'file-saver';
import toast from 'react-hot-toast';
import {
  formatContractValue,
  formatDate,
  getListProgressHint,
  STATUS_FILTER_OPTIONS,
  CONTRACT_TYPE_LABELS,
} from './contractUtils';
import {
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  CashIcon,
  RefreshIcon,
} from '@heroicons/react/outline';

const ContractsList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const queueFilter = searchParams.get('queue') || '';
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState('-created_at');

  const listParams = useMemo(() => {
    const p: Record<string, string | number> = {
      page,
      page_size: pageSize,
      ordering: sortKey,
    };
    if (search.trim()) p.search = search.trim();
    if (statusFilter) p.status = statusFilter;
    if (queueFilter === 'dg_signature') p.pending_dg_signature = 'true';
    if (queueFilter === 'security') p.pending_security_validation = 'true';
    if (queueFilter === 'supplier_sign') p.pending_supplier_signature = 'true';
    return p;
  }, [page, pageSize, search, statusFilter, sortKey, queueFilter]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['contracts', listParams],
    queryFn: () => contractsApi.list(listParams),
  });

  React.useEffect(() => {
    if (isError) toast.error('Failed to load contracts');
  }, [isError]);

  const results = data?.results || [];
  const total = data?.count ?? 0;

  const stats = useMemo(() => {
    const active = results.filter((c: { status: string }) => c.status === 'active').length;
    const pending = results.filter((c: { status: string }) =>
      ['draft', 'pending_acceptance'].includes(c.status),
    ).length;
    const totalValue = results.reduce((sum: number, c: { value?: number }) => sum + (c.value || 0), 0);
    return { active, pending, totalValue };
  }, [results]);

  const canGenerate =
    user?.role === ROLES.PROCUREMENT_OFFICER || user?.role === ROLES.SYSTEM_ADMIN;
  const isDG = user?.role === ROLES.DIRECTOR_GENERAL;
  const isCM = user?.role === ROLES.CONTRACT_MANAGER;

  const queueBanner =
    queueFilter === 'dg_signature'
      ? 'Contracts awaiting your countersignature'
      : queueFilter === 'security'
        ? 'Contracts awaiting performance security validation'
        : queueFilter === 'supplier_sign'
          ? 'Contracts awaiting supplier signature (vendor portal)'
          : null;

  const handleExport = async () => {
    try {
      const blob = await contractsApi.export({ search, status: statusFilter || undefined });
      fileSaver.saveAs(blob, `contracts_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Contracts exported');
    } catch {
      toast.error('Export failed');
    }
  };

  const columns = [
    {
      key: 'contract_number',
      label: 'Contract',
      sortable: true,
      render: (_: unknown, row: Record<string, unknown>) => (
        <div className="min-w-[140px]">
          <Link
            to={`/contracts/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-zammsa-green hover:underline font-bold text-sm"
          >
            {String(row.contract_number || '—')}
          </Link>
          {row.title ? (
            <p className="text-xs text-gray-500 truncate max-w-[200px] mt-0.5">{String(row.title)}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'vendor_name',
      label: 'Supplier',
      sortable: true,
      render: (v: string) => <span className="text-gray-800">{v || '—'}</span>,
    },
    {
      key: 'solicitation_number',
      label: 'Solicitation',
      render: (v: string) => (
        <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">{v || '—'}</span>
      ),
    },
    {
      key: 'contract_type',
      label: 'Type',
      render: (v: string) => (
        <span className="text-xs font-medium text-gray-600">
          {CONTRACT_TYPE_LABELS[v] || v?.toUpperCase() || '—'}
        </span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      sortable: true,
      render: (v: number, row: { currency?: string }) => (
        <span className="font-semibold text-gray-900 tabular-nums">{formatContractValue(v, row.currency)}</span>
      ),
    },
    {
      key: 'end_date',
      label: 'Period',
      render: (_: unknown, row: { start_date?: string; end_date?: string }) => (
        <span className="text-xs text-gray-600 whitespace-nowrap">
          {formatDate(row.start_date)} – {formatDate(row.end_date)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v: string, row: Record<string, unknown>) => {
        const hint = getListProgressHint(row as Parameters<typeof getListProgressHint>[0]);
        return (
          <div className="space-y-1">
            <StatusBadge status={v} />
            {hint && <p className="text-[10px] font-medium text-amber-700 max-w-[120px]">{hint}</p>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      render: (_: unknown, row: { id: string; status: string }) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => navigate(`/contracts/${row.id}`)}
            className="px-2.5 py-1.5 text-xs font-bold text-zammsa-green hover:bg-zammsa-green/5 rounded-lg"
          >
            View
          </button>
          {['draft', 'pending_acceptance'].includes(row.status) && (
            <button
              type="button"
              onClick={() => navigate(`/contracts/${row.id}/standstill`)}
              className="px-2.5 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg"
            >
              Standstill
            </button>
          )}
          {(row as { signed_by_vendor?: boolean; signed_by_authority?: boolean }).signed_by_vendor &&
            !(row as { signed_by_authority?: boolean }).signed_by_authority &&
            isDG && (
              <button
                type="button"
                onClick={() => navigate(`/contracts/${row.id}/signing`)}
                className="px-2.5 py-1.5 text-xs font-bold text-zammsa-green hover:bg-zammsa-green/5 rounded-lg"
              >
                Countersign
              </button>
            )}
          <button
            type="button"
            onClick={() => navigate(`/contracts/${row.id}/signing`)}
            className="px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            Signing
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="pb-12 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Contracts"
        description="View and manage procurement contracts from award through closure"
        breadcrumbs={[{ label: 'Contract Award' }, { label: 'All Contracts' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshIcon className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              Export
            </button>
            {canGenerate && (
              <Link
                to="/contracts/generate"
                className="px-4 py-2 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green-dark"
              >
                Generate Contract
              </Link>
            )}
          </div>
        }
      />

      {queueBanner && (
        <div className="px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-medium text-indigo-900">
          {queueBanner}
          <Link to="/contracts" className="ml-2 text-indigo-600 font-bold hover:underline">
            Clear filter
          </Link>
        </div>
      )}

      {(isDG || isCM) && !queueFilter && (
        <div className="flex flex-wrap gap-2">
          {isDG && (
            <Link
              to="/contracts?queue=dg_signature"
              className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              DG signing queue
            </Link>
          )}
          {isCM && (
            <Link
              to="/contracts?queue=security"
              className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-xl border border-amber-200 text-amber-800 hover:bg-amber-50"
            >
              Security validation queue
            </Link>
          )}
          <Link
            to="/contracts?queue=supplier_sign"
            className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Awaiting supplier sign
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total (this page)"
          value={total.toLocaleString()}
          icon={<DocumentTextIcon className="w-6 h-6" />}
          color="blue"
          description={`Showing ${results.length} on page ${page}`}
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={<CheckCircleIcon className="w-6 h-6" />}
          color="green"
          description="Executing contracts"
        />
        <StatCard
          label="In progress"
          value={stats.pending}
          icon={<ClockIcon className="w-6 h-6" />}
          color="orange"
          description="Draft or pending acceptance"
        />
        <StatCard
          label="Value (page)"
          value={formatContractValue(stats.totalValue)}
          icon={<CashIcon className="w-6 h-6" />}
          color="purple"
          description="Sum of contracts on this page"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <SearchBar
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search by contract number or supplier..."
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50/50 min-w-[180px]"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { path: '/contracts/award-notices', label: 'Award notices' },
              { path: '/contracts/performance-security', label: 'Performance security' },
              { path: '/contracts/milestones', label: 'Milestones' },
              { path: '/contracts/closure', label: 'Closure' },
            ].map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-zammsa-green px-3 py-1.5 rounded-lg border border-gray-100 hover:border-zammsa-green/30 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-16" />
        ) : results.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">No contracts found</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
              {search || statusFilter
                ? 'Try adjusting your search or status filter.'
                : 'Contracts appear here after generation from an approved BER.'}
            </p>
            {canGenerate && !search && !statusFilter && (
              <Link
                to="/contracts/generate"
                className="inline-block mt-6 px-6 py-2.5 bg-zammsa-green text-white text-sm font-bold rounded-xl hover:bg-zammsa-green-dark"
              >
                Generate first contract
              </Link>
            )}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={results}
            sortKey={sortKey.replace('-', '')}
            sortDir={sortKey.startsWith('-') ? 'desc' : 'asc'}
            onSort={(key) => {
              setSortKey(sortKey === key ? `-${key}` : key);
              setPage(1);
            }}
            onRowClick={(row) => navigate(`/contracts/${row.id}`)}
          />
        )}

        {data && results.length > 0 && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / pageSize) || 1}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ContractsList;

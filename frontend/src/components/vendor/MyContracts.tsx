import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { Contract } from '../../types';
import { canSupplierSign, canUploadPerformanceSecurity } from '../contracts/contractUtils';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/outline';

const PAGE_SIZE = 10;

function contractActionLabel(c: Contract): { label: string; tone: 'green' | 'amber' | 'gray' } | null {
  if (canSupplierSign(c)) return { label: 'Sign required', tone: 'green' };
  if (canUploadPerformanceSecurity(c)) return { label: 'Upload bond', tone: 'amber' };
  if (c.signed_by_vendor && !c.signed_by_authority) return { label: 'Awaiting DG', tone: 'gray' };
  if (c.performance_security_uploaded && !c.performance_security_validated) {
    return { label: 'Bond under review', tone: 'gray' };
  }
  return null;
}

const MyContracts: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const params: Record<string, string | number> = { page, page_size: pageSize };
  if (search) params.search = search;
  if (status) params.status = status;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vendor-contracts', params],
    queryFn: () => vendorApi.contracts.list(params),
  });

  const results = (data?.results || []) as Contract[];
  const pendingSign = results.filter((c) => canSupplierSign(c)).length;
  const pendingBond = results.filter((c) => canUploadPerformanceSecurity(c)).length;

  return (
    <div className="pb-12">
      <PageHeader
        title="My Contracts"
        description="Awarded contracts — sign, upload performance security, and submit invoices"
      />

      {(pendingSign > 0 || pendingBond > 0) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {pendingSign > 0 && (
            <div className="px-4 py-2 bg-zammsa-green/10 border border-zammsa-green/20 rounded-xl text-sm font-bold text-zammsa-green">
              {pendingSign} contract(s) awaiting your signature
            </div>
          )}
          {pendingBond > 0 && (
            <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm font-bold text-amber-800">
              {pendingBond} contract(s) need performance security
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search by contract number..."
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium min-w-[180px]"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_acceptance">Pending acceptance</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : isError ? (
        <div className="text-center py-16 text-red-600">Failed to load contracts</div>
      ) : !results.length ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-500">No contracts awarded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((contract) => {
            const action = contractActionLabel(contract);
            const start = new Date(contract.start_date).getTime();
            const end = new Date(contract.end_date).getTime();
            const now = Date.now();
            const progress =
              end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;

            return (
              <div
                key={contract.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:border-zammsa-green/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-gray-900">{contract.contract_number}</h3>
                      <StatusBadge status={contract.status} />
                      {action && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            action.tone === 'green'
                              ? 'bg-zammsa-green/10 text-zammsa-green'
                              : action.tone === 'amber'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {action.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{contract.title}</p>
                  </div>
                  <p className="text-lg font-bold text-zammsa-green whitespace-nowrap">
                    K {contract.value?.toLocaleString()}
                  </p>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{new Date(contract.start_date).toLocaleDateString()}</span>
                    <span>{Math.round(progress)}%</span>
                    <span>{new Date(contract.end_date).toLocaleDateString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-zammsa-green h-2 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 flex-wrap gap-3">
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      {contract.signed_by_vendor ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-400" />
                      )}
                      Your signature
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {contract.signed_by_authority ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-400" />
                      )}
                      DG signature
                    </span>
                  </div>
                  <Link
                    to={`/vendor/contracts/${contract.id}`}
                    className={`px-4 py-2 text-sm font-bold rounded-xl ${
                      action?.tone === 'green'
                        ? 'bg-zammsa-green text-white hover:bg-zammsa-green-dark'
                        : 'text-zammsa-green border border-zammsa-green hover:bg-green-50'
                    }`}
                  >
                    {action?.tone === 'green' ? 'Sign now' : 'View contract'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && results.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(data.count / pageSize)}
          pageSize={pageSize}
          totalItems={data.count}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      )}
    </div>
  );
};

export default MyContracts;

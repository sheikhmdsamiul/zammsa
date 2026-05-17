import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/outline';

const PAGE_SIZE = 10;

const MyContracts: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const params: Record<string, any> = { page, page_size: pageSize };
  if (search) params.q = search;
  if (status) params.status = status;

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-contracts', params],
    queryFn: () => vendorApi.contracts.list(params),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Contracts</h1>
        <p className="text-gray-500 mt-1">View and manage your awarded contracts</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search contracts..." />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="border-gray-300 rounded-lg text-sm w-44">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="terminated">Terminated</option>
          <option value="amended">Amended</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : !data?.results?.length ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400">No contracts awarded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.results.map((contract) => {
            const start = new Date(contract.start_date).getTime();
            const end = new Date(contract.end_date).getTime();
            const now = Date.now();
            const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
            return (
              <div key={contract.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{contract.contract_number}</h3>
                      <StatusBadge status={contract.status} />
                    </div>
                    <p className="text-sm text-gray-500">{contract.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-zammsa-green">{contract.currency} {contract.value?.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Start: {new Date(contract.start_date).toLocaleDateString()}</span>
                    <span>{Math.round(progress)}% complete</span>
                    <span>End: {new Date(contract.end_date).toLocaleDateString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-zammsa-green h-2 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1">{contract.signed_by_vendor ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <XCircleIcon className="h-4 w-4 text-red-500" />} Signed by vendor</span>
                    <span className="inline-flex items-center gap-1">{contract.signed_by_authority ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <XCircleIcon className="h-4 w-4 text-red-500" />} Signed by authority</span>
                  </div>
                  <Link to={`/vendor/contracts/${contract.id}`} className="px-3 py-1.5 text-sm text-zammsa-green border border-zammsa-green rounded-lg hover:bg-green-50">View Details</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && (
        <Pagination currentPage={page} totalPages={Math.ceil(data.count / pageSize)} pageSize={pageSize} totalItems={data.count} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}
    </div>
  );
};

export default MyContracts;

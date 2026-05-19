import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ConfirmModal } from '../common/ConfirmModal';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/outline';

const PAGE_SIZE = 10;

const MyBids: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const params: Record<string, any> = { page, page_size: pageSize };
  if (search) params.q = search;
  if (status) params.status = status;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor-bids', params],
    queryFn: () => vendorApi.bids.list(params),
  });

  const handleWithdraw = async () => {
    if (!withdrawId) return;
    try {
      await vendorApi.bids.withdraw(withdrawId);
      toast.success('Bid withdrawn successfully');
      setWithdrawId(null);
      refetch();
    } catch { /* handled by interceptor */ }
  };

  const clearFilters = () => { setStatus(''); setDateFrom(''); setDateTo(''); setPage(1); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Bids</h1>
          <p className="text-gray-500 mt-1">Track your submitted bids</p>
        </div>
        <Link to="/vendor/open-tenders" className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark">Browse Tenders</Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by tender title..." />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Filters</button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500">Status</label>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full border-gray-300 rounded-md text-sm mt-1">
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="opened">Opened</option>
                <option value="evaluated">Evaluated</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-full border-gray-300 rounded-md text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-full border-gray-300 rounded-md text-sm mt-1" />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700">Clear Filters</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : !data?.results?.length ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400">No bids found.</p>
          <Link to="/vendor/open-tenders" className="text-sm text-zammsa-green hover:underline mt-2 inline-block">Browse open tenders</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {data.results.map((bid) => {
            const canWithdraw = bid.status === 'draft' || bid.status === 'submitted';
            return (
              <div key={bid.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{bid.bid_number}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Submitted: {bid.submitted_at ? new Date(bid.submitted_at).toLocaleDateString() : 'Not submitted'}</p>
                  </div>
                  <StatusBadge status={bid.status} />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>Amount: <strong>{bid.currency} {bid.bid_amount?.toLocaleString()}</strong></span>
                    {bid.security_verified !== undefined && <span className="inline-flex items-center gap-1">{bid.security_verified ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <XCircleIcon className="h-4 w-4 text-red-500" />} Security</span>}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/vendor/bids/${bid.id}`}
                      className="px-3 py-1.5 text-sm text-zammsa-green border border-zammsa-green rounded-lg hover:bg-green-50"
                    >
                      View
                    </Link>
                    {canWithdraw && (
                      <button onClick={() => setWithdrawId(bid.id)} className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50">Withdraw</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && (
        <Pagination currentPage={page} totalPages={Math.ceil(data.count / pageSize)} pageSize={pageSize} totalItems={data.count} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}

      <ConfirmModal open={!!withdrawId} onClose={() => setWithdrawId(null)} onConfirm={handleWithdraw} title="Withdraw Bid" message="Are you sure you want to withdraw this bid? This action cannot be undone." confirmText="Withdraw" variant="danger" />
    </div>
  );
};

export default MyBids;

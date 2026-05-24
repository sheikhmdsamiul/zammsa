import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  CheckCircleIcon, XCircleIcon, ClockIcon,
  DocumentTextIcon, EyeIcon,
} from '@heroicons/react/outline';

const PAGE_SIZE = 10;

const TYPE_LABELS: Record<string, string> = {
  rfb: 'ITB', rfp: 'RFP', rfq: 'RFQ', rfi: 'RFI',
};

function fmtDate(d: string | undefined): string {
  if (!d) return '---';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const MyBids: React.FC = () => {
  const navigate = useNavigate();
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
          <h1 className="text-xl font-black text-gray-900">My Bids</h1>
          <p className="text-sm font-semibold text-gray-500 mt-1">Track your submitted bids</p>
        </div>
        <Link to="/vendor/open-tenders" className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green/90 transition-colors">
          Browse Tenders
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by tender title..." />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</label>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20 mt-1">
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="opened">Opened</option>
                <option value="evaluated">Evaluated</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20 mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-zammsa-green/20 mt-1" />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={clearFilters} className="text-xs font-bold text-gray-500 hover:text-gray-700">Clear Filters</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner className="py-20" />
      ) : !data?.results?.length ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 shadow-sm">
          <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">No bids found</p>
          <Link to="/vendor/open-tenders" className="text-sm font-bold text-zammsa-green hover:underline mt-2 inline-block">Browse open tenders</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {data.results.map((bid) => {
            const canWithdraw = bid.status === 'draft' || bid.status === 'submitted';
            const typeLabel = TYPE_LABELS[bid.solicitation_type || ''] || bid.solicitation_type?.toUpperCase();
            const isLate = bid.is_late;
            const statusColor = bid.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                bid.status === 'withdrawn' ? 'bg-gray-50 text-gray-500 border-gray-200' :
                                bid.status === 'opened' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                bid.status === 'evaluated' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                bid.status === 'draft' ? 'bg-amber-50 text-amber-700 border-amber-200' : '';
            return (
              <div key={bid.id} className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                        {typeLabel || '---'}
                      </span>
                      <span className="text-xs font-semibold text-gray-400">{bid.solicitation_number || bid.bid_number}</span>
                      <StatusBadge status={bid.status} />
                      {isLate && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 uppercase tracking-wider">Late</span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-gray-900 truncate">
                      {bid.solicitation_title || 'Untitled Solicitation'}
                    </h3>
                    <div className="flex items-center gap-4 mt-1.5 text-xs font-semibold text-gray-500">
                      <span>Bid: {bid.bid_number}</span>
                      <span>Amount: <span className="text-gray-900">{bid.currency} {bid.bid_amount?.toLocaleString()}</span></span>
                      {bid.submitted_at && <span>Submitted: {fmtDate(bid.submitted_at)}</span>}
                      {bid.closing_date && (
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" />
                          {new Date(bid.closing_date).getTime() < Date.now() ? 'Closed' : `Closes ${fmtDate(bid.closing_date)}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => navigate(`/vendor/bids/${bid.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-zammsa-green bg-white border border-zammsa-green rounded-xl hover:bg-green-50 transition-colors"
                    >
                      <EyeIcon className="w-4 h-4" /> View
                    </button>
                    {canWithdraw && (
                      <button
                        onClick={() => setWithdrawId(bid.id)}
                        className="px-3 py-2 text-sm font-bold text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>

                {/* Security verification footer */}
                {bid.security_verified !== undefined && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${bid.security_verified ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {bid.security_verified ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
                      Bid Security {bid.security_verified ? 'Verified' : 'Not Verified'}
                    </span>
                    {bid.addenda_acknowledged && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircleIcon className="w-3.5 h-3.5" /> Addenda Acknowledged
                      </span>
                    )}
                  </div>
                )}
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

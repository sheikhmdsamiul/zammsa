import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';

const PAGE_SIZE = 10;

const OpenTenders: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const params: Record<string, any> = { page, page_size: pageSize };
  if (search) params.q = search;
  if (category) params.category = category;

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-open-tenders', params],
    queryFn: () => vendorApi.openTenders.list(params),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Open Tenders</h1>
        <p className="text-gray-500 mt-1">Browse and submit bids for open tenders</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search tenders..." />
        </div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="border-gray-300 rounded-lg text-sm w-48">
          <option value="">All Categories</option>
          <option value="pharmaceuticals">Pharmaceuticals</option>
          <option value="medical_equipment">Medical Equipment</option>
          <option value="consumables">Consumables</option>
          <option value="services">Services</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : !data?.results?.length ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400">No open tenders available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.results.map((tender) => {
            const countdown = new Date(tender.closing_date).getTime() - Date.now();
            const daysLeft = Math.ceil(countdown / (1000 * 60 * 60 * 24));
            const isExpired = countdown <= 0;
            return (
              <div key={tender.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">{tender.type?.toUpperCase()}</span>
                      <span className="text-xs text-gray-400">{tender.tender_number}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{tender.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{tender.department} • {tender.procurement_method}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-zammsa-green">{tender.currency} {tender.estimated_value?.toLocaleString()}</p>
                    <span className={`text-xs font-medium ${isExpired ? 'text-red-500' : daysLeft <= 3 ? 'text-orange-500' : 'text-gray-500'}`}>
                      {isExpired ? 'Closed' : `${daysLeft} days remaining`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>Closes: {new Date(tender.closing_date).toLocaleDateString()}</span>
                    <span>Opens: {new Date(tender.opening_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/vendor/open-tenders/${tender.id}`}
                      className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      View Details
                    </Link>
                    <Link
                      to={`/vendor/open-tenders/${tender.id}/bid`}
                      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${isExpired ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-zammsa-green text-white hover:bg-zammsa-green-dark'}`}
                      onClick={(e) => { if (isExpired) e.preventDefault(); }}
                    >
                      {isExpired ? 'Closed' : 'Submit Bid'}
                    </Link>
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
    </div>
  );
};

export default OpenTenders;

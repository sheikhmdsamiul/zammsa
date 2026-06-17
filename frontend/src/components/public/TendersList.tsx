import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { useCountdown } from '../../hooks/useCountdown';
import { StatusBadge } from '../common/StatusBadge';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { SearchIcon, FilterIcon, DownloadIcon, PrinterIcon, ArrowRightIcon } from '@heroicons/react/outline';

const PAGE_SIZE = 12;

const TenderCard: React.FC<{ tender: any }> = ({ tender }) => {
  const countdown = useCountdown(tender.closing_date);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-zammsa-green/30 transition-all flex flex-col group shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex gap-2">
          <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${
            tender.type === 'rfb' ? 'bg-blue-50 text-blue-600' :
            tender.type === 'rfp' ? 'bg-purple-50 text-purple-600' :
            tender.type === 'rfq' ? 'bg-emerald-50 text-emerald-600' :
            'bg-slate-50 text-slate-600'
          }`}>{tender.type?.toUpperCase()}</span>
          <StatusBadge status={tender.status} />
        </div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{tender.tender_number}</span>
      </div>
      
      <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug group-hover:text-zammsa-green transition-colors line-clamp-2">{tender.title}</h3>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{tender.department}</p>
      <p className="text-sm font-medium text-slate-500 mb-6 flex-1 line-clamp-2">{tender.procuring_entity}</p>
      
      <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50 mb-6">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Closes In</span>
          <span className={`text-sm font-bold ${countdown.expired ? 'text-rose-600' : 'text-amber-600'}`}>
            {countdown.expired ? 'Closed' : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Closing Date</span>
          <span className="text-sm font-bold text-slate-900">{new Date(tender.closing_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Est. Value</span>
          <p className="text-base font-bold text-zammsa-green">{tender.currency} {tender.estimated_value?.toLocaleString()}</p>
        </div>
        <Link
          to={`/tenders/${tender.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 text-zammsa-green text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-zammsa-green hover:text-white transition-all shadow-sm"
        >
          Details <ArrowRightIcon className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

const TendersList: React.FC = () => {
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [showFilters, setShowFilters] = useState(false);

  const params: Record<string, any> = { page, page_size: pageSize };
  if (search) params.q = search;
  if (method) params.method = method;
  if (category) params.category = category;

  const { data, isLoading } = useQuery({
    queryKey: ['public-tenders', params],
    queryFn: () => publicApi.listTenders(params),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <PageHeader 
        title="Tender Opportunities"
        description="Access current bidding opportunities and procurement notices across Zambia."
        actions={
          <div className="flex items-center gap-3">
             <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-zammsa-green transition-colors shadow-sm">
                <PrinterIcon className="w-5 h-5" />
             </button>
             <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-zammsa-green transition-all shadow-sm">
                <DownloadIcon className="w-4 h-4" />
                <span>Export</span>
             </button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-lg">
           <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <input 
             type="text"
             value={search}
             onChange={(e) => { setSearch(e.target.value); setPage(1); }}
             placeholder="Search by title, number or category..."
             className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green outline-none transition-all"
           />
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
            showFilters ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <FilterIcon className="w-4 h-4" />
          <span>Filters</span>
        </button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Procurement Method</label>
              <select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} className="w-full bg-slate-50 border border-slate-100 rounded-lg text-sm font-semibold p-2.5 focus:outline-none focus:ring-2 focus:ring-zammsa-green/20">
                <option value="">All Methods</option>
                <option value="open_bidding">Open Bidding</option>
                <option value="limited_bidding">Limited Bidding</option>
                <option value="direct_bidding">Direct Bidding</option>
                <option value="request_for_quotation">Request for Quotation</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Industry Category</label>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="w-full bg-slate-50 border border-slate-100 rounded-lg text-sm font-semibold p-2.5 focus:outline-none focus:ring-2 focus:ring-zammsa-green/20">
                <option value="">All Categories</option>
                <option value="pharmaceuticals">Pharmaceuticals</option>
                <option value="medical_equipment">Medical Equipment</option>
                <option value="consumables">Consumables</option>
                <option value="services">Services</option>
                <option value="infrastructure">Infrastructure</option>
              </select>
            </div>
            <div className="flex items-end">
               <button 
                 onClick={() => { setMethod(''); setCategory(''); }}
                 className="text-xs font-bold text-rose-600 uppercase tracking-widest hover:underline"
               >
                 Reset All Filters
               </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-24 flex justify-center"><LoadingSpinner /></div>
      ) : !data?.results?.length ? (
        <div className="py-32 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
           <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <SearchIcon className="w-8 h-8 text-slate-200" />
           </div>
           <h3 className="text-lg font-bold text-slate-900 tracking-tight">No Tenders Found</h3>
           <p className="text-slate-500 font-medium mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {data.results.map((tender: any) => (
            <TenderCard key={tender.id} tender={tender} />
          ))}
        </div>
      )}

      {data && data.count > pageSize && (
        <div className="pt-12">
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(data.count / pageSize)}
            pageSize={pageSize}
            totalItems={data.count}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </div>
      )}
    </div>
  );
};

export default TendersList;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { SearchIcon, ClipboardListIcon, CalendarIcon, ArrowRightIcon } from '@heroicons/react/outline';

const GPNListPublic: React.FC = () => {
  const [departmentFilter, setDepartmentFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public-gpns', departmentFilter],
    queryFn: () => publicApi.listGPNs({}),
  });

  const gpns = data?.results || [];
  const filtered = departmentFilter
    ? gpns.filter((g: any) => g.department.toLowerCase().includes(departmentFilter.toLowerCase()))
    : gpns;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <PageHeader 
        title="General Procurement Notices"
        description="Public summary of agency-wide procurement intentions for the current fiscal year."
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
           <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <input 
             type="text"
             value={departmentFilter}
             onChange={(e) => setDepartmentFilter(e.target.value)}
             placeholder="Filter by department..."
             className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zammsa-green/10 focus:border-zammsa-green outline-none transition-all"
           />
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 flex justify-center"><LoadingSpinner /></div>
      ) : filtered.length === 0 ? (
        <div className="py-32 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
           <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ClipboardListIcon className="w-8 h-8 text-slate-200" />
           </div>
           <h3 className="text-lg font-bold text-slate-900 tracking-tight">No GPNs Found</h3>
           <p className="text-slate-500 font-medium mt-1">There are no published procurement notices at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((gpn: any) => (
            <Link
              key={gpn.gpn_id}
              to={`/gpns/${gpn.gpn_id}`}
              className="group block bg-white rounded-2xl border border-slate-200 p-6 hover:border-zammsa-green/30 transition-all shadow-sm flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider rounded-full">Published</span>
                   <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">
                      <CalendarIcon className="w-3.5 h-3.5" /> FY {gpn.fiscal_year}
                   </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{new Date(gpn.published_at).toLocaleDateString('en-GB')}</span>
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight group-hover:text-zammsa-green transition-colors">{gpn.department}</h3>
              <p className="text-sm font-medium text-slate-500 mb-6 flex-1">
                Annual Procurement Plan summary featuring various medical supplies and agency requirements.
              </p>

              <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{gpn.line_items_count} Planned Items</span>
                  <p className="text-sm font-bold text-slate-900">Total: ZMW {Number(gpn.total_estimated_value).toLocaleString()}</p>
                </div>
                <div className="p-2 bg-slate-50 text-zammsa-green rounded-lg group-hover:bg-zammsa-green group-hover:text-white transition-all">
                  <ArrowRightIcon className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default GPNListPublic;

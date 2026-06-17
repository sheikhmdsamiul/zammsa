import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { Event } from '../../types';
import { LocationMarkerIcon, ClockIcon, CalendarIcon, ChevronRightIcon } from '@heroicons/react/outline';

const PAGE_SIZE = 12;

const typeBadges: Record<string, string> = {
  meeting: 'bg-purple-50 text-purple-600',
  workshop: 'bg-blue-50 text-blue-600',
  conference: 'bg-emerald-50 text-emerald-600',
  training: 'bg-amber-50 text-amber-600',
  deadline: 'bg-rose-50 text-rose-600',
  other: 'bg-slate-50 text-slate-600',
};

const EventsList: React.FC = () => {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const params: Record<string, any> = { page, page_size: pageSize };
  if (tab === 'upcoming') params.upcoming = true;

  const { data, isLoading } = useQuery({
    queryKey: ['public-events', params],
    queryFn: () => publicApi.listEvents(params),
  });

  const addToCalendar = (event: Event) => {
    const text = encodeURIComponent(event.title);
    const dates = `${event.start_date.replace(/-/g, '')}/${event.end_date.replace(/-/g, '')}`;
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <PageHeader 
        title="Agency Events"
        description="Stay updated with procurement workshops, vendor briefings, and official agency meetings."
      />

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t} Events
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-24 flex justify-center"><LoadingSpinner /></div>
      ) : !data?.results?.length ? (
        <div className="py-32 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
           <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CalendarIcon className="w-8 h-8 text-slate-200" />
           </div>
           <h3 className="text-lg font-bold text-slate-900 tracking-tight">No Events Found</h3>
           <p className="text-slate-500 font-medium mt-1">There are no {tab} events scheduled at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {data.results.map((event: Event) => {
            const startDate = new Date(event.start_date);
            return (
              <div key={event.id} className="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-zammsa-green/30 transition-all flex flex-col shadow-sm">
                <div className={`p-8 pb-4 flex items-center justify-between`}>
                   <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center ${tab === 'upcoming' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                         <span className="text-sm font-bold leading-none">{startDate.getDate()}</span>
                         <span className="text-[9px] font-bold uppercase tracking-tighter mt-1">{startDate.toLocaleString('default', { month: 'short' })}</span>
                      </div>
                      <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{startDate.getFullYear()}</p>
                         <p className="text-xs font-bold text-slate-900">{startDate.toLocaleDateString('en-GB', { weekday: 'long' })}</p>
                      </div>
                   </div>
                   <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg ${typeBadges[event.type] || 'bg-slate-50 text-slate-600'}`}>
                      {event.type}
                   </span>
                </div>

                <div className="p-8 pt-4 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-zammsa-green transition-colors leading-snug">{event.title}</h3>
                  <p className="text-sm font-medium text-slate-500 mb-6 line-clamp-2">{event.description}</p>
                  
                  <div className="space-y-3 mt-auto pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-3 text-slate-400">
                      <LocationMarkerIcon className="w-4 h-4 text-zammsa-green" />
                      <span className="text-xs font-semibold">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <ClockIcon className="w-4 h-4 text-zammsa-green" />
                      <span className="text-xs font-semibold">
                         {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => addToCalendar(event)}
                    className="mt-8 w-full py-3 bg-slate-50 text-zammsa-green text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-zammsa-green hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    Add to Calendar <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
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

export default EventsList;

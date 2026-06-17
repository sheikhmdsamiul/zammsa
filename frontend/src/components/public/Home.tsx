import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { useCountdown } from '../../hooks/useCountdown';
import { TenderPublic, NewsArticle, Notice, Event } from '../../types';
import {
  ClipboardListIcon, SpeakerphoneIcon, OfficeBuildingIcon,
  DocumentTextIcon, CashIcon, BookmarkIcon, ArrowRightIcon
} from '@heroicons/react/outline';

const StatCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all">
    <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-zammsa-green">
      {React.isValidElement(icon) 
        ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { 
            className: 'w-5 h-5' 
          }) 
        : icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-900 tracking-tight">{value || '--'}</p>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  </div>
);

const TenderCard: React.FC<{ tender: TenderPublic }> = ({ tender }) => {
  const countdown = useCountdown(tender.closing_date);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-zammsa-green/30 transition-all flex flex-col group">
      <div className="flex items-start justify-between mb-4">
        <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${
          tender.type === 'rfb' ? 'bg-blue-50 text-blue-600' :
          tender.type === 'rfp' ? 'bg-purple-50 text-purple-600' :
          tender.type === 'rfq' ? 'bg-emerald-50 text-emerald-600' :
          'bg-slate-50 text-slate-600'
        }`}>
          {tender.type?.toUpperCase()}
        </span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{tender.tender_number}</span>
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-2 line-clamp-2 leading-snug group-hover:text-zammsa-green transition-colors">{tender.title}</h3>
      <p className="text-xs font-medium text-slate-500 mb-6 flex-1">{tender.procurement_method}</p>
      
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Closing In</span>
          <span className={`text-xs font-bold ${countdown.expired ? 'text-rose-600' : 'text-amber-600'}`}>
            {countdown.expired ? 'Closed' : `${countdown.days}d ${countdown.hours}h`}
          </span>
        </div>
        <Link
          to={`/tenders/${tender.id}`}
          className="p-2 bg-slate-50 text-zammsa-green rounded-lg hover:bg-zammsa-green hover:text-white transition-all"
        >
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const { data: stats } = useQuery({ queryKey: ['public-stats'], queryFn: () => publicApi.getStats() });
  const { data: tendersData } = useQuery({ queryKey: ['public-tenders'], queryFn: () => publicApi.listTenders({ limit: 6 }) });
  const { data: newsData } = useQuery({ queryKey: ['public-news'], queryFn: () => publicApi.listNews({ limit: 3 }) });
  const { data: noticesData } = useQuery({ queryKey: ['public-notices'], queryFn: () => publicApi.listNotices({ limit: 3, is_pinned: true }) });
  const { data: eventsData } = useQuery({ queryKey: ['public-events'], queryFn: () => publicApi.listEvents({ limit: 4, upcoming: true }) });

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="bg-slate-900 relative overflow-hidden py-24 lg:py-32">
        <div className="absolute inset-0 opacity-20">
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-zammsa-green rounded-full blur-[120px] -mr-64 -mt-64" />
           <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-zammsa-orange rounded-full blur-[100px] -ml-48 -mb-48 opacity-30" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zammsa-green/10 border border-zammsa-green/20 rounded-full mb-8">
               <div className="w-1.5 h-1.5 rounded-full bg-zammsa-green animate-pulse" />
               <span className="text-[10px] font-bold text-zammsa-green uppercase tracking-widest">Official Procurement Portal</span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-8">
              Transforming Healthcare Through <span className="text-zammsa-green">Transparent Procurement.</span>
            </h1>
            <p className="text-lg text-slate-400 font-medium leading-relaxed mb-10 max-w-2xl">
              ZAMMSA connects healthcare suppliers with life-saving opportunities. Access tenders, news, and resources through our modernized e-procurement ecosystem.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/tenders"
                className="px-8 py-4 bg-zammsa-green text-white text-sm font-bold rounded-xl uppercase tracking-widest shadow-lg shadow-zammsa-green/20 hover:bg-zammsa-green-dark transition-all text-center"
              >
                Explore Tenders
              </Link>
              <Link
                to="/suppliers/register"
                className="px-8 py-4 bg-white/5 border border-white/10 text-white text-sm font-bold rounded-xl uppercase tracking-widest hover:bg-white/10 transition-all text-center"
              >
                Supplier Registration
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Live Tenders" value={stats?.active_tenders || 0} icon={<SpeakerphoneIcon />} />
          <StatCard label="Registered Vendors" value={stats?.registered_suppliers || 0} icon={<OfficeBuildingIcon />} />
          <StatCard label="Total Awarded" value={stats?.contracts_awarded || 0} icon={<DocumentTextIcon />} />
          <StatCard label="Volume (ZMW)" value={Number(stats?.total_value || 0).toLocaleString()} icon={<CashIcon />} />
        </div>
      </section>

      {/* Main Content Areas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-32">
        
        {/* Tenders Section */}
        <section>
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Latest Tenders</h2>
              <p className="text-slate-500 font-medium">Browse active procurement opportunities across all categories.</p>
            </div>
            <Link to="/tenders" className="hidden sm:flex items-center gap-2 text-xs font-bold text-zammsa-green uppercase tracking-widest hover:text-zammsa-green-dark transition-colors">
              View All Tenders <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tendersData?.results?.length ? (
              tendersData.results.slice(0, 6).map((t) => <TenderCard key={t.id} tender={t} />)
            ) : (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-semibold uppercase tracking-widest text-xs">No active tenders found</p>
              </div>
            )}
          </div>
        </section>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* News */}
          <div className="space-y-8">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center justify-between">
              Agency News
              <Link to="/news" className="text-[10px] font-bold text-zammsa-green uppercase tracking-widest">All News</Link>
            </h3>
            <div className="space-y-6">
              {newsData?.results?.slice(0, 3).map((article: NewsArticle) => (
                <Link key={article.id} to={`/news/${article.id}`} className="group block">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{new Date(article.published_at).toLocaleDateString('en-GB')}</p>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-zammsa-green transition-colors line-clamp-2">{article.title}</h4>
                </Link>
              ))}
            </div>
          </div>

          {/* Notices */}
          <div className="space-y-8">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center justify-between">
              Public Notices
              <Link to="/notices" className="text-[10px] font-bold text-zammsa-green uppercase tracking-widest">View All</Link>
            </h3>
            <div className="space-y-6">
              {noticesData?.results?.slice(0, 3).map((notice: Notice) => (
                <Link key={notice.id} to={`/notices/${notice.id}`} className="group block p-4 bg-white border border-slate-100 rounded-xl hover:border-zammsa-green/20 transition-all shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-50 text-amber-600">
                      {notice.type}
                    </span>
                    {notice.is_pinned && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-500 uppercase tracking-widest"><BookmarkIcon className="h-3 w-3" /> Pinned</span>}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-zammsa-green transition-colors">{notice.title}</h4>
                </Link>
              ))}
            </div>
          </div>

          {/* Events */}
          <div className="space-y-8">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center justify-between">
              Upcoming Events
              <Link to="/events" className="text-[10px] font-bold text-zammsa-green uppercase tracking-widest">Calendar</Link>
            </h3>
            <div className="space-y-6">
              {eventsData?.results?.slice(0, 3).map((event: Event) => (
                <div key={event.id} className="flex gap-4">
                  <div className="shrink-0 w-12 h-12 bg-slate-900 rounded-xl flex flex-col items-center justify-center text-white">
                    <span className="text-sm font-bold leading-none">{new Date(event.start_date).getDate()}</span>
                    <span className="text-[9px] font-bold uppercase tracking-tighter mt-1">{new Date(event.start_date).toLocaleString('default', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{event.title}</h4>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">{event.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <section className="bg-slate-50 border-y border-slate-200 py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-4">Partner with ZAMMSA Today</h2>
          <p className="text-lg text-slate-500 font-medium mb-12">
            Join hundreds of registered suppliers providing critical medical supplies to health facilities across Zambia.
          </p>
          <Link
            to="/suppliers/register"
            className="inline-flex items-center gap-3 px-10 py-5 bg-zammsa-green text-white font-bold rounded-2xl uppercase tracking-widest shadow-xl shadow-zammsa-green/20 hover:bg-zammsa-green-dark transition-all hover:scale-105"
          >
            Start Registration <ArrowRightIcon className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;

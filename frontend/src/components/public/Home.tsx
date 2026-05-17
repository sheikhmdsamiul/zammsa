import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { useCountdown } from '../../hooks/useCountdown';
import { TenderPublic, NewsArticle, Notice, Event } from '../../types';
import {
  ClipboardListIcon, SpeakerphoneIcon, OfficeBuildingIcon,
  DocumentTextIcon, CashIcon, BookmarkIcon,
} from '@heroicons/react/outline';

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
    <div className="w-12 h-12 bg-zammsa-green bg-opacity-10 rounded-lg flex items-center justify-center">
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value?.toLocaleString() || '--'}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  </div>
);

const TenderCard: React.FC<{ tender: TenderPublic }> = ({ tender }) => {
  const countdown = useCountdown(tender.closing_date);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          tender.type === 'rfb' ? 'bg-blue-100 text-blue-700' :
          tender.type === 'rfp' ? 'bg-purple-100 text-purple-700' :
          tender.type === 'rfq' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {tender.type?.toUpperCase()}
        </span>
        <span className="text-xs text-gray-400">{tender.tender_number}</span>
      </div>
      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{tender.title}</h3>
      <p className="text-sm text-gray-500 mb-3">{tender.procurement_method}</p>
      <div className="flex items-center gap-2 mb-4">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          countdown.expired ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {countdown.expired ? 'Closed' : `${countdown.days}d ${countdown.hours}h remaining`}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zammsa-green">
          {tender.currency} {tender.estimated_value?.toLocaleString()}
        </span>
        <Link
          to={`/tenders/${tender.id}`}
          className="px-3 py-1.5 text-sm text-zammsa-green border border-zammsa-green rounded-lg hover:bg-green-50 transition-colors"
        >
          View Details
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
    <div>
      <section className="relative bg-gradient-to-br from-zammsa-green via-zammsa-green-dark to-black text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-zammsa-orange rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Transparent & Efficient<br />
              <span className="text-zammsa-orange">Public Procurement</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-200 mb-8 leading-relaxed">
              Zambia Medicines & Medical Supplies Agency - Connecting suppliers with opportunities
              through an open, fair, and competitive procurement process.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/tenders"
                className="px-8 py-3 bg-zammsa-orange text-white font-semibold rounded-lg hover:bg-zammsa-orange-dark transition-colors"
              >
                Browse Tenders
              </Link>
              <Link
                to="/suppliers/register"
                className="px-8 py-3 bg-white text-zammsa-green font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Register as Supplier
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Tenders" value={stats?.total_tenders || 0} icon={<ClipboardListIcon className="h-7 w-7 text-zammsa-green" />} />
          <StatCard label="Active Tenders" value={stats?.active_tenders || 0} icon={<SpeakerphoneIcon className="h-7 w-7 text-zammsa-green" />} />
          <StatCard label="Registered Suppliers" value={stats?.registered_suppliers || 0} icon={<OfficeBuildingIcon className="h-7 w-7 text-zammsa-green" />} />
          <StatCard label="Contracts Awarded" value={stats?.contracts_awarded || 0} icon={<DocumentTextIcon className="h-7 w-7 text-zammsa-green" />} />
          <StatCard label="Total Value (ZMW)" value={stats?.total_value || 0} icon={<CashIcon className="h-7 w-7 text-zammsa-green" />} />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Latest Tenders</h2>
            <p className="text-gray-500 mt-1">Current open procurement opportunities</p>
          </div>
          <Link to="/tenders" className="text-sm text-zammsa-green hover:underline font-medium">
            View All Tenders →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tendersData?.results?.length ? (
            tendersData.results.map((t) => <TenderCard key={t.id} tender={t} />)
          ) : (
            <p className="col-span-full text-center text-gray-400 py-12">No tenders available at this time.</p>
          )}
        </div>
      </section>

      <section className="bg-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Latest News</h2>
              {newsData?.results?.slice(0, 3).map((article: NewsArticle) => (
                <Link key={article.id} to={`/news/${article.id}`} className="block mb-4 last:mb-0">
                  <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                    <p className="text-xs text-gray-400 mb-1">{new Date(article.published_at).toLocaleDateString()}</p>
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{article.title}</h3>
                  </div>
                </Link>
              ))}
              <Link to="/news" className="text-sm text-zammsa-green hover:underline mt-3 inline-block">All News →</Link>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Notices</h2>
              {noticesData?.results?.slice(0, 3).map((notice: Notice) => (
                <Link key={notice.id} to={`/notices/${notice.id}`} className="block mb-4 last:mb-0">
                  <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-zammsa-orange bg-opacity-10 text-zammsa-orange">
                        {notice.type}
                      </span>
                      {notice.is_pinned && <span className="inline-flex items-center gap-1 text-xs text-red-500"><BookmarkIcon className="h-3 w-3" /> Pinned</span>}
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm">{notice.title}</h3>
                  </div>
                </Link>
              ))}
              <Link to="/notices" className="text-sm text-zammsa-green hover:underline mt-3 inline-block">All Notices →</Link>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Upcoming Events</h2>
              {eventsData?.results?.slice(0, 4).map((event: Event) => (
                <div key={event.id} className="flex gap-3 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-zammsa-green rounded-lg flex flex-col items-center justify-center text-white text-xs">
                    <span className="font-bold text-sm">{new Date(event.start_date).getDate()}</span>
                    <span>{new Date(event.start_date).toLocaleString('default', { month: 'short' })}</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">{event.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{event.location}</p>
                  </div>
                </div>
              ))}
              <Link to="/events" className="text-sm text-zammsa-green hover:underline mt-1 inline-block">All Events →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zammsa-green py-16 text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Ready to Do Business with ZAMMSA?</h2>
          <p className="text-lg text-green-100 mb-8">
            Register as a supplier today and gain access to procurement opportunities across Zambia.
          </p>
          <Link
            to="/suppliers/register"
            className="inline-block px-8 py-3 bg-zammsa-orange text-white font-semibold rounded-lg hover:bg-zammsa-orange-dark transition-colors"
          >
            Register Now
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;

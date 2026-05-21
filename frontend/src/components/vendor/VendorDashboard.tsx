import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import {
  DocumentTextIcon, ClipboardListIcon, StarIcon, CashIcon,
  UserCircleIcon, ExternalLinkIcon, BellIcon
} from '@heroicons/react/outline';
import { StatCard } from '../common/StatCard';
import { PageHeader } from '../common/PageHeader';

const VendorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery({ queryKey: ['vendor-dashboard'], queryFn: () => vendorApi.getDashboard() });
  const { data: activities } = useQuery({ queryKey: ['vendor-activities'], queryFn: () => vendorApi.getActivities({ limit: 10 }) });
  const { data: deadlines } = useQuery({ queryKey: ['vendor-deadlines'], queryFn: () => vendorApi.getUpcomingDeadlines() });

  const completeness = stats?.profile_completeness ?? 0;

  return (
    <div className="pb-12">
      <PageHeader 
        title="Supplier Dashboard"
        description={`Welcome back, ${user?.full_name?.split(' ')[0] || 'Partner'}. Tracking your business at ZAMMSA.`}
        actions={
          <button className="flex items-center gap-2 px-4 py-2 bg-zammsa-green text-white rounded-xl shadow-lg shadow-zammsa-green/20 text-xs font-bold uppercase tracking-widest hover:bg-zammsa-green-dark transition-all">
            <ExternalLinkIcon className="w-4 h-4" />
            <span>Open Tenders</span>
          </button>
        }
      />

      {/* Profile Completeness Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-8 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-zammsa-green/10 rounded-2xl flex items-center justify-center">
                <UserCircleIcon className="w-10 h-10 text-zammsa-green" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Profile Status</h3>
                <p className="text-sm font-medium text-gray-500">Ensure your company details are up to date for compliance.</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-3xl font-black text-zammsa-green tracking-tighter">{completeness}%</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Completeness</span>
            </div>
          </div>
          
          <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-6">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-zammsa-green to-zammsa-green-light rounded-full transition-all duration-1000 ease-out shadow-sm"
              style={{ width: `${completeness}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {['Account', 'Company', 'Contact', 'Bank', 'Documents'].map((step, i) => {
              const isDone = completeness >= (i + 1) * 20;
              return (
                <div key={step} className={`flex flex-col items-center gap-2 ${isDone ? 'text-zammsa-green' : 'text-gray-300'}`}>
                  <div className={`w-2 h-2 rounded-full ${isDone ? 'bg-zammsa-green animate-pulse' : 'bg-gray-200'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-zammsa-green opacity-[0.02] -mr-32 -mt-32 rounded-full pointer-events-none group-hover:scale-110 transition-transform duration-700" />
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard label="Total Bids" value={stats?.total_bids ?? '--'} icon={<DocumentTextIcon className="w-6 h-6" />} color="blue" description="Cumulative submissions" />
          <StatCard label="Active Bids" value={stats?.active_bids ?? '--'} icon={<ClipboardListIcon className="w-6 h-6" />} color="orange" description="Currently evaluating" />
          <StatCard label="Contracts" value={stats?.awarded_contracts ?? '--'} icon={<StarIcon className="w-6 h-6" />} color="green" description="Successfully awarded" />
          <StatCard label="Invoices" value={stats?.pending_invoices ?? '--'} icon={<CashIcon className="w-6 h-6" />} color="purple" description="Pending processing" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Upcoming Deadlines</h2>
            <Link to="/vendor/open-tenders" className="text-[10px] font-black text-zammsa-green uppercase tracking-widest hover:underline flex items-center gap-1">
               <span>All Tenders</span>
               <ExternalLinkIcon className="w-3 h-3" />
            </Link>
          </div>
          {!deadlines?.length ? (
            <div className="text-center py-12 text-gray-400 italic">No upcoming deadlines</div>
          ) : (
            <div className="space-y-4">
              {deadlines.slice(0, 5).map((d: any) => {
                const daysLeft = Math.ceil((new Date(d.closing_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={d.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-50 hover:border-zammsa-green/20 hover:bg-zammsa-green/5 transition-all group">
                    <div>
                      <p className="text-sm font-bold text-gray-800 group-hover:text-zammsa-green transition-colors">{d.title}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Closing: {new Date(d.closing_date).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${
                      daysLeft <= 3 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {daysLeft <= 0 ? 'Overdue' : `${daysLeft}d left`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Activity Feed</h2>
            <BellIcon className="w-5 h-5 text-gray-200" />
          </div>
          {!activities?.results?.length ? (
            <div className="text-center py-12 text-gray-400 italic">No recent activity</div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-100 before:to-transparent">
              {activities.results.slice(0, 6).map((a: any) => (
                <div key={a.id} className="relative flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-xs font-black text-zammsa-green z-10 group-hover:border-zammsa-green transition-colors">
                    <DocumentTextIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 leading-snug">{a.description}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{new Date(a.created_at).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;

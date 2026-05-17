import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import {
  DocumentTextIcon, ClipboardListIcon, StarIcon, CashIcon,
} from '@heroicons/react/outline';

const StatCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; color: string; link: string }> = ({ label, value, icon, color, link }) => (
  <Link to={link} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-2">
      <span className="text-zammsa-green">{icon}</span>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${color}`}>{label}</span>
    </div>
    <p className="text-3xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    <p className="text-sm text-gray-500 mt-1">{label}</p>
  </Link>
);

const VendorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery({ queryKey: ['vendor-dashboard'], queryFn: () => vendorApi.getDashboard() });
  const { data: activities } = useQuery({ queryKey: ['vendor-activities'], queryFn: () => vendorApi.getActivities({ limit: 10 }) });
  const { data: deadlines } = useQuery({ queryKey: ['vendor-deadlines'], queryFn: () => vendorApi.getUpcomingDeadlines() });

  const completeness = stats?.profile_completeness ?? 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-zammsa-green to-zammsa-green-dark rounded-xl p-8 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {user?.full_name?.split(' ')[0] || 'Vendor'}</h1>
        <p className="text-green-100">Track your bids, contracts, and procurement activities.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-medium text-gray-700">Profile Completeness</span>
            <span className="ml-2 text-sm text-gray-400">{completeness}%</span>
          </div>
          <Link to="/vendor/profile" className="text-sm text-zammsa-green hover:underline">Complete Profile →</Link>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-zammsa-green h-2.5 rounded-full transition-all" style={{ width: `${completeness}%` }} />
        </div>
        <div className="grid grid-cols-5 gap-2 mt-3 text-xs text-gray-400">
          {['Account', 'Company', 'Contact', 'Bank', 'Documents'].map((step, i) => (
            <div key={step} className={`text-center ${completeness >= (i + 1) * 20 ? 'text-zammsa-green font-medium' : ''}`}>
              {step}
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Bids" value={stats?.total_bids ?? '--'} icon={<DocumentTextIcon className="h-6 w-6" />} color="bg-blue-50 text-blue-600" link="/vendor/bids" />
          <StatCard label="Active Bids" value={stats?.active_bids ?? '--'} icon={<ClipboardListIcon className="h-6 w-6" />} color="bg-green-50 text-green-600" link="/vendor/bids" />
          <StatCard label="Awarded Contracts" value={stats?.awarded_contracts ?? '--'} icon={<StarIcon className="h-6 w-6" />} color="bg-purple-50 text-purple-600" link="/vendor/contracts" />
          <StatCard label="Pending Invoices" value={stats?.pending_invoices ?? '--'} icon={<CashIcon className="h-6 w-6" />} color="bg-orange-50 text-orange-600" link="/vendor/invoices" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h2>
            <Link to="/vendor/open-tenders" className="text-sm text-zammsa-green hover:underline">View All</Link>
          </div>
          {!deadlines?.length ? (
            <p className="text-sm text-gray-400 py-4 text-center">No upcoming deadlines</p>
          ) : (
            <div className="space-y-3">
              {deadlines.slice(0, 5).map((d: any) => {
                const daysLeft = Math.ceil((new Date(d.closing_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.title}</p>
                      <p className="text-xs text-gray-400">{new Date(d.closing_date).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${daysLeft <= 3 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                      {daysLeft <= 0 ? 'Overdue' : `${daysLeft}d left`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          {!activities?.results?.length ? (
            <p className="text-sm text-gray-400 py-4 text-center">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {activities.results.slice(0, 8).map((a: any) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-zammsa-green rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-700">{a.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleDateString()}</p>
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

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import {
  DocumentTextIcon, ClipboardListIcon, CashIcon,
  CheckCircleIcon, ExclamationIcon, ClockIcon,
} from '@heroicons/react/outline';

const STATUS_COLORS: Record<string, string> = {
  submitted: 'text-amber-600 bg-amber-50',
  opened: 'text-blue-600 bg-blue-50',
  responsive: 'text-emerald-600 bg-emerald-50',
  awarded: 'text-emerald-600 bg-emerald-50',
  draft: 'text-gray-600 bg-gray-50',
};

const VendorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({ queryKey: ['vendor-dashboard'], queryFn: () => vendorApi.getDashboard() });
  const { data: bidsData } = useQuery({ queryKey: ['vendor-bids'], queryFn: () => vendorApi.bids.list({ page_size: 5, ordering: '-submitted_at' }) });
  const { data: activities } = useQuery({ queryKey: ['vendor-activities'], queryFn: () => vendorApi.getActivities({ limit: 10 }) });

  const bids = bidsData?.results ?? [];
  const activityList = Array.isArray(activities) ? activities : (activities as any)?.results ?? [];

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard — {user?.full_name || 'Supplier'}</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
            </span>
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            Status: ✅ Active
          </p>
        </div>
        <button
          onClick={() => navigate('/vendor/open-tenders')}
          className="flex items-center gap-2 px-5 py-2.5 bg-zammsa-green text-white rounded-xl shadow-lg shadow-zammsa-green/20 text-xs font-bold uppercase tracking-widest hover:bg-zammsa-green-dark transition-all"
        >
          <ClipboardListIcon className="w-4 h-4" />
          Browse Open Tenders
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Open Tenders</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">{stats?.open_tenders ?? 0}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Open
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Bids</p>
              <p className="text-3xl font-black text-amber-500 mt-1">{stats?.active_bids ?? 0}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {stats?.active_bids ?? 0} Active
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Contracts</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">{stats?.awarded_contracts ?? 0}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {stats?.awarded_contracts ?? 0} Active
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Invoices Pending</p>
              <p className="text-3xl font-black text-amber-500 mt-1">{stats?.pending_invoices ?? 0}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {stats?.pending_invoices ?? 0} Pending
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* My Bids */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">My Bids</h2>
                <button onClick={() => navigate('/vendor/bids')} className="text-xs font-bold text-zammsa-green hover:underline">View All</button>
              </div>
              {bids.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No bids submitted yet</p>
              ) : (
                <div className="space-y-3">
                  {bids.map((bid: any) => (
                    <div key={bid.id || bid.bid_id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-gray-900">{bid.solicitation_title || bid.solicitation?.title || 'N/A'}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_COLORS[bid.status] || 'text-gray-600 bg-gray-100'}`}>
                          {bid.status}
                        </span>
                      </div>
                      {bid.bid_price && <p className="text-xs text-gray-500">K{Number(bid.bid_price).toLocaleString()}</p>}
                      <p className="text-xs text-gray-400 mt-1">ID: {bid.submission_id || bid.id}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Recent Activity</h2>
              {activityList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {activityList.slice(0, 5).map((act: any, i: number) => (
                    <div key={act.id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{act.action || act.description || 'Activity'}</p>
                        {act.timestamp && <p className="text-[10px] text-gray-400">{new Date(act.timestamp).toLocaleDateString()}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Profile Status */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Profile Status</h2>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-500">Profile Completeness</span>
                <span className="text-xs font-bold text-zammsa-green">{stats?.profile_completeness ?? 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-zammsa-green h-2 rounded-full transition-all" style={{ width: `${stats?.profile_completeness ?? 0}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-800">PACRA Registration</p>
                  <p className="text-[10px] text-emerald-600">Active</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-800">ZRA Tax Clearance</p>
                  <p className="text-[10px] text-emerald-600">Valid</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-800">CEEC Certificate</p>
                  <p className="text-[10px] text-emerald-600">Valid</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <ExclamationIcon className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-800">NAPSA Certificate</p>
                  <p className="text-[10px] text-amber-600">Upload required</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VendorDashboard;
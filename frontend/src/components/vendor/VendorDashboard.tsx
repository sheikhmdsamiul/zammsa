import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../common/StatusBadge';
import {
  DocumentTextIcon, ClipboardListIcon, CashIcon,
  BellIcon, CheckCircleIcon, ExclamationIcon,
  ShieldCheckIcon, ClockIcon,
} from '@heroicons/react/outline';

const VendorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bids' | 'invoices' | 'profile'>('dashboard');

  const { data: stats, isLoading } = useQuery({ queryKey: ['vendor-dashboard'], queryFn: () => vendorApi.getDashboard() });
  const { data: activities } = useQuery({ queryKey: ['vendor-activities'], queryFn: () => vendorApi.getActivities({ limit: 10 }) });

  const completeness = stats?.profile_completeness ?? 0;

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
              <p className="text-3xl font-black text-emerald-600 mt-1">8</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />🟢 8 Open
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Bids</p>
              <p className="text-3xl font-black text-amber-500 mt-1">{stats?.active_bids ?? 2}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 {stats?.active_bids ?? 2} Active
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Contracts</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">{stats?.awarded_contracts ?? 1}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />🟢 {stats?.awarded_contracts ?? 1} Active
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Invoices Pending</p>
              <p className="text-3xl font-black text-amber-500 mt-1">{stats?.pending_invoices ?? 3}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 {stats?.pending_invoices ?? 3} Pending
              </span>
            </div>
          </div>

          {/* Action Required */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
            <h2 className="text-sm font-black text-red-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" /> ACTION REQUIRED
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-red-900">CON-2026-LAB-11</p>
                  <p className="text-xs text-red-700">Contract ready for your signature</p>
                </div>
                <button onClick={() => navigate('/vendor/contracts')} className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700">Sign Now</button>
              </div>
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-amber-900">CON-2026-LAB-11</p>
                  <p className="text-xs text-amber-700">Performance security required</p>
                </div>
                <button className="px-4 py-1.5 text-xs font-bold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100">Upload</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* My Active Bids */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">My Active Bids</h2>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-gray-900">SOL-2026-LAB-07</p>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">⏳ Under Eval.</span>
                  </div>
                  <p className="text-xs text-gray-500">K1,155,000 | Submitted: 08 Jun | 🥇 Lowest eval. price</p>
                  <p className="text-xs text-gray-400 mt-1">ID: BID-2026-LAB-07-004</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-gray-900">SOL-2026-PHM-05</p>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">🟢 Open til 25Jun</span>
                  </div>
                  <p className="text-xs text-gray-500">K890,000</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Recent Activity</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">18 Jul — Contract generated</p>
                    <p className="text-[10px] text-gray-400">CON-2026-LAB-11</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">02 Jul — Award notice published</p>
                    <p className="text-[10px] text-gray-400">SOL-2026-LAB-07</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <ClockIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">11 Jun — Bid opening done</p>
                    <p className="text-[10px] text-gray-400">SOL-2026-LAB-07</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-zammsa-green/10 flex items-center justify-center">
                    <CheckCircleIcon className="w-4 h-4 text-zammsa-green" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">08 Jun — Bid submitted ✅</p>
                    <p className="text-[10px] text-gray-400">SOL-2026-PHM-05</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Status */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Profile Status</h2>
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
                  <p className="text-[10px] text-emerald-600">Valid until 31 Dec 2026</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-800">CEEC Certificate</p>
                  <p className="text-[10px] text-emerald-600">Valid until 30 Jun 2027</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <ExclamationIcon className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-800">NAPSA Certificate</p>
                  <p className="text-[10px] text-amber-600">Expires in 45 days — renew soon</p>
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
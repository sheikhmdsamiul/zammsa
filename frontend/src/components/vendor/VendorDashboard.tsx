import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../common/StatusBadge';
import {
  DocumentTextIcon, ClipboardListIcon, StarIcon, CashIcon,
  UserCircleIcon, ExternalLinkIcon, BellIcon, UploadIcon,
} from '@heroicons/react/outline';

const VendorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bids' | 'invoices' | 'profile'>('dashboard');

  const { data: stats, isLoading } = useQuery({ queryKey: ['vendor-dashboard'], queryFn: () => vendorApi.getDashboard() });
  const { data: activities } = useQuery({ queryKey: ['vendor-activities'], queryFn: () => vendorApi.getActivities({ limit: 10 }) });
  const { data: deadlines } = useQuery({ queryKey: ['vendor-deadlines'], queryFn: () => vendorApi.getUpcomingDeadlines() });

  const completeness = stats?.profile_completeness ?? 0;

  const [showUploadDoc, setShowUploadDoc] = useState(false);

  return (
    <div className="pb-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {user?.full_name?.split(' ')[0] || 'Partner'}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-zammsa-green text-white rounded-xl shadow-lg shadow-zammsa-green/20 text-xs font-bold uppercase tracking-widest hover:bg-zammsa-green-dark transition-all">
          <ExternalLinkIcon className="w-4 h-4" />
          Open Tenders
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        {(['dashboard', 'bids', 'invoices', 'profile'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-zammsa-green text-zammsa-green' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab === 'profile' ? 'My Profile' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* Stats Cards */}
          {isLoading ? (
            <LoadingSpinner size="lg" className="py-12" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Bids</p>
                <p className="text-3xl font-black text-emerald-600 mt-1">{stats?.active_bids ?? '--'}</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">🟢 {stats?.active_bids ?? 0} Active</span>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Bids</p>
                <p className="text-3xl font-black text-blue-600 mt-1">{stats?.total_bids ?? '--'}</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-2">📊 Cumulative</span>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Awarded</p>
                <p className="text-3xl font-black text-green-600 mt-1">{stats?.awarded_contracts ?? '--'}</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-2">🏆 Won</span>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Invoices</p>
                <p className="text-3xl font-black text-amber-600 mt-1">{stats?.pending_invoices ?? '--'}</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">💳 Pending</span>
              </div>
            </div>
          )}

          {/* Action Required Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-bold text-amber-900">🔔 Action Required</p>
            <p className="text-xs text-amber-700 mt-1">You have 2 bids closing in 7 days. Ensure your submissions are complete.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Active Bids */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">My Active Bids</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-50 text-sm">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-black text-gray-400 uppercase">Solicitation</th>
                      <th className="px-3 py-2 text-center text-[10px] font-black text-gray-400 uppercase">Status</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black text-gray-400 uppercase">Closing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-bold text-gray-800">SOL-2026-LAB-07</td>
                      <td className="px-3 py-2 text-center"><StatusBadge status="submitted" /></td>
                      <td className="px-3 py-2 text-right text-sm">01 Aug 2026</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-bold text-gray-800">SOL-2026-PHM-03</td>
                      <td className="px-3 py-2 text-center"><StatusBadge status="draft" /></td>
                      <td className="px-3 py-2 text-right text-sm">20 May 2026</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Recent Activity</h2>
              {!activities?.results?.length ? (
                <p className="text-center py-8 text-gray-400 italic text-sm">No recent activity</p>
              ) : (
                <div className="space-y-4">
                  {activities.results.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zammsa-green/10 flex items-center justify-center">
                        <DocumentTextIcon className="w-4 h-4 text-zammsa-green" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">{a.description}</p>
                        <p className="text-[10px] font-bold text-gray-400">{new Date(a.created_at).toLocaleDateString('en-GB')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Profile Status Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">My Profile Status</h2>
              <span className="text-lg font-black text-zammsa-green">{completeness}%</span>
            </div>
            <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div className="absolute inset-y-0 left-0 bg-zammsa-green rounded-full" style={{ width: `${completeness}%` }} />
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {['Account', 'Company', 'Contact', 'Bank', 'Docs'].map((step, i) => {
                const done = completeness >= (i + 1) * 20;
                return (
                  <div key={step} className={`text-[10px] font-bold uppercase ${done ? 'text-zammsa-green' : 'text-gray-300'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full mx-auto mb-1 ${done ? 'bg-zammsa-green' : 'bg-gray-200'}`} />
                    {step}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {activeTab === 'bids' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">My Bids</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Solicitation</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Title</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase">Submitted</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase">Award Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { sol: 'SOL-2026-LAB-07', title: 'Lab Reagents Q3', status: 'submitted', submitted: '15 Jul 2026', award: 'Pending' },
                  { sol: 'SOL-2026-ADM-02', title: 'Office Supplies', status: 'evaluation', submitted: '10 Jun 2026', award: 'Shortlisted' },
                  { sol: 'SOL-2026-PHM-03', title: 'Pharmaceuticals', status: 'draft', submitted: '—', award: '—' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-bold text-gray-800">{row.sol}</td>
                    <td className="px-4 py-3 text-sm">{row.title}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={row.status as any} /></td>
                    <td className="px-4 py-3 text-center text-sm">{row.submitted}</td>
                    <td className="px-4 py-3 text-center text-sm">{row.award}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">GRN Available for Invoicing</h2>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-bold text-green-900">✅ GRN-GRN-2026-08-001</p>
              <p className="text-xs text-green-700 mt-1">CON-2026-LAB-11 — Lab Reagents Q3 — K288,750</p>
              <button className="mt-2 px-4 py-1.5 bg-zammsa-green text-white text-xs font-bold rounded-lg">Create Invoice</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">All Invoices</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Invoice #</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Contract</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase">Amount (K)</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase">Submitted</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { inv: 'INV-001', contract: 'CON-2026-ADM-04', amount: '42,500', sub: '20 Jun 2026', status: 'paid' },
                    { inv: 'INV-002', contract: 'CON-2026-LAB-11', amount: '288,750', sub: '—', status: 'draft' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-bold text-gray-800">{row.inv}</td>
                      <td className="px-4 py-3 text-sm">{row.contract}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{row.amount}</td>
                      <td className="px-4 py-3 text-center text-sm">{row.sub}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={row.status as any} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Payment Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                ['Total Invoiced', 'K331,250', 'text-blue-600'],
                ['Paid', 'K42,500', 'text-emerald-600'],
                ['Outstanding', 'K288,750', 'text-amber-600'],
                ['Overdue', 'K0', 'text-green-600'],
              ].map(([l, v, c]) => (
                <div key={l} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{l}</p>
                  <p className={`text-lg font-black ${c} mt-1`}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Company Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {[
                ['Company Name', 'Zammsa Supplies Ltd'],
                ['Registration #', 'ZRA-12345-ABC'],
                ['Address', 'Plot 123, Lusaka, Zambia'],
                ['Phone', '+260 97X XXX XXX'],
                ['Email', 'supplier@zammsasupplies.zm'],
                ['Tax Clearance', 'Valid until 31 Dec 2026'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">{l}</span>
                  <span className="font-bold text-gray-900">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Documents</h2>
              <button
                onClick={() => setShowUploadDoc(!showUploadDoc)}
                className="flex items-center gap-1 px-3 py-1.5 bg-zammsa-green text-white text-xs font-bold rounded-lg"
              >
                <UploadIcon className="w-3 h-3" /> Upload
              </button>
            </div>
            {showUploadDoc && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-blue-900 mb-2">Upload New Document</p>
                <div className="flex gap-2">
                  <input type="file" className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 flex-1" />
                  <button className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg">Upload</button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Document</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase">Uploaded</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase">Expiry</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { doc: 'Business Registration Cert', uploaded: '01 Jan 2026', expiry: '31 Dec 2026', status: 'valid' },
                    { doc: 'Tax Clearance', uploaded: '15 Feb 2026', expiry: '31 Dec 2026', status: 'valid' },
                    { doc: 'PSIRA (Expired)', uploaded: '01 Mar 2022', expiry: '28 Feb 2023', status: 'expired' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-bold text-gray-800">{row.doc}</td>
                      <td className="px-4 py-3 text-center text-sm">{row.uploaded}</td>
                      <td className="px-4 py-3 text-center text-sm">{row.expiry}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={row.status as any} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDashboard;

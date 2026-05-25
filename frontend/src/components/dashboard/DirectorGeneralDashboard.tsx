import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { fetchDGDashboard } from '../../api/dashboards';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ExportButton } from '../common/ExportButton';
import { StatusBadge } from '../common/StatusBadge';
import { useAppSelector } from '../../hooks/useRedux';
import {
  ShieldCheckIcon, DocumentTextIcon, CashIcon, ScaleIcon,
  CheckCircleIcon, ClockIcon, CalendarIcon, ChevronRightIcon,
} from '@heroicons/react/outline';

const PIE_COLORS = ['#008542', '#EF7E1A', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];

const DirectorGeneralDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const navigate = useNavigate();
  const [pollInterval] = useState(30000);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'signing'>('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['dgDashboard'],
    queryFn: fetchDGDashboard,
    refetchInterval: pollInterval,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Director General Dashboard</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase tracking-wider border border-amber-200">
              <ShieldCheckIcon className="w-3 h-3" /> MFA Active
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Dr. C. Mwanza — {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton data={data?.procurement_by_method || data?.procurement_by_department || []} filename="executive-summary" />
          <button className="px-4 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
            Export Executive Summary (PDF)
          </button>
          <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full shadow">Auto-refreshing every 30s</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 mb-8">
        {(['dashboard', 'signing'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-zammsa-green text-zammsa-green' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab === 'signing' ? 'Contract Signing' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Awaiting My Sig.</p>
              <p className="text-3xl font-black text-red-500 mt-1">3</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />🔴 3 Pending
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contracts to Sign</p>
              <p className="text-3xl font-black text-red-500 mt-1">1</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />🔴 1 Pending
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Budget Util. YTD</p>
              <p className="text-3xl font-black text-amber-500 mt-1">68%</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 68% Used
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Contracts</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">38</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />🟢 38 Active
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Supplier Perf. Idx</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">78/100</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />🟢 Good
              </span>
            </div>
          </div>

          {/* Requires My Signature / Approval */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
            <h2 className="text-sm font-black text-red-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" /> REQUIRES MY SIGNATURE / APPROVAL
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value K</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { item: 'REQ-2026-LAB-041 — Approve Requisition', value: '1,020,000', action: 'Approve' },
                    { item: 'CON-2026-LAB-11 — Sign Contract', value: '1,155,000', action: 'Sign 🔐' },
                    { item: 'INV-LRL-2026-078 — Approve Payment', value: '1,072,004', action: 'Approve' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-800">{row.item}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{row.value}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setActiveTab('signing')} className="px-3 py-1 text-xs font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg">[{row.action}]</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Budget Overview */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Budget Overview — All Depts</h2>
              <div className="space-y-3">
                {[
                  { label: 'Total Allocated', value: 'K18,400,000' },
                  { label: 'Encumbered', value: 'K3,120,000' },
                  { label: 'Expended', value: 'K9,390,000' },
                  { label: 'Available', value: 'K5,890,000' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-gray-600">{row.label}</span>
                    <span className="text-sm font-bold text-gray-900">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm font-bold text-emerald-800">🟢 32% left (K5,890,000 available)</p>
              </div>
            </div>

            {/* Procurement by Method */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Procurement by Method</h2>
              <div className="space-y-4">
                {[
                  { label: 'Open', value: '74%', bar: 'w-[74%]', color: 'bg-blue-500' },
                  { label: 'Simplified', value: '18%', bar: 'w-[18%]', color: 'bg-amber-500' },
                  { label: 'Direct', value: '4%', bar: 'w-[4%]', color: 'bg-emerald-500' },
                  { label: 'Consulting', value: '4%', bar: 'w-[4%]', color: 'bg-purple-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4">
                    <span className="text-xs font-bold text-gray-600 w-24 shrink-0">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5">
                      <div className={`${item.color} h-5 rounded-full`} style={{ width: item.value }} />
                    </div>
                    <span className="text-xs font-black text-gray-800 w-10 text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Contracts at a Glance */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Active Contracts at a Glance</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Contract</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value K</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { contract: 'CON-2026-LAB-11', supplier: 'LRL', value: '1,155,000', health: '🟢 Active' },
                    { contract: 'CON-2026-IT-09', supplier: 'ABC Tech', value: '342,000', health: '🟡 Expiring 30d' },
                    { contract: 'CON-2026-PHM-06', supplier: 'MedSupply', value: '890,000', health: '🟢 Active' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-800">{row.contract}</td>
                      <td className="px-4 py-3 text-sm">{row.supplier}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{row.value}</td>
                      <td className="px-4 py-3 text-right text-sm">{row.health}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'signing' && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-lg font-bold text-gray-900">Contract Signing — CON-2026-LAB-11</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase">
                <ShieldCheckIcon className="w-3 h-3" /> MFA Verified
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                ['Supplier', 'Lusaka Reagents Ltd'],
                ['Value', 'K 1,155,000.00'],
                ['Duration', '22 Jul 2026 — 30 Sep 2026'],
                ['Solicitation', 'SOL-2026-LAB-07 (Open National Bidding)'],
                ['BER Approved', 'ZPC — 30 Jun 2026'],
                ['Standstill', '✅ Expired — no appeals'],
                ['Supplier Signature', '✅ Lusaka Reagents — 18 Jul 2026 09:34 CAT'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-bold text-gray-900 text-sm">{value}</p>
                </div>
              ))}
            </div>

            <button className="mb-6 px-4 py-2 text-xs font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg flex items-center gap-2">
              <DocumentTextIcon className="w-4 h-4" /> View Full Contract Document
            </button>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-bold text-emerald-900 mb-3">Key Terms Confirmation</h3>
              <div className="space-y-2 text-sm text-emerald-800">
                {[
                  'Payment: 30 days from invoice approval',
                  'Retention: 5% withheld',
                  'LD Rate: 0.5%/week, max 10%',
                  'Perf. Security: 5% required',
                ].map((term) => (
                  <div key={term} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                    {term}
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer mb-6">
              <input type="checkbox" className="mt-0.5 accent-zammsa-green" />
              <div>
                <p className="text-sm font-medium text-gray-900">I have reviewed this contract and approve it on behalf of ZAMMSA</p>
                <p className="text-xs text-gray-500 mt-0.5">as the authorised signatory under the Public Procurement Act.</p>
              </div>
            </label>

            <button className="px-6 py-3 bg-zammsa-green text-white text-sm font-bold rounded-lg flex items-center gap-2 hover:bg-green-700">
              <ShieldCheckIcon className="w-5 h-5" /> Apply Director General Digital Signature 🔐
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectorGeneralDashboard;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchContractManagerDashboard } from '../../api/dashboards';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAppSelector } from '../../hooks/useRedux';
import { StatusBadge } from '../common/StatusBadge';
import {
  DocumentTextIcon, ClockIcon, ExclamationIcon, CheckCircleIcon,
  ScaleIcon, StarIcon, LockClosedIcon,
} from '@heroicons/react/outline';

const ContractManagerDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const navigate = useNavigate();
  const [pollInterval] = useState(30000);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'detail' | 'milestones' | 'perf-eval' | 'closure'>('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['contractManagerDashboard'],
    queryFn: fetchContractManagerDashboard,
    refetchInterval: pollInterval,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contract Manager Dashboard</h1>
          <p className="text-sm text-gray-500">Mr. J. Mutale — {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full shadow">Auto-refreshing every 30s</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['dashboard', 'detail', 'milestones', 'perf-eval', 'closure'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-zammsa-green text-zammsa-green' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab === 'detail' ? 'Contract Detail' : tab === 'perf-eval' ? 'Perf. Eval' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Contracts</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">4</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />🟢 4 Active</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Milestones Overdue</p>
              <p className="text-3xl font-black text-red-500 mt-1">1</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />🔴 1 Overdue</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Expiring &lt;30 days</p>
              <p className="text-3xl font-black text-amber-500 mt-1">2</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 2 Expiring</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">GRNs Pending</p>
              <p className="text-3xl font-black text-amber-500 mt-1">1</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 1 Pending</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Perf Eval Due</p>
              <p className="text-3xl font-black text-amber-500 mt-1">1</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 1 Due</span>
            </div>
          </div>

          {/* Immediate Attention */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-red-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" /> IMMEDIATE ATTENTION REQUIRED
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-bold text-red-900">CON-2026-IT-09</p>
              <p className="text-xs text-red-700 mt-1">Milestone "Delivery" overdue by 3 days</p>
              <div className="flex gap-2 mt-3">
                <button className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50">View Contract</button>
                <button className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50">Calculate LDs</button>
                <button className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50">Contact Supplier</button>
              </div>
            </div>
          </div>

          {/* My Active Contracts */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">My Active Contracts</h2>
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
                    { contract: 'CON-2026-LAB-11', supplier: 'Lusaka Reagents', value: '1,155,000', health: '🟢 Active' },
                    { contract: 'CON-2026-IT-09', supplier: 'ABC Tech Ltd', value: '342,000', health: '🔴 Overdue' },
                    { contract: 'CON-2026-PHM-06', supplier: 'MedSupply Zambia', value: '890,000', health: '🟡 Expiring' },
                    { contract: 'CON-2026-ADM-04', supplier: 'Office Plus', value: '85,000', health: '🟢 Active' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setActiveTab('detail')}>
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

          {/* Milestones Due This Week */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Milestones Due This Week</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Contract</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Milestone</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { contract: 'CON-2026-LAB-11', ms: 'Delivery All Items', due: '01 Aug ⏳ 14d left' },
                    { contract: 'CON-2026-PHM-06', ms: 'Inspection & Accept', due: '20 May 🟡 3d left' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-800">{row.contract}</td>
                      <td className="px-4 py-3 text-sm">{row.ms}</td>
                      <td className="px-4 py-3 text-right text-sm">{row.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'detail' && (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900">Contract Detail — CON-2026-LAB-11</h2>
                <StatusBadge status="active" />
              </div>
              <p className="text-sm font-bold text-gray-800">Lusaka Reagents Ltd | K1,155,000</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contract Overview</h3>
                {[
                  ['Start', '22 Jul 2026'],
                  ['End', '30 Sep 2026'],
                  ['Signed', 'Both parties ✅'],
                  ['Perf. Security', '✅ K57,750'],
                  ['Source', 'SOL-2026-LAB-07'],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1 text-sm"><span className="text-gray-500">{l}</span><span className="font-bold text-gray-900">{v}</span></div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Financial Tracker</h3>
                {[
                  ['Contract Value', 'K1,155,000'],
                  ['Amendments', 'K0 (0%)'],
                  ['25% Cap', 'K288,750'],
                  ['Paid to Date', 'K0'],
                  ['Retention', '5%'],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1 text-sm"><span className="text-gray-500">{l}</span><span className="font-bold text-gray-900">{v}</span></div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Milestone Tracker</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr><th className="px-4 py-2 text-left font-medium text-gray-500">Milestone</th><th className="px-4 py-2 text-center font-medium text-gray-500">Planned</th><th className="px-4 py-2 text-center font-medium text-gray-500">Actual</th><th className="px-4 py-2 text-center font-medium text-gray-500">Variance</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ['Contract Signed', '18 Jul 26', '18 Jul 26', '✅ 0d'],
                      ['Performance Security', '22 Jul 26', '22 Jul 26', '✅ 0d'],
                      ['Delivery — All Items', '01 Aug 26', '—', '⏳'],
                      ['Final Inspection', '05 Aug 26', '—', '⏳'],
                      ['Final Invoice', '10 Aug 26', '—', '⏳'],
                      ['Final Payment', '09 Sep 26', '—', '⏳'],
                    ].map(([ms, planned, actual, varian]) => (
                      <tr key={ms} className="hover:bg-gray-50"><td className="px-4 py-2 font-medium">{ms}</td><td className="px-4 py-2 text-center">{planned}</td><td className="px-4 py-2 text-center font-bold">{actual}</td><td className="px-4 py-2 text-center">{varian}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Deliverables Status</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr><th className="px-4 py-2 text-left font-medium text-gray-500">Item</th><th className="px-4 py-2 text-center font-medium text-gray-500">Ordered</th><th className="px-4 py-2 text-center font-medium text-gray-500">Received</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="px-4 py-2">HIV Rapid Test Kits</td><td className="px-4 py-2 text-center">500</td><td className="px-4 py-2 text-center">⏳ 0</td></tr>
                    <tr><td className="px-4 py-2">CD4 Reagents</td><td className="px-4 py-2 text-center">100</td><td className="px-4 py-2 text-center">⏳ 0</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="px-4 py-2 bg-zammsa-green text-white text-xs font-bold rounded-lg">Request Amendment</button>
              <button className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg">Log LDs</button>
              <button className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg" onClick={() => setActiveTab('perf-eval')}>Evaluate Supplier</button>
              <button className="px-4 py-2 bg-gray-600 text-white text-xs font-bold rounded-lg" onClick={() => setActiveTab('closure')}>Initiate Close</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'milestones' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex gap-2 mb-4">
            <select className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 font-medium text-gray-600">
              <option>All Contracts</option>
              <option>CON-2026-LAB-11</option>
              <option>CON-2026-IT-09</option>
            </select>
            <select className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 font-medium text-gray-600">
              <option>Overdue</option>
              <option>Due This Month</option>
            </select>
          </div>

          <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3">🔴 Overdue</h3>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr><th className="px-4 py-2 text-left font-medium text-gray-500">Contract</th><th className="px-4 py-2 text-left font-medium text-gray-500">Milestone</th><th className="px-4 py-2 text-center font-medium text-gray-500">Planned</th><th className="px-4 py-2 text-center font-medium text-gray-500">Overdue By</th><th className="px-4 py-2 text-center font-medium text-gray-500">LDs</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-red-50"><td className="px-4 py-2 font-bold">CON-2026-IT-09</td><td className="px-4 py-2">Delivery Phase 1</td><td className="px-4 py-2 text-center">14 May 26</td><td className="px-4 py-2 text-center text-red-600 font-bold">🔴 3 days</td><td className="px-4 py-2 text-center"><button className="px-2 py-1 text-xs font-bold text-red-700 bg-white border border-red-300 rounded">Calc</button></td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3">🟡 Due Within 7 Days</h3>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr><th className="px-4 py-2 text-left font-medium text-gray-500">Contract</th><th className="px-4 py-2 text-left font-medium text-gray-500">Milestone</th><th className="px-4 py-2 text-center font-medium text-gray-500">Planned</th><th className="px-4 py-2 text-center font-medium text-gray-500">Days Left</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="px-4 py-2 font-bold">CON-2026-PHM-06</td><td className="px-4 py-2">Inspection & Accept</td><td className="px-4 py-2 text-center">20 May 26</td><td className="px-4 py-2 text-center text-amber-600 font-bold">🟡 3 days</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-3">🟢 Upcoming (8-30 days)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr><th className="px-4 py-2 text-left font-medium text-gray-500">Contract</th><th className="px-4 py-2 text-left font-medium text-gray-500">Milestone</th><th className="px-4 py-2 text-center font-medium text-gray-500">Planned</th><th className="px-4 py-2 text-center font-medium text-gray-500">Days Left</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="px-4 py-2 font-bold">CON-2026-LAB-11</td><td className="px-4 py-2">Delivery All Items</td><td className="px-4 py-2 text-center">01 Aug 26</td><td className="px-4 py-2 text-center text-emerald-600 font-bold">🟢 14 days</td></tr>
                <tr><td className="px-4 py-2 font-bold">CON-2026-ADM-04</td><td className="px-4 py-2">Final Acceptance</td><td className="px-4 py-2 text-center">25 Jun 26</td><td className="px-4 py-2 text-center text-emerald-600 font-bold">🟢 25 days</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'perf-eval' && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Supplier Performance Evaluation</h2>
            <p className="text-sm text-gray-500 mb-4">Contract: CON-2026-LAB-11 | Lusaka Reagents Ltd</p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-sm font-bold text-amber-900">Evaluation Trigger</p>
              <p className="text-xs text-amber-700 mt-1">Contract is complete. Please submit final performance evaluation. This affects the supplier's risk score and future eligibility.</p>
            </div>

            <div className="space-y-6 mb-6">
              {[
                { metric: 'Delivery Timeliness', data: 'GRN data: 1 delivery, 5 days late', score: 72 },
                { metric: 'Quality Compliance', data: 'Inspection: 100% accepted', score: 100 },
                { metric: 'Contract Adherence', data: 'Minor shortfall (2 items) — corrected within 2 weeks', score: 85 },
                { metric: 'Responsiveness', data: 'All queries answered within 24 hours', score: 92 },
              ].map((item) => (
                <div key={item.metric} className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm font-bold text-gray-900">{item.metric}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.data}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-500">Score:</span>
                    <input type="number" defaultValue={item.score} className="w-20 border border-gray-300 rounded px-3 py-1.5 text-sm font-bold text-center" min={0} max={100} />
                    <span className="text-xs text-gray-500">/ 100</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-zammsa-green/5 border border-zammsa-green/20 rounded-xl p-4 mb-6">
              <p className="text-sm font-bold text-gray-900">Overall: (72+100+85+92)/4 = 87.25 / 100 🟢 GOOD</p>
            </div>

            <div className="mb-6">
              <p className="text-sm font-bold text-gray-900 mb-3">Recommendation for Future:</p>
              {['Recommend for future procurements', 'Acceptable — monitor closely', 'Do not recommend'].map((opt) => (
                <label key={opt} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg mb-2 cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="recommendation" className="accent-zammsa-green" defaultChecked={opt === 'Recommend for future procurements'} />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>

            <button className="px-6 py-3 bg-zammsa-green text-white text-sm font-bold rounded-lg">Submit Performance Evaluation</button>
          </div>
        </div>
      )}

      {activeTab === 'closure' && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Contract Closure — CON-2026-LAB-11</h2>
            <p className="text-sm text-gray-500 mb-6">All items must be ticked before closure is permitted.</p>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Delivery and Acceptance</h3>
                {['All items delivered and confirmed per GRN', 'Final inspection and acceptance completed', 'Acceptance certificate issued'].map((item) => (
                  <label key={item} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-zammsa-green" /> <span className="text-sm text-gray-700">{item}</span>
                  </label>
                ))}
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Financial</h3>
                {[
                  'All invoices submitted and approved',
                  'All payments made (excluding retention)',
                  'LDs calculated and deducted where applicable',
                  'Retention: K57,750 — Released 04 Oct 2026 ✅',
                  'No outstanding financial disputes',
                ].map((item) => (
                  <label key={item} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-zammsa-green" /> <span className="text-sm text-gray-700">{item}</span>
                  </label>
                ))}
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Compliance</h3>
                {[
                  'Performance security released (03 Nov 2026) ✅',
                  'No pending amendments or disputes',
                  'Supplier performance evaluation: 87.25/100 ✅',
                  'All documents saved and accessible',
                ].map((item) => (
                  <label key={item} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-zammsa-green" /> <span className="text-sm text-gray-700">{item}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Closure Notes</label>
                <textarea
                  defaultValue="All deliverables complete. Good performance (87.25/100). Recommend Lusaka Reagents for future procurements."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm"
                />
              </div>

              <p className="text-xs font-bold text-emerald-600">All 11 items ticked ✅</p>
            </div>

            <button className="mt-6 px-6 py-3 bg-zammsa-green text-white text-sm font-bold rounded-lg">✅ Mark Contract as COMPLETED</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractManagerDashboard;

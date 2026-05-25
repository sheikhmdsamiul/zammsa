import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { fetchProcurementDashboard } from '../../api/dashboards';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAppSelector } from '../../hooks/useRedux';
import {
  DocumentTextIcon, ChartBarIcon, StarIcon, TrendingUpIcon,
  CubeIcon, ClockIcon, DocumentIcon, CheckCircleIcon,
  BellIcon, CalendarIcon, ClipboardListIcon, UsersIcon,
  ShieldCheckIcon, ExclamationIcon, ScaleIcon,
} from '@heroicons/react/outline';
import { StatCard } from '../common/StatCard';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';

const ROLES = {
  OFFICER: 'procurement_officer',
  MANAGER: 'procurement_manager',
  DIRECTOR: 'director_procurement',
};

const metricIcons: Record<string, React.ReactNode> = {
  'Total Procurements': <CubeIcon className="w-6 h-6" />,
  'Avg Processing Days': <ClockIcon className="w-6 h-6" />,
  'Active Solicitations': <DocumentIcon className="w-6 h-6" />,
  'Completed': <CheckCircleIcon className="w-6 h-6" />,
};

const metricColors: Record<string, 'green' | 'blue' | 'orange' | 'purple'> = {
  'Total Procurements': 'blue',
  'Avg Processing Days': 'orange',
  'Active Solicitations': 'purple',
  'Completed': 'green',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#9CA3AF', published: '#3B82F6', evaluating: '#F59E0B',
  awarded: '#10B981', cancelled: '#EF4444', active: '#3B82F6',
  approved: '#10B981', closed: '#6B7280',
};

const ProcurementDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const navigate = useNavigate();
  const [pollInterval] = useState(30000);
  const [officerTab, setOfficerTab] = useState<'dashboard' | 'requisitions' | 'solicitations' | 'bids' | 'award'>('dashboard');

  const role = user?.role || '';
  const isOfficer = role === ROLES.OFFICER;
  const isManager = role === ROLES.MANAGER;
  const isDirector = role === ROLES.DIRECTOR;

  const { data, isLoading } = useQuery({
    queryKey: ['procurementDashboard'],
    queryFn: fetchProcurementDashboard,
    refetchInterval: pollInterval,
  });

  if (isLoading) return <LoadingSpinner />;

  if (isDirector || isManager) {
    return (
      <div className="pb-12">
        <PageHeader
          title={isDirector ? 'Director of Procurement Dashboard' : 'Procurement Manager Dashboard'}
          description={`Dr. C. Banda — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          actions={
            <div className="flex items-center gap-2">
              <button className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-zammsa-green transition-all shadow-sm">
                <BellIcon className="w-5 h-5" />
              </button>
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
                <CalendarIcon className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Approvals</p>
            <p className="text-3xl font-black text-gray-900 mt-1">5</p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />🔴 5 Pending
            </span>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Method Override</p>
            <p className="text-3xl font-black text-gray-900 mt-1">2</p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 2 Pending
            </span>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Eval. Committees</p>
            <p className="text-3xl font-black text-gray-900 mt-1">3</p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />🟢 3 Active
            </span>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Contracts</p>
            <p className="text-3xl font-black text-gray-900 mt-1">38</p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />🟢 38 Active
            </span>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ZPPA Rpt Due</p>
            <p className="text-3xl font-black text-amber-500 mt-1">1</p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 1 Due
            </span>
          </div>
        </div>

        {/* Pending My Approval */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" /> PENDING MY APPROVAL
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { item: 'CPP-2026-LAB-07 — Method Override', type: 'Override' },
                  { item: 'CPP-2026-CON-03 — Method Override', type: 'Override' },
                  { item: 'APP-2026-LAB-001 — Director Review Stage', type: 'APP' },
                  { item: 'BER-2026-IT-02 — Submit to ZPC', type: 'BER' },
                  { item: 'AMD-CON-2026-07 — Amendment > 15%', type: 'Amendment' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">{row.item}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 py-0.5 bg-gray-100 rounded">{row.type}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg hover:bg-zammsa-green/10">Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Procurement Health */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Procurement Health</h2>
            <div className="space-y-4">
              {[
                { label: 'On-plan', value: '87%', color: 'text-emerald-600', bar: 'w-[87%]', dot: 'bg-emerald-500' },
                { label: 'Avg days to award', value: '42d', color: 'text-amber-600', bar: 'w-[70%]', dot: 'bg-amber-500' },
                { label: 'Direct bid usage', value: '4.2%', color: 'text-emerald-600', bar: 'w-[21%]', dot: 'bg-emerald-500' },
                { label: 'Overdue evals', value: '1', color: 'text-red-600', bar: 'w-[10%]', dot: 'bg-red-500' },
                { label: 'COI declarations', value: '98%', color: 'text-emerald-600', bar: 'w-[98%]', dot: 'bg-emerald-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <span className="text-xs font-bold text-gray-600 w-32 shrink-0">{item.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`${item.bar} h-2 rounded-full ${item.dot.replace('bg-', 'bg-')}`} />
                  </div>
                  <span className={`text-xs font-black ${item.color} w-12 text-right`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Method Usage YTD */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Method Usage YTD</h2>
            <div className="space-y-4">
              {[
                { label: 'Open Bidding', value: '74%', bar: 'w-[74%]', color: 'bg-blue-500' },
                { label: 'Simplified', value: '18%', bar: 'w-[18%]', color: 'bg-amber-500' },
                { label: 'Direct', value: '4%', bar: 'w-[4%]', color: 'bg-emerald-500' },
                { label: 'Consulting', value: '4%', bar: 'w-[4%]', color: 'bg-purple-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <span className="text-xs font-bold text-gray-600 w-28 shrink-0">{item.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4">
                    <div className={`${item.bar} h-4 rounded-full ${item.color}`} style={{ width: item.value }} />
                  </div>
                  <span className="text-xs font-black text-gray-800 w-10 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Evaluation Committees */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <UsersIcon className="w-4 h-4" /> Evaluation Committees — Active
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Solicitation</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Members</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Stage</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { sol: 'SOL-2026-LAB-07', members: '4 assigned', stage: 'Technical Scoring' },
                  { sol: 'SOL-2026-IT-02', members: '3 assigned', stage: 'BER Ready' },
                  { sol: 'SOL-2026-CON-01', members: '⚠ Form now', stage: 'Not Formed', action: 'Form Committee' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-800">{row.sol}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.members}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.stage === 'Not Formed' ? 'draft' : 'active'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.action ? (
                        <button onClick={() => navigate(`/evaluations`)} className="px-3 py-1 text-xs font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg">Form Committee</button>
                      ) : (
                        <button onClick={() => navigate(`/evaluations`)} className="px-3 py-1 text-xs font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg">View</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compliance — Direct Bidding Log */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <ScaleIcon className="w-4 h-4" /> Compliance — Direct Bidding Log
          </h2>
          <p className="text-xs text-gray-500 mb-4">Policy limit: K20,000 per transaction | K200,000 annual per dept</p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Department</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Q1</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Q2</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">YTD</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { dept: 'Laboratory', q1: 'K35,000', q2: 'K18,000', ytd: 'K53,000', rem: 'K147,000', status: '🟢' },
                  { dept: 'Administration', q1: 'K12,000', q2: 'K65,000', ytd: 'K77,000', rem: 'K123,000', status: '🟢' },
                  { dept: 'Maintenance', q1: 'K45,000', q2: 'K90,000', ytd: 'K135,000', rem: 'K65,000', status: '🟡' },
                  { dept: 'Pharmacy', q1: 'K20,000', q2: 'K10,000', ytd: 'K30,000', rem: 'K170,000', status: '🟢' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-800">{row.dept}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{row.q1}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{row.q2}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold">{row.ytd}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{row.rem} {row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠ Maintenance dept at 67.5% of annual limit — monitoring required
          </div>
        </div>

        {/* Procurement KPIs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <TrendingUpIcon className="w-4 h-4" /> Procurement KPIs — YTD 2026
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">KPI</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Target</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Actual</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { kpi: 'Procurements on-plan', target: '≥90%', actual: '87%', status: '🟡' },
                  { kpi: 'Avg days: requisition→CPP', target: '≤3 days', actual: '2.1d', status: '🟢' },
                  { kpi: 'Avg days: CPP→published', target: '≤5 days', actual: '4.8d', status: '🟢' },
                  { kpi: 'Avg days: close→award', target: '≤30 days', actual: '42d', status: '🔴' },
                  { kpi: 'Open method usage', target: '≥80%', actual: '78%', status: '🟡' },
                  { kpi: 'Citizen supplier awards', target: '≥50%', actual: '58%', status: '🟢' },
                  { kpi: 'APP submitted to ZPPA', target: '100%', actual: '100%', status: '🟢' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">{row.kpi}</td>
                    <td className="px-4 py-3 text-center text-sm">{row.target}</td>
                    <td className="px-4 py-3 text-center text-sm font-bold">{row.actual}</td>
                    <td className="px-4 py-3 text-center text-lg">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <PageHeader
        title="Procurement Officer Dashboard"
        description={`Mary Phiri — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
              Good morning, Mary. You have 4 items requiring your attention.
            </span>
          </div>
        }
      />

      {/* Officer Tabs */}
      <div className="flex gap-2 border-b border-gray-200 mb-8">
        {(['dashboard', 'requisitions', 'solicitations', 'bids', 'award'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setOfficerTab(tab)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors capitalize ${
              officerTab === tab ? 'border-zammsa-green text-zammsa-green' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab === 'award' ? 'Contract Award' : tab}
          </button>
        ))}
      </div>

      {officerTab === 'dashboard' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Requisit. Awaiting My Action</p>
              <p className="text-3xl font-black text-gray-900 mt-1">3</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />🔴 3 Pending
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Solicitat.</p>
              <p className="text-3xl font-black text-gray-900 mt-1">7</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />🟢 7 Active
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bids Closing This Week</p>
              <p className="text-3xl font-black text-amber-500 mt-1">2</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 2 Closing
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Evaluation Pending</p>
              <p className="text-3xl font-black text-amber-500 mt-1">1</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />🟡 1 Pending
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contracts Active</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">12</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />🟢 12 Active
              </span>
            </div>
          </div>

          {/* Action Required */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
            <h2 className="text-sm font-black text-red-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" /> ACTION REQUIRED
            </h2>
            <div className="space-y-3">
              {[
                { ref: 'REQ-2026-LAB-041', desc: 'Approved — Create CPP now', action: 'Create CPP', color: 'text-amber-900' },
                { ref: 'SOL-2026-IT-03', desc: 'Approved — Publish now', action: 'Publish', color: 'text-blue-900' },
                { ref: 'SOL-2026-PHM-05', desc: 'Closing tomorrow 14:00', action: 'Prepare Open', color: 'text-red-900' },
                { ref: 'CON-2026-LAB-11', desc: 'Perf. security needed', action: 'View', color: 'text-amber-900' },
              ].map((item) => (
                <div key={item.ref} className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-amber-900">{item.ref}</p>
                    <p className="text-xs text-amber-700">{item.desc}</p>
                  </div>
                  <button className="px-4 py-1.5 text-xs font-bold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100">
                    [{item.action}]
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* My Active Solicitations */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">My Active Solicitations</h2>
              <div className="space-y-3">
                {[
                  { sol: 'SOL-2026-LAB-07', status: '🟢 Open', time: '27d' },
                  { sol: 'SOL-2026-IT-03', status: '✅ Apprvd', time: '' },
                  { sol: 'SOL-2026-PHM-05', status: '🟢 Open', time: '1d' },
                  { sol: 'SOL-2026-CON-02', status: '🟢 Open', time: '5d' },
                ].map((row) => (
                  <div key={row.sol} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-bold text-gray-800">{row.sol}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{row.status}</span>
                      {row.time && <span className="text-xs font-bold text-gray-400">{row.time}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Closing Soon */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Closing Soon</h2>
              <div className="space-y-3">
                {[
                  { sol: 'SOL-2026-PHM-05', time: '1d 2h' },
                  { sol: 'SOL-2026-CON-02', time: '5d 14h' },
                ].map((row) => (
                  <div key={row.sol} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-sm font-bold text-amber-900">{row.sol}</span>
                    <span className="text-xs font-bold text-amber-700">{row.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CPP Milestone Alerts */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> CPP Milestone Alerts
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">CPP</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Milestone</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Planned</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { cpp: 'CPP-2026-LAB-07', ms: 'Publication', planned: '21 May', status: '🟡 Due tomorrow' },
                    { cpp: 'CPP-2026-PHM-04', ms: 'Closing', planned: '12 Jun', status: '🟢 On track' },
                    { cpp: 'CPP-2026-IT-02', ms: 'BER Approval', planned: '30 May', status: '🔴 Overdue 3d' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-800">{row.cpp}</td>
                      <td className="px-4 py-3 text-sm">{row.ms}</td>
                      <td className="px-4 py-3 text-sm">{row.planned}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Procurement Pipeline */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">My Procurement Pipeline</h2>
            <div className="space-y-3">
              {[
                { stage: 'Planning', pct: 28, color: 'bg-blue-500' },
                { stage: 'Solicitation', pct: 45, color: 'bg-amber-500' },
                { stage: 'Evaluation', pct: 20, color: 'bg-purple-500' },
                { stage: 'Award', pct: 7, color: 'bg-emerald-500' },
              ].map((item) => (
                <div key={item.stage} className="flex items-center gap-4">
                  <span className="text-xs font-bold text-gray-600 w-24 shrink-0">{item.stage}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5">
                    <div className={`${item.color} h-5 rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-xs font-black text-gray-800 w-10 text-right">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {officerTab === 'requisitions' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Requisitions — Pending My Action</h2>
          <p className="text-xs text-gray-500 mb-4">These requisitions are fully approved and ready for CPP creation.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Req No.</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value K</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { ref: 'REQ-2026-LAB-041', desc: 'Lab Reagents 2026', dept: 'Laboratory', value: '1,020,000' },
                  { ref: 'REQ-2026-ADM-022', desc: 'Office Stationery', dept: 'Administration', value: '85,000' },
                  { ref: 'REQ-2026-IT-018', desc: 'IT Laptops & Equip', dept: 'IT Department', value: '420,000' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-800">{row.ref}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-gray-800">{row.desc}</p>
                      <p className="text-xs text-gray-400">Dept: {row.dept}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{row.value}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => navigate('/procurement-planning/cpp/create')} className="px-3 py-1 text-xs font-bold text-zammsa-green bg-zammsa-green/5 border border-zammsa-green/20 rounded-lg">Create CPP</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {officerTab === 'solicitations' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Solicitations</h2>
            <button onClick={() => navigate('/solicitations/create')} className="px-4 py-2 bg-zammsa-green text-white rounded-xl text-xs font-bold">+ Create New Solicitation</button>
          </div>
          <div className="flex gap-2 mb-4">
            <select className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 font-medium text-gray-600">
              <option>All Status</option>
              <option>Draft</option>
              <option>Approved</option>
              <option>Open</option>
              <option>Closed</option>
            </select>
            <select className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 font-medium text-gray-600">
              <option>All Dept</option>
              <option>Laboratory</option>
              <option>IT</option>
              <option>Pharmacy</option>
            </select>
            <select className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 font-medium text-gray-600">
              <option>All Method</option>
              <option>ONB</option>
              <option>RFP</option>
              <option>SIM</option>
            </select>
            <div className="flex-1" />
            <input className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 font-medium text-gray-600 w-48" placeholder="Search..." />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50 text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Sol No.</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Title</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Mthd</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Closing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { sol: 'SOL-2026-LAB-07', title: 'Supply of Lab Reagents', mthd: 'ONB', status: 'open', closing: '11Jun26' },
                  { sol: 'SOL-2026-IT-03', title: 'Supply IT Equipment', mthd: 'ONB', status: 'approved', closing: '—' },
                  { sol: 'SOL-2026-PHM-05', title: 'Essential Medicines', mthd: 'ONB', status: 'open', closing: '25Jun26' },
                  { sol: 'SOL-2026-IT-04', title: 'IT Support Services', mthd: 'RFP', status: 'draft', closing: '—' },
                  { sol: 'SOL-2026-LAB-06', title: 'Lab Equipment Mainten.', mthd: 'SIM', status: 'closed', closing: '—' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/solicitations/${row.sol}`)}>
                    <td className="px-4 py-3 font-bold text-gray-800">{row.sol}</td>
                    <td className="px-4 py-3 text-sm">{row.title}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-gray-500">{row.mthd}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.status === 'approved' ? (
                        <button className="px-3 py-1 text-xs font-bold text-white bg-zammsa-green rounded-lg">Publish</button>
                      ) : row.status === 'open' ? (
                        <button className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg">Manage</button>
                      ) : row.status === 'draft' ? (
                        <button className="px-3 py-1 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg">Edit</button>
                      ) : (
                        <button className="px-3 py-1 text-xs font-bold text-gray-500 bg-gray-100 rounded-lg">View</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {officerTab === 'bids' && (
        <div className="space-y-6">
          {/* Closing Today */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-red-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" /> CLOSING TODAY — ACTION REQUIRED
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-bold text-red-900">SOL-2026-PHM-05</p>
              <p className="text-xs text-red-700 mt-1">Closes: 17 May 14:00 CAT &bull; 2h 14m left</p>
              <p className="text-xs text-red-700">Bids received so far: 4</p>
              <p className="text-xs text-red-700">Opening scheduled: 17 May 14:30 CAT</p>
              <p className="text-xs text-red-700">Witnesses assigned: ✅ J. Mbewe, F. Banda</p>
              <p className="text-xs text-red-700">Public link ready: ✅ Generated</p>
              <button onClick={() => navigate('/bids/opening/sol-phm-05')} className="mt-3 px-4 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700">Prepare Opening</button>
            </div>
          </div>

          {/* All Bid Openings */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">All Bid Openings</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Solicitation</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Bids Rec.</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Opening</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { sol: 'SOL-2026-PHM-05', bids: '4 (live)', opening: 'Today 14:30', status: 'pending' as const },
                    { sol: 'SOL-2026-LAB-07', bids: '6', opening: '11 Jun', status: 'draft' as const },
                    { sol: 'SOL-2026-LAB-06', bids: '5', opening: 'Completed', status: 'completed' as const },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-800">{row.sol}</td>
                      <td className="px-4 py-3 text-center text-sm">{row.bids}</td>
                      <td className="px-4 py-3 text-center text-sm">{row.opening}</td>
                      <td className="px-4 py-3 text-right"><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Late/Rejected Bids */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <ExclamationIcon className="w-4 h-4" /> Late / Rejected Bids (audit record)
            </h2>
            <div className="space-y-2">
              {[
                { sol: 'SOL-2026-LAB-06', reason: '1 late bid — rejected 14:01:12 auto' },
                { sol: 'SOL-2026-IT-02', reason: '1 late bid — rejected 14:00:45 auto' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-bold text-gray-800">{row.sol}</span>
                  <span className="text-xs text-gray-500">{row.reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {officerTab === 'award' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Award Notices Pending Publication</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Solicitation</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Recommended</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value K</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-800">SOL-2026-LAB-07</td>
                    <td className="px-4 py-3 text-sm">Lusaka Reagents</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">1,155,000</td>
                    <td className="px-4 py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-zammsa-green rounded-lg">Publish</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Standstill Monitor</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Solicitation</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Started</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Expires</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Appeals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { sol: 'SOL-2026-LAB-07', start: '02 Jul', expires: '16 Jul', appeals: '0 🟢' },
                    { sol: 'SOL-2026-IT-02', start: '15 May', expires: '29 May', appeals: '0 🟢' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-800">{row.sol}</td>
                      <td className="px-4 py-3 text-center text-sm">{row.start}</td>
                      <td className="px-4 py-3 text-center text-sm">{row.expires}</td>
                      <td className="px-4 py-3 text-center text-sm font-bold">{row.appeals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Standstill Complete — Generate Contract</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Solicitation</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value K</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-800">SOL-2026-IT-02</td>
                    <td className="px-4 py-3 text-sm">ABC Tech Ltd</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">342,000</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => navigate('/contracts/create')} className="px-3 py-1 text-xs font-bold text-white bg-zammsa-green rounded-lg">Gen. Contract</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementDashboard;

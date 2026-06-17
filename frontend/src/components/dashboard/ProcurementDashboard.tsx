import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProcurementDashboard } from '../../api/dashboards';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAppSelector } from '../../hooks/useRedux';
import {
  CubeIcon, ClockIcon, DocumentIcon, CheckCircleIcon,
  BellIcon, CalendarIcon, UsersIcon,
  ExclamationIcon, ScaleIcon, TrendingUpIcon
} from '@heroicons/react/outline';
import { StatCard } from '../common/StatCard';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';

const ROLES = {
  OFFICER: 'procurement_officer',
  MANAGER: 'procurement_manager',
  DIRECTOR: 'director_procurement',
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

  const { isLoading } = useQuery({
    queryKey: ['procurementDashboard'],
    queryFn: fetchProcurementDashboard,
    refetchInterval: pollInterval,
  });

  if (isLoading) return <div className="p-12 flex justify-center"><LoadingSpinner /></div>;

  if (isDirector || isManager) {
    return (
      <div className="space-y-8">
        <PageHeader
          title={isDirector ? 'Director of Procurement' : 'Procurement Manager'}
          description={`${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          actions={
            <div className="flex items-center gap-3">
              <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-zammsa-green transition-colors shadow-sm">
                <BellIcon className="w-5 h-5" />
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                <CalendarIcon className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Pending Approvals" value="5" color="red" icon={<CheckCircleIcon />} description="Requiring immediate action" />
          <StatCard label="Method Overrides" value="2" color="orange" icon={<ScaleIcon />} description="Awaiting justification review" />
          <StatCard label="Active Committees" value="3" color="blue" icon={<UsersIcon />} description="Across all departments" />
          <StatCard label="Active Contracts" value="38" color="green" icon={<DocumentIcon />} description="Currently in execution" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Action Queue */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Action Queue
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reference</th>
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { item: 'CPP-2026-LAB-07', desc: 'Method Override', type: 'Override' },
                      { item: 'APP-2026-LAB-001', desc: 'Director Review Stage', type: 'APP' },
                      { item: 'BER-2026-IT-02', desc: 'Submit to ZPC', type: 'BER' },
                      { item: 'AMD-CON-2026-07', desc: 'Amendment > 15%', type: 'Amendment' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                           <p className="text-sm font-semibold text-slate-900">{row.item}</p>
                           <p className="text-xs text-slate-500">{row.desc}</p>
                        </td>
                        <td className="px-6 py-4">
                           <StatusBadge status="pending" />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-xs font-bold text-zammsa-green hover:underline">Review</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Performance KPIs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <TrendingUpIcon className="w-4 h-4 text-slate-400" /> Procurement KPIs
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-5">
                    {[
                      { label: 'On-plan %', value: '87%', pct: 87, color: 'bg-emerald-500' },
                      { label: 'Avg Days to Award', value: '42d', pct: 60, color: 'bg-amber-500' },
                      { label: 'Direct Bid Usage', value: '4.2%', pct: 25, color: 'bg-emerald-500' },
                    ].map((kpi) => (
                      <div key={kpi.label} className="space-y-1.5">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-semibold text-slate-600">{kpi.label}</span>
                          <span className="text-xs font-bold text-slate-900">{kpi.value}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${kpi.color}`} style={{ width: `${kpi.pct}%` }} />
                        </div>
                      </div>
                    ))}
                 </div>
                 <div className="space-y-5">
                    {[
                      { label: 'Method Compliance', value: '98%', pct: 98, color: 'bg-emerald-500' },
                      { label: 'Citizen Awards', value: '58%', pct: 58, color: 'bg-zammsa-green' },
                      { label: 'Budget Utilization', value: '64%', pct: 64, color: 'bg-blue-500' },
                    ].map((kpi) => (
                      <div key={kpi.label} className="space-y-1.5">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-semibold text-slate-600">{kpi.label}</span>
                          <span className="text-xs font-bold text-slate-900">{kpi.value}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${kpi.color}`} style={{ width: `${kpi.pct}%` }} />
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Compliance Alerts */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
               <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <ScaleIcon className="w-4 h-4 text-slate-400" /> Compliance Monitor
               </h2>
               <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <p className="text-xs font-bold text-amber-800">Maintenance Dept Limit</p>
                    <p className="text-[10px] text-amber-700 mt-0.5">At 67.5% of annual direct bidding limit. Monitoring required.</p>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                    <p className="text-xs font-bold text-rose-800">Audit Finding Due</p>
                    <p className="text-[10px] text-rose-700 mt-0.5">Response for SOL-2026-IT-02 overdue by 3 days.</p>
                  </div>
               </div>
            </div>

            {/* Method Usage */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
               <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Method Usage (YTD)</h2>
               <div className="space-y-4">
                  {[
                    { label: 'Open Bidding', pct: 74, color: 'bg-indigo-500' },
                    { label: 'Simplified', pct: 18, color: 'bg-amber-400' },
                    { label: 'Direct', pct: 4, color: 'bg-emerald-500' },
                    { label: 'Consulting', pct: 4, color: 'bg-slate-400' },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${m.color}`} />
                      <span className="text-xs font-medium text-slate-600 flex-1">{m.label}</span>
                      <span className="text-xs font-bold text-slate-900">{m.pct}%</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Procurement Officer"
        description="Mary Phiri — Managed Workload"
        actions={
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-zammsa-green/5 border border-zammsa-green/10 rounded-lg">
              <p className="text-xs font-semibold text-zammsa-green">4 Items Require Attention</p>
            </div>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['dashboard', 'requisitions', 'solicitations', 'bids', 'award'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setOfficerTab(tab)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all capitalize ${
              officerTab === tab 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'award' ? 'Awards' : tab}
          </button>
        ))}
      </div>

      {officerTab === 'dashboard' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="My Requisitions" value="3" color="orange" icon={<ClockIcon />} description="Awaiting CPP creation" />
            <StatCard label="Active Solicitations" value="7" color="blue" icon={<DocumentIcon />} description="Currently published" />
            <StatCard label="Closing Soon" value="2" color="red" icon={<BellIcon />} description="Closing within 48 hours" />
            <StatCard label="My Contracts" value="12" color="green" icon={<CheckCircleIcon />} description="Under active management" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
               {/* Immediate Tasks */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Immediate Tasks</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {[
                      { ref: 'REQ-2026-LAB-041', desc: 'Approved — Create CPP now', urgent: true },
                      { ref: 'SOL-2026-IT-03', desc: 'Approved — Publish now', urgent: false },
                      { ref: 'SOL-2026-PHM-05', desc: 'Closing tomorrow 14:00', urgent: true },
                    ].map((task, i) => (
                      <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${task.urgent ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                         <div>
                            <p className={`text-sm font-bold ${task.urgent ? 'text-rose-900' : 'text-slate-900'}`}>{task.ref}</p>
                            <p className={`text-xs ${task.urgent ? 'text-rose-700' : 'text-slate-600'}`}>{task.desc}</p>
                         </div>
                         <button className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                           task.urgent 
                            ? 'bg-white border-rose-200 text-rose-700 hover:bg-rose-100' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                         }`}>
                           Open Task
                         </button>
                      </div>
                    ))}
                  </div>
               </div>

               {/* Pipeline */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                 <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Workload Pipeline</h2>
                 <div className="space-y-5">
                    {[
                      { label: 'Planning & CPP', pct: 28, color: 'bg-indigo-500' },
                      { label: 'Active Tenders', pct: 45, color: 'bg-amber-400' },
                      { label: 'Evaluations', pct: 20, color: 'bg-purple-500' },
                      { label: 'Contracting', pct: 7, color: 'bg-emerald-500' },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1.5">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-semibold text-slate-600">{item.label}</span>
                          <span className="text-xs font-bold text-slate-900">{item.pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                 </div>
               </div>
            </div>

            <div className="space-y-8">
               {/* Milestone Calendar */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-slate-400" /> Upcoming Deadlines
                  </h2>
                  <div className="space-y-4">
                    {[
                      { ref: 'CPP-2026-LAB-07', date: 'May 21', label: 'Publication', urgent: true },
                      { ref: 'CPP-2026-PHM-04', date: 'Jun 12', label: 'Closing', urgent: false },
                      { ref: 'BER-2026-IT-02', date: 'May 30', label: 'Submission', urgent: true },
                    ].map((d, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${d.urgent ? 'bg-rose-500' : 'bg-amber-400'}`} />
                        <div>
                           <p className="text-xs font-bold text-slate-900">{d.ref}</p>
                           <p className="text-[10px] text-slate-500">{d.label} &bull; {d.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>

               {/* Recent Solicitations */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Tenders</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[
                      { ref: 'SOL-2026-LAB-07', status: 'Open', color: 'text-emerald-600' },
                      { ref: 'SOL-2026-IT-03', status: 'Approved', color: 'text-blue-600' },
                      { ref: 'SOL-2026-PHM-05', status: 'Open', color: 'text-emerald-600' },
                    ].map((s, i) => (
                      <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer">
                         <span className="text-xs font-bold text-slate-800">{s.ref}</span>
                         <span className={`text-[10px] font-bold ${s.color}`}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 py-3 bg-slate-50 text-center">
                    <button className="text-xs font-bold text-zammsa-green hover:underline">View All</button>
                  </div>
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProcurementDashboard;

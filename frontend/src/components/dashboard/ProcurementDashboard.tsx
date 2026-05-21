import React, { useState } from 'react';
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
  BellIcon, CalendarIcon
} from '@heroicons/react/outline';
import { StatCard } from '../common/StatCard';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';

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
  awarded: '#10B981', cancelled: '#EF4444',
};

const quickActions = [
  { label: 'New Solicitation', href: '#', icon: <DocumentTextIcon className="w-5 h-5" />, color: 'bg-blue-500' },
  { label: 'Evaluate Bids', href: '#', icon: <ChartBarIcon className="w-5 h-5" />, color: 'bg-amber-500' },
  { label: 'Award Contract', href: '#', icon: <StarIcon className="w-5 h-5" />, color: 'bg-emerald-500' },
  { label: 'View Reports', href: '#', icon: <TrendingUpIcon className="w-5 h-5" />, color: 'bg-indigo-500' },
];

const ProcurementDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const [pollInterval] = useState(30000);

  const { data, isLoading } = useQuery({
    queryKey: ['procurementDashboard'],
    queryFn: fetchProcurementDashboard,
    refetchInterval: pollInterval,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="pb-12">
      <PageHeader 
        title="Procurement Overview"
        description={`Welcome back, ${user?.full_name}. Here is what's happening today.`}
        actions={
          <div className="flex items-center gap-2">
            <button className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-zammsa-green hover:border-zammsa-green transition-all shadow-sm">
              <BellIcon className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
              <CalendarIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        }
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {(data?.key_metrics || []).map((m) => (
          <StatCard 
            key={m.label}
            label={m.label}
            value={m.value.toLocaleString()}
            change={m.change}
            icon={metricIcons[m.label]}
            color={metricColors[m.label] || 'gray'}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((a) => (
              <a
                key={a.label}
                href={a.href}
                className="group flex flex-col items-center justify-center p-5 rounded-2xl border border-gray-100 hover:border-zammsa-green/30 hover:bg-zammsa-green/5 transition-all duration-300"
              >
                <div className={`p-3 rounded-xl ${a.color} text-white mb-3 shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform`}>
                  {a.icon}
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">{a.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Solicitations by Status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Solicitation Status</h2>
          {data?.solicitations_by_status && data.solicitations_by_status.length > 0 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.solicitations_by_status}
                    dataKey="count"
                    nameKey="status"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={45}
                    stroke="none"
                  >
                    {data.solicitations_by_status.map((e) => (
                      <Cell key={e.status} fill={STATUS_COLORS[e.status] || '#9CA3AF'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                {data.solicitations_by_status.map((e) => (
                  <div key={e.status} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[e.status] }} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">{e.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[220px] text-gray-400 italic">
               <CubeIcon className="w-8 h-8 opacity-20 mb-2" />
               <p className="text-xs">No data available</p>
            </div>
          )}
        </div>

        {/* Tasks Widget */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-6">My Tasks</h2>
          {data?.tasks && data.tasks.length > 0 ? (
            <div className="space-y-4">
              {data.tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-4 group">
                  <div className={`w-1 h-10 rounded-full shrink-0 ${
                    t.priority === 'high' ? 'bg-rose-500' : t.priority === 'medium' ? 'bg-amber-500' : 'bg-sky-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate group-hover:text-zammsa-green transition-colors">{t.title}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Due: {new Date(t.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                    t.priority === 'high' ? 'text-rose-600 bg-rose-50' : 
                    t.priority === 'medium' ? 'text-amber-600 bg-amber-50' : 'text-sky-600 bg-sky-50'
                  }`}>
                    {t.priority}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[220px] text-gray-400 italic">
               <CheckCircleIcon className="w-8 h-8 opacity-20 mb-2" />
               <p className="text-xs">All caught up!</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Deadlines Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Upcoming Deadlines</h2>
          <button className="text-[10px] font-black text-zammsa-green uppercase tracking-widest hover:underline">View All</button>
        </div>
        
        {data?.upcoming_deadlines && data.upcoming_deadlines.length > 0 ? (
          <div className="overflow-x-auto -mx-6">
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Title</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Closing Date</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.upcoming_deadlines.map((d) => {
                  const daysLeft = Math.ceil((new Date(d.closing_date).getTime() - Date.now()) / 86400000);
                  return (
                    <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-gray-800">{d.title}</td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 py-0.5 bg-gray-100 rounded">{d.type}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-500">{new Date(d.closing_date).toLocaleDateString('en-GB')}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-xs font-black tracking-tighter ${
                          daysLeft <= 3 ? 'text-rose-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {daysLeft} DAYS LEFT
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <CalendarIcon className="w-12 h-12 mx-auto opacity-10 mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest">No upcoming deadlines</p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-1 gap-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-6">System Feed</h2>
          {data?.recent_activities && data.recent_activities.length > 0 ? (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-100 before:to-transparent">
              {data.recent_activities.map((a) => (
                <div key={a.id} className="relative flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-xs font-black text-zammsa-green z-10 group-hover:border-zammsa-green transition-colors">
                    {a.user.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 leading-snug">
                       <span className="font-bold text-gray-900">{a.user}</span> {a.description}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{new Date(a.created_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8 italic">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcurementDashboard;

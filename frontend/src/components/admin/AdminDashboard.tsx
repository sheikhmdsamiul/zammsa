import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminDashboard } from '../../api/admin';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAppSelector } from '../../hooks/useRedux';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { 
  ChipIcon, DatabaseIcon, ServerIcon, ShieldCheckIcon,
  UsersIcon, LinkIcon, ClipboardListIcon, CogIcon,
  ClockIcon, RefreshIcon
} from '@heroicons/react/outline';

const statusColor = (s: string) => {
  if (s === 'healthy' || s === 'active' || s === 'online') return 'bg-emerald-500';
  if (s === 'warning' || s === 'degraded') return 'bg-amber-500';
  return 'bg-rose-500';
};

const AdminDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const [pollInterval] = useState(30000);

  const { data, isLoading } = useQuery({
    queryKey: ['adminDashboard'], queryFn: fetchAdminDashboard, refetchInterval: pollInterval,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="pb-12">
      <PageHeader 
        title="Admin Control Center"
        description="Monitor system health, integrations, and administrative tasks."
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-xs font-bold text-gray-500 hover:text-zammsa-orange transition-colors">
              <RefreshIcon className="w-4 h-4" />
              <span>Force Refresh</span>
            </button>
            <div className="px-3 py-1 bg-zammsa-orange/10 border border-zammsa-orange/20 rounded-lg">
               <span className="text-[10px] font-black text-zammsa-orange uppercase tracking-widest">LIVE STATUS</span>
            </div>
          </div>
        }
      />

      <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">System Health</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {data?.system_health && (
          <>
            <StatCard 
              label="CPU Usage"
              value={`${data.system_health.cpu}%`}
              icon={<ChipIcon className="w-6 h-6" />}
              color={data.system_health.cpu > 80 ? 'red' : data.system_health.cpu > 50 ? 'orange' : 'blue'}
              description="Server processor load"
            />
            <StatCard 
              label="Memory Usage"
              value={`${data.system_health.memory}%`}
              icon={<ServerIcon className="w-6 h-6" />}
              color={data.system_health.memory > 80 ? 'red' : 'purple'}
              description="System RAM utilization"
            />
            <StatCard 
              label="Disk Usage"
              value={`${data.system_health.disk}%`}
              icon={<DatabaseIcon className="w-6 h-6" />}
              color={data.system_health.disk > 80 ? 'red' : 'green'}
              description="Storage capacity used"
            />
            <StatCard 
              label="DB Connections"
              value={data.system_health.db_connections}
              icon={<ShieldCheckIcon className="w-6 h-6" />}
              color="blue"
              description="Active database pool"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">User Base</h2>
            <UsersIcon className="w-5 h-5 text-gray-200" />
          </div>
          {data?.user_stats && (
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(data.user_stats).map(([k, v]) => (
                <div key={k} className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100/50 group hover:bg-white hover:shadow-md transition-all duration-300">
                  <p className={`text-2xl font-black mb-1 ${
                    k === 'suspended' ? 'text-rose-600' : k === 'pending' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>{v}</p>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{k.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          )}
          <button className="w-full mt-6 py-3 rounded-xl border border-dashed border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:border-zammsa-orange hover:text-zammsa-orange transition-all">Manage All Users</button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">External APIs</h2>
            <LinkIcon className="w-5 h-5 text-gray-200" />
          </div>
          {data?.integrations && data.integrations.length > 0 ? (
            <div className="space-y-4">
              {data.integrations.map((i) => (
                <div key={i.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${statusColor(i.status)}`} />
                    <span className="text-sm font-bold text-gray-700">{i.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                     {new Date(i.last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : <div className="text-center py-12 text-gray-400 italic text-xs">No integrations monitored</div>}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Queue Summary</h2>
            <ClipboardListIcon className="w-5 h-5 text-gray-200" />
          </div>
          {data?.pending_approvals_summary && data.pending_approvals_summary.length > 0 ? (
            <div className="space-y-4">
              {data.pending_approvals_summary.map((a) => (
                <div key={a.type} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50">
                  <span className="text-sm font-medium text-gray-700">{a.type}</span>
                  <span className="bg-zammsa-orange text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-sm shadow-zammsa-orange/20">{a.count}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-center py-12 text-gray-400 italic text-xs">Queue is empty</div>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Automated Tasks</h2>
          <CogIcon className="w-5 h-5 text-gray-200" />
        </div>
        {data?.scheduled_jobs && data.scheduled_jobs.length > 0 ? (
          <div className="overflow-x-auto -mx-6">
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Job Name</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Run</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Next Run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.scheduled_jobs.map((j) => (
                  <tr key={j.name} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{j.name}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                        j.status === 'running' ? 'bg-emerald-50 text-emerald-600' : 
                        j.status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-medium text-gray-500">{j.last_run ? new Date(j.last_run).toLocaleString('en-GB') : '-'}</td>
                    <td className="px-6 py-4 text-right text-xs font-medium text-gray-400 italic">{j.next_run ? new Date(j.next_run).toLocaleString('en-GB') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-gray-400 text-sm text-center py-12">No scheduled jobs found</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Security Audit Log</h2>
          <button className="text-[10px] font-black text-zammsa-orange uppercase tracking-widest hover:underline">Full Log</button>
        </div>
        {data?.recent_audit_logs && data.recent_audit_logs.length > 0 ? (
          <div className="space-y-4">
            {data.recent_audit_logs.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center gap-4 p-3 rounded-xl border border-transparent hover:border-gray-100 hover:bg-gray-50 transition-all group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg group-hover:scale-110 transition-transform ${
                  l.action === 'create' ? 'bg-emerald-500 shadow-emerald-100' : 
                  l.action === 'update' ? 'bg-sky-500 shadow-sky-100' : 
                  l.action === 'delete' ? 'bg-rose-500 shadow-rose-100' : 'bg-gray-500 shadow-gray-100'
                }`}>
                  <span className="text-xs font-black uppercase tracking-tighter">{l.action.slice(0, 3)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">
                    {l.user} <span className="font-medium text-gray-400 uppercase text-[10px] tracking-widest mx-1">PERFORMED</span> {l.action} <span className="font-medium text-gray-400 uppercase text-[10px] tracking-widest mx-1">ON</span> {l.resource}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <ClockIcon className="w-3 h-3 text-gray-300" />
                    <span className="text-[10px] font-bold text-gray-400">{new Date(l.timestamp).toLocaleString('en-GB')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-400 text-sm text-center py-8">No recent audit logs</p>}
      </div>
    </div>
  );
};

export default AdminDashboard;
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
} from '@heroicons/react/outline';

const iconClass = 'h-6 w-6 text-gray-500';

const metricIcons: Record<string, React.ReactNode> = {
  'Total Procurements': <CubeIcon className={iconClass} />,
  'Avg Processing Days': <ClockIcon className={iconClass} />,
  'Active Solicitations': <DocumentIcon className={iconClass} />,
  'Completed': <CheckCircleIcon className={iconClass} />,
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#9CA3AF', published: '#3B82F6', evaluating: '#F59E0B',
  awarded: '#10B981', cancelled: '#EF4444',
};

const quickActions = [
  { label: 'New Solicitation', href: '#', icon: <DocumentTextIcon className={iconClass} /> },
  { label: 'Evaluate Bids', href: '#', icon: <ChartBarIcon className={iconClass} /> },
  { label: 'Award Contract', href: '#', icon: <StarIcon className={iconClass} /> },
  { label: 'View Reports', href: '#', icon: <TrendingUpIcon className={iconClass} /> },
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement Officer Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {user?.full_name}</p>
        </div>
        <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full shadow">
          Auto-refreshing every 30s
        </span>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(data?.key_metrics || []).map((m) => (
          <div key={m.label} className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{m.label}</span>
              <span className="text-lg">{metricIcons[m.label] || <CubeIcon className={iconClass} />}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{m.value.toLocaleString()}</p>
            <span className={`text-xs ${m.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {m.change >= 0 ? '↑' : '↓'} {Math.abs(m.change)}% from last month
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => (
              <a
                key={a.label}
                href={a.href}
                className="flex flex-col items-center justify-center p-4 rounded-lg border border-gray-200 hover:border-zammsa-green hover:bg-green-50 transition-colors"
              >
                <span className="mb-1">{a.icon}</span>
                <span className="text-xs font-medium text-gray-700 text-center">{a.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Solicitations by Status */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Solicitations by Status</h2>
          {data?.solicitations_by_status && data.solicitations_by_status.length > 0 ? (
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.solicitations_by_status}
                    dataKey="count"
                    nameKey="status"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={50}
                    label={({ payload }) => `${payload.status} (${payload.count})`}
                  >
                    {data.solicitations_by_status.map((e) => (
                      <Cell key={e.status} fill={STATUS_COLORS[e.status] || '#9CA3AF'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">No data available</p>
          )}
        </div>

        {/* Tasks Widget */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Tasks</h2>
          {data?.tasks && data.tasks.length > 0 ? (
            <ul className="space-y-3">
              {data.tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                  <span
                    className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                      t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                    <p className="text-xs text-gray-500">Due: {new Date(t.due).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    t.priority === 'high' ? 'bg-red-100 text-red-700' :
                    t.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                  }`}>{t.priority}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">No pending tasks</p>
          )}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Deadlines</h2>
        {data?.upcoming_deadlines && data.upcoming_deadlines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closing Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.upcoming_deadlines.map((d) => {
                  const daysLeft = Math.ceil((new Date(d.closing_date).getTime() - Date.now()) / 86400000);
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.title}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{d.type}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{new Date(d.closing_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {daysLeft}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">No upcoming deadlines</p>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {data?.recent_activities && data.recent_activities.length > 0 ? (
          <div className="space-y-3">
            {data.recent_activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className="w-8 h-8 rounded-full bg-zammsa-green/10 flex items-center justify-center text-xs font-bold text-zammsa-green flex-shrink-0">
                  {a.user.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{a.description}</p>
                  <p className="text-xs text-gray-400">{a.user} • {new Date(a.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">No recent activity</p>
        )}
      </div>
    </div>
  );
};

export default ProcurementDashboard;

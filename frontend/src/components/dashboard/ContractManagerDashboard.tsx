import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchContractManagerDashboard } from '../../api/dashboards';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAppSelector } from '../../hooks/useRedux';
import {
  PencilIcon, PencilAltIcon, ChartBarIcon, CalendarIcon,
} from '@heroicons/react/outline';

const iconClass = 'h-6 w-6 text-gray-500';

const ContractManagerDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const [pollInterval] = useState(30000);

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
          <p className="text-sm text-gray-500">Welcome back, {user?.full_name}</p>
        </div>
        <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full shadow">Auto-refreshing every 30s</span>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'New Contract', icon: <PencilAltIcon className={iconClass} />, href: '#' },
          { label: 'Create Amendment', icon: <PencilIcon className={iconClass} />, href: '#' },
          { label: 'Generate Report', icon: <ChartBarIcon className={iconClass} />, href: '#' },
          { label: 'View Calendar', icon: <CalendarIcon className={iconClass} />, href: '#' },
        ].map((a) => (
          <a key={a.label} href={a.href} className="bg-white rounded-lg shadow p-4 flex flex-col items-center justify-center hover:border-zammsa-green hover:border transition-colors">
            <span className="mb-1">{a.icon}</span>
            <span className="text-xs font-medium text-gray-700">{a.label}</span>
          </a>
        ))}
      </div>

      {/* Active Contracts */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Contracts</h2>
        {data?.active_contracts && data.active_contracts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Value</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">End Date</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.active_contracts.map((c) => {
                  const daysLeft = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                      <td className="px-4 py-3 text-gray-600">{c.vendor}</td>
                      <td className="px-4 py-3 text-right">ZMW {c.value.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {new Date(c.end_date).toLocaleDateString()}
                        {daysLeft <= 30 && <span className="ml-1 text-xs text-red-500">({daysLeft}d)</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.status === 'active' ? 'bg-green-100 text-green-700' :
                          c.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{c.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-gray-400 text-sm text-center py-8">No active contracts</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Milestones */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Milestones</h2>
          {data?.upcoming_milestones && data.upcoming_milestones.length > 0 ? (
            <div className="space-y-4">
              {data.upcoming_milestones.map((m) => (
                <div key={m.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 text-sm">{m.title}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      m.days_remaining <= 7 ? 'bg-red-100 text-red-700' :
                      m.days_remaining <= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>{m.days_remaining}d left</span>
                  </div>
                  <p className="text-xs text-gray-500">{m.contract}</p>
                  <p className="text-xs text-gray-400 mt-1">Due: {new Date(m.due_date).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm text-center py-8">No upcoming milestones</p>}
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Alerts</h2>
          {data?.alerts && data.alerts.length > 0 ? (
            <div className="space-y-3">
              {data.alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                  a.severity === 'high' ? 'border-red-200 bg-red-50' :
                  a.severity === 'medium' ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50'
                }`}>
                  <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    a.severity === 'high' ? 'bg-red-500' :
                    a.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.type}</p>
                    <p className="text-xs text-gray-600">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm text-center py-8">No alerts</p>}
        </div>
      </div>
    </div>
  );
};

export default ContractManagerDashboard;

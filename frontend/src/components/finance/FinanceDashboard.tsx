import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchFinanceDashboard } from '../../api/dashboards';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';

const FinanceDashboard: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['financeDashboard'],
    queryFn: fetchFinanceDashboard,
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-sm text-gray-500">Budget utilization and payment management</p>
        </div>
        <div className="flex gap-3">
          <Link to="/finance/budgets" className="text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">Budgets</Link>
          <Link to="/finance/invoices" className="text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">Invoices</Link>
          <Link to="/finance/grns" className="text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">GRNs</Link>
          <Link to="/finance/payments" className="text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">Payments</Link>
          <Link to="/finance/letters-of-credit" className="text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">LCs</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">Total Budget</p>
          <p className="text-2xl font-bold text-gray-900">{data?.total_budget?.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">Total Spent</p>
          <p className="text-2xl font-bold text-orange-600">{data?.total_spent?.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500">Remaining</p>
          <p className="text-2xl font-bold text-green-600">{data?.total_remaining?.toLocaleString()}</p>
        </div>
      </div>

      {data?.budget_utilization && data.budget_utilization.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Utilization</h2>
          <div className="space-y-4">
            {data.budget_utilization.map((b: any) => (
              <div key={b.code}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-900">{b.code} - {b.description}</span>
                  <span className="text-gray-500">{b.spent?.toLocaleString()} / {b.allocated?.toLocaleString()} ({b.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full ${b.percentage > 90 ? 'bg-red-500' : b.percentage > 70 ? 'bg-yellow-500' : 'bg-zammsa-green'}`} style={{ width: `${Math.min(b.percentage, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.alerts && data.alerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Alerts</h2>
          <div className="space-y-2">
            {data.alerts.map((a: any, i: number) => (
              <div key={i} className={`p-3 rounded-lg text-sm ${a.type === 'warning' ? 'bg-yellow-50 text-yellow-800' : a.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
                {a.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.pending_invoices && data.pending_invoices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pending Invoices</h2>
            <Link to="/finance/invoices" className="text-sm text-zammsa-green hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Invoice #</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Vendor</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Due Date</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Overdue</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.pending_invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{inv.invoice_number}</td>
                    <td className="px-3 py-2">{inv.vendor}</td>
                    <td className="px-3 py-2 text-right">{inv.amount?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{new Date(inv.due_date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-right">{inv.days_overdue > 0 ? `${inv.days_overdue}d` : '-'}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceDashboard;

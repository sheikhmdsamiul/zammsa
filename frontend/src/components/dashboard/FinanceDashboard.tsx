import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { fetchFinanceDashboard } from '../../api/dashboards';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ExportButton } from '../common/ExportButton';
import { useAppSelector } from '../../hooks/useRedux';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { 
  CurrencyDollarIcon, CashIcon, CalculatorIcon, ExclamationIcon,
  TrendingDownIcon, OfficeBuildingIcon, DocumentTextIcon, CreditCardIcon
} from '@heroicons/react/outline';

const FinanceDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const [pollInterval] = useState(30000);

  const { data, isLoading } = useQuery({
    queryKey: ['financeDashboard'],
    queryFn: fetchFinanceDashboard,
    refetchInterval: pollInterval,
  });

  if (isLoading) return <LoadingSpinner />;

  const progressColor = (pct: number) => {
    if (pct >= 90) return 'bg-rose-500 shadow-rose-100';
    if (pct >= 75) return 'bg-amber-500 shadow-amber-100';
    return 'bg-emerald-500 shadow-emerald-100';
  };

  return (
    <div className="pb-12">
      <PageHeader 
        title="Finance Control"
        description="Oversee budgets, expenditures, and payment pipelines."
        actions={
          <div className="flex items-center gap-3">
            <ExportButton data={data?.budget_utilization || data?.pending_invoices || []} filename="finance-dashboard" />
            <div className="px-3 py-1 bg-zammsa-green/10 border border-zammsa-green/20 rounded-lg">
               <span className="text-[10px] font-black text-zammsa-green uppercase tracking-widest">Fiscal Year 2026/27</span>
            </div>
          </div>
        }
      />

      {/* Budget Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <StatCard 
          label="Total Budget"
          value={`ZMW ${(data?.total_budget ?? 0).toLocaleString()}`}
          icon={<CalculatorIcon className="w-6 h-6" />}
          color="blue"
          description="Approved annual allocation"
        />
        <StatCard 
          label="Total Spent"
          value={`ZMW ${(data?.total_spent ?? 0).toLocaleString()}`}
          icon={<CashIcon className="w-6 h-6" />}
          color="orange"
          description="Confirmed expenditures"
        />
        <StatCard 
          label="Remaining"
          value={`ZMW ${(data?.total_remaining ?? 0).toLocaleString()}`}
          icon={<CurrencyDollarIcon className="w-6 h-6" />}
          color="green"
          description="Available for disbursement"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Budget Utilization Progress Bars */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Budget Utilization</h2>
            <TrendingDownIcon className="w-5 h-5 text-gray-200" />
          </div>
          {data?.budget_utilization && data.budget_utilization.length > 0 ? (
            <div className="space-y-6">
              {data.budget_utilization.map((b) => (
                <div key={b.code} className="group">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">{b.code}</span>
                      <span className="text-sm font-bold text-gray-800">{b.description}</span>
                    </div>
                    <div className="text-right">
                       <span className="text-sm font-black text-gray-900">{b.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${progressColor(b.percentage)}`} 
                      style={{ width: `${Math.min(b.percentage, 100)}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-gray-400">Spent: ZMW {b.spent.toLocaleString()}</span>
                    <span className="text-zammsa-green">Remain: ZMW {b.remaining.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 italic text-xs">No budget tracking data</div>
          )}
        </div>

        {/* Payment Queue Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Payment Pipeline</h2>
            <CreditCardIcon className="w-5 h-5 text-gray-200" />
          </div>
          {data?.payment_queue && data.payment_queue.length > 0 ? (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-100 before:to-transparent">
              {data.payment_queue.map((pq) => (
                <div key={pq.id} className="relative flex items-center gap-4 group">
                  <div className={`w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-xs font-black z-10 transition-all ${
                    pq.priority === 'high' ? 'text-rose-600 border-rose-100' : pq.priority === 'medium' ? 'text-amber-600 border-amber-100' : 'text-sky-600 border-sky-100'
                  }`}>
                    <span className="text-[10px] uppercase tracking-tighter">{pq.priority.slice(0, 3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                       <p className="text-sm font-bold text-gray-800 truncate">{pq.invoice}</p>
                       <p className="text-sm font-black text-gray-900 whitespace-nowrap">ZMW {pq.amount.toLocaleString()}</p>
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Requested: {new Date(pq.requested_at).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 italic text-xs">Payment queue is empty</div>
          )}
        </div>
      </div>

      {/* Pending Invoices Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pending Invoices</h2>
          <DocumentTextIcon className="w-5 h-5 text-gray-200" />
        </div>
        
        {data?.pending_invoices && data.pending_invoices.length > 0 ? (
          <div className="overflow-x-auto -mx-6">
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Invoice Ref</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Aging</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.pending_invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{inv.invoice_number}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-500">{inv.vendor}</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-gray-900">ZMW {inv.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg ${
                        inv.days_overdue > 30 ? 'bg-rose-50 text-rose-600 shadow-sm shadow-rose-100' :
                        inv.days_overdue > 15 ? 'bg-amber-50 text-amber-600 shadow-sm shadow-amber-100' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {inv.days_overdue} DAYS
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400 italic text-xs">No pending invoices for review</div>
        )}
      </div>

      {/* Department Breakdown Bar Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <OfficeBuildingIcon className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Spending by Unit</h2>
                <p className="text-sm font-bold text-gray-900">Departmental Budget Breakdown</p>
             </div>
          </div>
        </div>
        {data?.department_breakdown && data.department_breakdown.length > 0 ? (
          <div className="h-[350px] -ml-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.department_breakdown} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="department" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: '800', fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: '800', fill: '#94a3b8' }}
                />
                <Tooltip 
                   cursor={{ fill: '#f8fafc' }}
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="allocated" name="Allocated" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="spent" name="Spent" fill="#0f766e" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400 italic text-xs">No departmental spending data available</div>
        )}
      </div>

      {/* High Priority Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="mt-8 bg-rose-50 border border-rose-100 rounded-2xl p-6 shadow-lg shadow-rose-100/50">
          <div className="flex items-center gap-2 mb-4">
             <ExclamationIcon className="w-5 h-5 text-rose-600" />
             <h2 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">Budget Violations & Alerts</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/50 p-4 rounded-xl border border-rose-100">
                <div className={`w-2 h-2 rounded-full shrink-0 animate-ping ${a.type === 'critical' ? 'bg-rose-600' : 'bg-amber-500'}`} />
                <span className="text-sm font-bold text-gray-800 leading-tight">{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceDashboard;

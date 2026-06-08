import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatContractValue, formatDate } from './contractUtils';
import {
  CashIcon, ClipboardListIcon, ExclamationIcon,
  CheckCircleIcon, ArrowLeftIcon,
} from '@heroicons/react/outline';

const ExecutionDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['contract-execution-dashboard', id],
    queryFn: () => vendorApi.contracts.executionDashboard(id!),
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (error || !data) return (
    <div className="max-w-4xl mx-auto py-12 text-center">
      <p className="text-gray-500">Failed to load execution data</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/contracts/${id}`} className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contract Execution</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data.contract_number} — {data.title}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Value</p>
            <p className="text-lg font-black text-gray-900">{formatContractValue(data.value, data.currency)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Paid</p>
            <p className="text-lg font-black text-blue-600">{formatContractValue(data.payments_to_date, data.currency)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Retained</p>
            <p className="text-lg font-black text-amber-600">{formatContractValue(data.retained_to_date, data.currency)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Balance</p>
            <p className="text-lg font-black text-zammsa-green">{formatContractValue(data.balance, data.currency)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Supplier</p>
            <p className="text-sm font-black text-gray-900 truncate">{data.supplier}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Status</p>
            <StatusBadge status={data.status} />
          </div>
          {data.po_number && (
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">PO Number</p>
              <p className="text-sm font-black text-gray-900 truncate">{data.po_number}</p>
            </div>
          )}
        </div>
      </div>

      {data.shortage_count > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationIcon className="w-6 h-6 text-rose-600" />
            <h2 className="text-lg font-bold text-rose-900">Delivery Shortages ({data.shortage_count})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rose-200">
                  <th className="text-left py-2 px-3 font-semibold text-rose-800">GRN</th>
                  <th className="text-left py-2 px-3 font-semibold text-rose-800">Item</th>
                  <th className="text-right py-2 px-3 font-semibold text-rose-800">Ordered</th>
                  <th className="text-right py-2 px-3 font-semibold text-rose-800">Received</th>
                  <th className="text-right py-2 px-3 font-semibold text-rose-800">Shortage</th>
                </tr>
              </thead>
              <tbody>
                {data.shortages.map((s, i) => (
                  <tr key={i} className="border-b border-rose-100">
                    <td className="py-2 px-3 text-rose-700">{s.grn_number}</td>
                    <td className="py-2 px-3">
                      <p className="font-medium text-gray-900">{s.item_name}</p>
                      {s.item_code && <p className="text-xs text-gray-400">{s.item_code}</p>}
                    </td>
                    <td className="py-2 px-3 text-right">{s.ordered}</td>
                    <td className="py-2 px-3 text-right">{s.received}</td>
                    <td className="py-2 px-3 text-right font-bold text-rose-600">{s.shortage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardListIcon className="w-5 h-5 text-zammsa-green" />
            <h2 className="text-lg font-bold text-gray-900">Milestones</h2>
          </div>
          {data.milestones.length === 0 ? (
            <p className="text-sm text-gray-400">No milestones defined</p>
          ) : (
            <div className="space-y-3">
              {data.milestones.map((m) => (
                <div key={m.milestone_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.milestone_name}</p>
                    <p className="text-xs text-gray-500">{formatDate(m.due_date)}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <CashIcon className="w-5 h-5 text-zammsa-green" />
            <h2 className="text-lg font-bold text-gray-900">Invoices</h2>
          </div>
          {data.invoices.length === 0 ? (
            <p className="text-sm text-gray-400">No invoices submitted yet</p>
          ) : (
            <div className="space-y-3">
              {data.invoices.map((inv) => (
                <div key={inv.invoice_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.invoice_number}</p>
                    <p className="text-xs text-gray-500">{formatDate(inv.submitted_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">K {inv.amount.toLocaleString()}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircleIcon className="w-5 h-5 text-zammsa-green" />
          <h2 className="text-lg font-bold text-gray-900">Deliveries</h2>
        </div>
        {data.deliveries.length === 0 ? (
          <p className="text-sm text-gray-400">No deliveries recorded yet</p>
        ) : (
          <div className="space-y-4">
            {data.deliveries.map((d) => (
              <div key={d.grn_id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{d.grn_number}</p>
                    <p className="text-xs text-gray-500">{d.item_description} — {formatDate(d.received_date)}</p>
                  </div>
                  <p className="font-bold text-gray-900">K {d.total_amount.toLocaleString()}</p>
                </div>
                {d.line_items.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-gray-100">
                        <th className="text-left py-2 text-xs font-semibold text-gray-500">Item</th>
                        <th className="text-right py-2 text-xs font-semibold text-gray-500">Ordered</th>
                        <th className="text-right py-2 text-xs font-semibold text-gray-500">Received</th>
                        <th className="text-right py-2 text-xs font-semibold text-gray-500">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.line_items.map((li, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="py-2">
                            <span className="font-medium text-gray-800">{li.item_name}</span>
                            {li.item_code && <span className="text-xs text-gray-400 ml-2">({li.item_code})</span>}
                          </td>
                          <td className="py-2 text-right">{li.quantity_ordered}</td>
                          <td className="py-2 text-right">{li.quantity_received}</td>
                          <td className="py-2 text-right">K {li.unit_price.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutionDashboard;

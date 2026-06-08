import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { Contract, ExecutionDashboard, SupplierPerformance } from '../../types';
import {
  ArrowLeftIcon, CheckCircleIcon, XCircleIcon, ClockIcon,
  DocumentTextIcon, TruckIcon, CashIcon, ChartBarIcon,
  ShieldCheckIcon, ExclamationIcon, StarIcon,
} from '@heroicons/react/outline';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-blue-100 text-blue-800',
  terminated: 'bg-rose-100 text-rose-800',
  expired: 'bg-gray-100 text-gray-800',
  pending: 'bg-amber-100 text-amber-800',
  suspended: 'bg-purple-100 text-purple-800',
};

const milestoneStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircleIcon className="w-5 h-5 text-emerald-500" />;
    case 'pending': return <ClockIcon className="w-5 h-5 text-amber-400" />;
    case 'delivered': return <TruckIcon className="w-5 h-5 text-blue-500" />;
    default: return <ClockIcon className="w-5 h-5 text-gray-400" />;
  }
};

const invoiceStatusColor: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-800',
  pending_matching: 'bg-amber-100 text-amber-800',
  pending_approval: 'bg-purple-100 text-purple-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  paid: 'bg-emerald-100 text-emerald-800',
};

const formatValue = (v: number, c?: string) =>
  `${c || 'ZMW'} ${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const SupplierExecutionTrack: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: contract, isLoading: loadingContract } = useQuery({
    queryKey: ['vendor-contract', id],
    queryFn: () => vendorApi.contracts.get(id!),
    enabled: !!id,
  });

  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['vendor-contract-execution', id],
    queryFn: () => vendorApi.contracts.executionDashboard(id!),
    enabled: !!id,
  });

  const isLoading = loadingContract || loadingDashboard;
  const c = contract;
  const d = dashboard;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-10 w-10 border-4 border-zammsa-green border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!c) {
    return (
      <div className="text-center py-20">
        <ExclamationIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">Contract not found</p>
        <Link to="/vendor/contracts" className="text-zammsa-green font-bold mt-2 inline-block">Back to contracts</Link>
      </div>
    );
  }

  const performances = (c.supplier_performances || []) as SupplierPerformance[];
  const hasShortages = d && d.shortages && d.shortages.length > 0;
  const bond = c.performance_bond;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/vendor/contracts" className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Execution Track</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
              {c.status?.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{c.contract_number} — {c.title}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CashIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Contract Value</p>
              <p className="text-lg font-bold text-gray-900">{formatValue(c.value, c.currency)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <CashIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Paid to Date</p>
              <p className="text-lg font-bold text-gray-900">{d ? formatValue(d.payments_to_date, d.currency) : '—'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <CashIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Retained</p>
              <p className="text-lg font-bold text-gray-900">{d ? formatValue(d.retained_to_date, d.currency) : '—'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <CashIcon className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Balance</p>
              <p className="text-lg font-bold text-gray-900">{d ? formatValue(d.balance, d.currency) : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — delivery & shortages */}
        <div className="lg:col-span-2 space-y-6">

          {/* Delivery Records */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <TruckIcon className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-bold text-gray-900">Delivery Records</h2>
              {(d?.deliveries?.length || 0) > 0 && (
                <span className="ml-auto text-xs text-gray-400">{d!.deliveries.length} delivery(ies)</span>
              )}
            </div>
            {(!d || d.deliveries.length === 0) ? (
              <p className="text-gray-400 text-sm py-6 text-center">No deliveries recorded yet</p>
            ) : (
              <div className="space-y-4">
                {d.deliveries.map((del) => (
                  <div key={del.grn_id} className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-bold text-gray-900">{del.grn_number}</span>
                        <span className="text-xs text-gray-500 ml-3">{new Date(del.received_date).toLocaleDateString()}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{formatValue(del.total_amount)}</span>
                    </div>
                    {del.line_items && del.line_items.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-100">
                              <th className="text-left py-1 font-semibold">Item</th>
                              <th className="text-right py-1 font-semibold">Ordered</th>
                              <th className="text-right py-1 font-semibold">Delivered</th>
                              <th className="text-right py-1 font-semibold">Unit Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {del.line_items.map((li, i) => (
                              <tr key={i} className="border-b border-gray-50">
                                <td className="py-2 text-gray-700">
                                  <span className="font-medium">{li.item_name}</span>
                                  {li.item_code && <span className="text-gray-400 ml-1">({li.item_code})</span>}
                                </td>
                                <td className="py-2 text-right text-gray-600">{li.quantity_ordered}</td>
                                <td className="py-2 text-right text-gray-900 font-medium">{li.quantity_received}</td>
                                <td className="py-2 text-right text-gray-600">{formatValue(li.unit_price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link to={`/vendor/deliveries/new/${c.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-zammsa-green text-zammsa-green rounded-xl text-sm font-bold hover:bg-zammsa-green/5">
                <TruckIcon className="w-4 h-4" /> Log New Delivery
              </Link>
            </div>
          </div>

          {/* Shortages */}
          {hasShortages && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <ExclamationIcon className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-gray-900">Delivery Shortages</h2>
                <span className="ml-auto text-xs font-bold text-amber-600">{d!.shortage_count} item(s) short</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="text-left py-2 font-semibold">Item</th>
                      <th className="text-right py-2 font-semibold">Ordered</th>
                      <th className="text-right py-2 font-semibold">Received</th>
                      <th className="text-right py-2 font-semibold text-rose-600">Shortage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d!.shortages.map((s, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-3 text-gray-700">
                          <span className="font-medium">{s.item_name}</span>
                          <span className="text-gray-400 ml-2 text-xs">({s.item_code})</span>
                        </td>
                        <td className="py-3 text-right text-gray-600">{s.ordered}</td>
                        <td className="py-3 text-right text-gray-600">{s.received}</td>
                        <td className="py-3 text-right font-bold text-rose-600">{s.shortage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Milestones */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <ClockIcon className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-bold text-gray-900">Milestones</h2>
            </div>
            {(d && d.milestones.length > 0) ? (
              <div className="space-y-3">
                {d.milestones.map((m, i) => (
                  <div key={m.milestone_id || i} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                    {milestoneStatusIcon(m.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.milestone_name}</p>
                      <p className="text-xs text-gray-500">Due: {new Date(m.due_date).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      m.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      m.status === 'delivered' ? 'bg-blue-50 text-blue-700' :
                      m.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>{m.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm py-6 text-center">No milestones defined</p>
            )}
          </div>
        </div>

        {/* Right column — performance, invoices, security */}
        <div className="space-y-6">

          {/* Performance Evaluations */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <StarIcon className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-bold text-gray-900">Performance</h2>
            </div>
            {performances.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">No evaluations yet</p>
            ) : (
              <div className="space-y-4">
                {performances.map((p) => (
                  <div key={p.performance_id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">{new Date(p.evaluation_date).toLocaleDateString()}</span>
                      <span className={`text-sm font-bold ${p.overall_score >= 80 ? 'text-emerald-600' : p.overall_score >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {p.overall_score}%
                      </span>
                    </div>
                    {Object.keys(p.metrics || {}).length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {Object.entries(p.metrics).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${
                                  val >= 80 ? 'bg-emerald-500' : val >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                }`} style={{ width: `${val}%` }} />
                              </div>
                              <span className="font-semibold text-gray-700 w-6 text-right">{val}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.improvement_notes && (
                      <p className="text-xs text-gray-500 mt-2 italic">{p.improvement_notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoice History */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <DocumentTextIcon className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-bold text-gray-900">Invoices</h2>
              {(d?.invoices?.length || 0) > 0 && (
                <span className="ml-auto text-xs text-gray-400">{d!.invoices.length}</span>
              )}
            </div>
            {(!d || d.invoices.length === 0) ? (
              <p className="text-gray-400 text-sm py-4 text-center">No invoices submitted</p>
            ) : (
              <div className="space-y-2">
                {d.invoices.map((inv) => (
                  <div key={inv.invoice_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-500">{new Date(inv.submitted_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatValue(inv.amount)}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${invoiceStatusColor[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                        {inv.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link to={`/vendor/invoices/new/${c.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-zammsa-green text-zammsa-green rounded-xl text-sm font-bold hover:bg-zammsa-green/5">
                <DocumentTextIcon className="w-4 h-4" /> Submit Invoice
              </Link>
            </div>
          </div>

          {/* Performance Security */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheckIcon className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-bold text-gray-900">Security Bond</h2>
            </div>
            {c.performance_security_required ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Uploaded</span>
                  {c.performance_security_uploaded ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircleIcon className="w-4 h-4" /> Yes</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 font-bold"><XCircleIcon className="w-4 h-4" /> No</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Validated</span>
                  {c.performance_security_validated ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircleIcon className="w-4 h-4" /> Yes</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 font-bold"><XCircleIcon className="w-4 h-4" /> No</span>
                  )}
                </div>
                {bond && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Amount</span>
                      <span className="font-bold text-gray-900">{formatValue(Number(bond.amount) || 0)}</span>
                    </div>
                    {bond.expiry_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Expires</span>
                        <span className="font-medium text-gray-900">{new Date(bond.expiry_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {bond.issuing_bank && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Bank</span>
                        <span className="font-medium text-gray-900">{bond.issuing_bank}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm py-4 text-center">Not required</p>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <ChartBarIcon className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-bold text-gray-900">Quick Stats</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Contract Period</span>
                <span className="font-medium text-gray-900">
                  {new Date(c.start_date).toLocaleDateString()} — {new Date(c.end_date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Delivery Notes</span>
                <span className="font-bold text-gray-900">{d?.deliveries?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Invoices Submitted</span>
                <span className="font-bold text-gray-900">{d?.invoices?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Milestones</span>
                <span className="font-bold text-gray-900">{d?.milestones?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Performance Evaluations</span>
                <span className="font-bold text-gray-900">{performances.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Payment Received</span>
                <span className="font-bold text-gray-900">{d ? formatValue(d.payments_to_date, d.currency) : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierExecutionTrack;

import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import ContractOperationalPhases from './ContractOperationalPhases';
import { Contract } from '../../types';
import {
  formatContractValue,
  formatDate,
  getWorkflowSteps,
  getNextAction,
  standstillProgress,
  CONTRACT_TYPE_LABELS,
  daysUntil,
} from './contractUtils';
import {
  ArrowLeftIcon,
  CalendarIcon,
  CashIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ExclamationIcon,
  CheckCircleIcon,
  OfficeBuildingIcon,
} from '@heroicons/react/outline';

type TabId = 'overview' | 'milestones' | 'amendments' | 'appeals' | 'security';

const TONE_STYLES = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
};

const ContractDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { data: contract, isLoading, isError } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner className="py-24" />;

  if (isError || !contract) {
    return (
      <div className="max-w-3xl mx-auto py-24 text-center">
        <ExclamationIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Contract not found</h2>
        <p className="text-gray-500 mt-2">This contract may have been removed or you lack access.</p>
        <Link to="/contracts" className="inline-block mt-6 text-zammsa-green font-bold hover:underline">
          Back to contracts
        </Link>
      </div>
    );
  }

  const c = contract as Contract;
  const nextAction = getNextAction(c);
  const workflowSteps = getWorkflowSteps(c);
  const standstillPct = standstillProgress(c);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'milestones', label: 'Milestones', count: c.milestones?.length },
    { id: 'amendments', label: 'Amendments', count: c.amendments?.length },
    { id: 'appeals', label: 'Appeals', count: c.appeals?.length },
    { id: 'security', label: 'Security', count: c.securities?.length },
  ];

  const quickActions = [
    {
      show: ['draft', 'pending_acceptance'].includes(c.status) && !c.award_notice_published,
      label: 'Standstill',
      path: `/contracts/${id}/standstill`,
      className: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    },
    {
      show: true,
      label: 'Signing & activation',
      path: `/contracts/${id}/signing`,
      className: 'bg-zammsa-green hover:bg-zammsa-green-dark text-white',
    },
    {
      show: c.status === 'active',
      label: 'Amendments',
      path: `/contracts/${id}/amendments`,
      className: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    {
      show: c.status === 'active',
      label: 'Execution dashboard',
      path: `/contracts/${id}/execution`,
      className: 'bg-violet-600 hover:bg-violet-700 text-white',
    },
    {
      show: c.status === 'active',
      label: 'Delivery manager',
      path: `/contracts/${id}/delivery`,
      className: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    },
    {
      show: c.status === 'active',
      label: 'Liquidated damages',
      path: `/contracts/${id}/ld`,
      className: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    {
      show: ['active', 'completed'].includes(c.status),
      label: 'Performance',
      path: `/contracts/${id}/performance`,
      className: 'bg-purple-600 hover:bg-purple-700 text-white',
    },
    {
      show: ['active', 'completed'].includes(c.status),
      label: 'Close contract',
      path: `/contracts/${id}/closure`,
      className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    {
      show: ['completed', 'closed'].includes(c.status),
      label: 'Archive',
      path: `/contracts/${id}/archive`,
      className: 'bg-gray-600 hover:bg-gray-700 text-white',
    },
    {
      show: c.completed_at != null,
      label: 'Release Retention',
      path: `/contracts/${id}/retention-release`,
      className: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    },
  ].filter((a) => a.show);

  return (
    <div className="pb-12 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title={c.title || c.contract_number}
        description={`${c.contract_number} · ${c.vendor_name || 'Supplier TBD'}`}
        breadcrumbs={[
          { label: 'Contracts', path: '/contracts' },
          { label: c.contract_number },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/contracts"
              className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 transition-colors"
              aria-label="Back to contracts"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <StatusBadge status={c.status} className="py-2 px-4" />
          </div>
        }
      />

      {nextAction && (
        <div
          className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${TONE_STYLES[nextAction.tone]}`}
        >
          <div>
            <p className="text-sm font-black uppercase tracking-wider opacity-80">Next step</p>
            <h3 className="text-lg font-bold mt-1">{nextAction.title}</h3>
            <p className="text-sm mt-1 opacity-90">{nextAction.description}</p>
          </div>
          {nextAction.path && (
            <button
              type="button"
              onClick={() => navigate(nextAction.path!)}
              className="shrink-0 px-5 py-2.5 bg-white/80 hover:bg-white rounded-xl text-sm font-bold shadow-sm border border-current/10"
            >
              Continue
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Contract value"
          value={formatContractValue(c.value, c.currency)}
          icon={<CashIcon className="w-6 h-6" />}
          color="green"
          description={CONTRACT_TYPE_LABELS[c.contract_type as string] || c.contract_type || 'Contract'}
        />
        <StatCard
          label="Contract period"
          value={c.end_date ? `${daysUntil(c.end_date) ?? '—'}d left` : '—'}
          icon={<CalendarIcon className="w-6 h-6" />}
          color="blue"
          description={`${formatDate(c.start_date)} – ${formatDate(c.end_date)}`}
        />
        <StatCard
          label="Signatures"
          value={c.signed_by_vendor && c.signed_by_authority ? 'Complete' : 'Pending'}
          icon={<DocumentTextIcon className="w-6 h-6" />}
          color={c.signed_by_vendor && c.signed_by_authority ? 'green' : 'orange'}
          description={
            c.signed_by_vendor
              ? `Supplier · Authority ${c.signed_by_authority ? 'yes' : 'no'}`
              : 'Awaiting supplier'
          }
        />
        <StatCard
          label="Performance bond"
          value={
            !c.requires_performance_bond
              ? 'Not required'
              : c.performance_security_validated
                ? 'Validated'
                : 'Required'
          }
          icon={<ShieldCheckIcon className="w-6 h-6" />}
          color={c.performance_security_validated ? 'green' : c.requires_performance_bond ? 'orange' : 'gray'}
          description={
            c.requires_performance_bond
              ? c.performance_security_uploaded
                ? 'Uploaded — pending validation'
                : 'Awaiting upload'
              : 'Value ≤ K1M threshold'
          }
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Contract lifecycle</h2>
        <div className="flex flex-wrap gap-2 md:gap-0 md:flex-nowrap md:items-center">
          {workflowSteps.map((step, i) => (
            <React.Fragment key={step.key}>
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    step.state === 'complete'
                      ? 'bg-zammsa-green text-white'
                      : step.state === 'current'
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {step.state === 'complete' ? <CheckCircleIcon className="w-5 h-5" /> : i + 1}
                </div>
                <span
                  className={`text-xs font-bold truncate ${
                    step.state === 'current' ? 'text-indigo-700' : step.state === 'complete' ? 'text-gray-800' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < workflowSteps.length - 1 && (
                <div className="hidden md:block flex-1 h-0.5 mx-2 bg-gray-100 min-w-[12px]" />
              )}
            </React.Fragment>
          ))}
        </div>
        {c.award_notice_published && c.status === 'draft' && (
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
              <span>Standstill progress</span>
              <span>{standstillPct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-zammsa-green transition-all"
                style={{ width: `${standstillPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Ends {formatDate(c.waiting_period_end)}
              {daysUntil(c.waiting_period_end) != null && daysUntil(c.waiting_period_end)! > 0
                ? ` (${daysUntil(c.waiting_period_end)} working days remaining)`
                : ' — ready for signing'}
            </p>
          </div>
        )}
      </div>

      {quickActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action.path}
              type="button"
              onClick={() => navigate(action.path)}
              className={`px-4 py-2 rounded-xl text-sm font-bold ${action.className}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {c.operational_phases?.length ? (
        <ContractOperationalPhases contract={c} title="Execution and closure phases" />
      ) : null}

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Contract sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-zammsa-green text-zammsa-green'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                Contract information
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
                <div>
                  <dt className="text-gray-500 font-medium">Contract number</dt>
                  <dd className="font-mono font-bold text-gray-900 mt-0.5">{c.contract_number}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Status</dt>
                  <dd className="mt-1">
                    <StatusBadge status={c.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Supplier</dt>
                  <dd className="font-medium text-gray-900 mt-0.5 flex items-center gap-2">
                    <OfficeBuildingIcon className="w-4 h-4 text-gray-400" />
                    {c.vendor_name || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Solicitation</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">
                    {(c as Contract & { solicitation_number?: string }).solicitation_number ||
                      c.solicitation ||
                      '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Award date</dt>
                  <dd className="font-medium mt-0.5">{formatDate(c.award_date)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Created</dt>
                  <dd className="font-medium mt-0.5">{formatDate(c.created_at)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 font-medium">Title</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{c.title || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Purchase Orders</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">
                    {c.purchase_orders?.length
                      ? c.purchase_orders.map((po) => po.po_number).join(', ')
                      : '—'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                Award & standstill
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Award notice published</dt>
                  <dd className="font-medium">{c.award_notice_published ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Published at</dt>
                  <dd className="font-medium">
                    {c.award_notice_published_at
                      ? new Date(c.award_notice_published_at).toLocaleString()
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Standstill period</dt>
                  <dd className="font-medium">{c.waiting_period_days} working days</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Standstill window</dt>
                  <dd className="font-medium">
                    {formatDate(c.waiting_period_start)} – {formatDate(c.waiting_period_end)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Appeal pending</dt>
                  <dd className="font-medium">{c.appeal_pending ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
            </section>

            {c.purchase_orders && c.purchase_orders.length > 0 && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                  Purchase Order &amp; Deliveries
                </h2>

                {/* PO summary */}
                {c.purchase_orders.map((po) => (
                  <div key={po.id} className="mb-6 pb-6 border-b border-gray-100 last:border-b-0 last:mb-0 last:pb-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-mono font-bold text-gray-900">{po.po_number}</span>
                        <StatusBadge status={po.status} className="ml-2" />
                      </div>
                      <span className="text-sm font-bold text-gray-700">
                        Total: {(po.total_amount).toLocaleString('en-US', { style: 'currency', currency: c.currency || 'ZMW' })}
                      </span>
                    </div>

                    {/* PO line items with delivery progress */}
                    {c.delivery_progress && c.delivery_progress.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                              <th className="pb-2 pr-3 font-semibold">Item</th>
                              <th className="pb-2 pr-3 font-semibold text-right">Ordered</th>
                              <th className="pb-2 pr-3 font-semibold text-right">Received</th>
                              <th className="pb-2 pr-3 font-semibold text-right">Unit Price</th>
                              <th className="pb-2 pr-3 font-semibold text-right">Delivered</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.delivery_progress.map((item, idx) => (
                              <tr key={idx} className="border-b border-gray-50 last:border-b-0">
                                <td className="py-2.5 pr-3">
                                  <p className="font-medium text-gray-900">{item.item_name || item.item_code}</p>
                                  {item.item_code && <p className="text-xs text-gray-400">{item.item_code}</p>}
                                </td>
                                <td className="py-2.5 pr-3 text-right font-medium text-gray-700">{item.quantity_ordered}</td>
                                <td className="py-2.5 pr-3 text-right font-medium text-gray-700">{item.quantity_received}</td>
                                <td className="py-2.5 pr-3 text-right font-medium text-gray-700">
                                  {(item.unit_price).toLocaleString('en-US', { style: 'currency', currency: c.currency || 'ZMW' })}
                                </td>
                                <td className="py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-20 bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${
                                          item.progress_pct >= 100
                                            ? 'bg-emerald-500'
                                            : item.progress_pct > 0
                                            ? 'bg-amber-400'
                                            : 'bg-gray-200'
                                        }`}
                                        style={{ width: `${Math.min(item.progress_pct, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-bold text-gray-600 min-w-[3rem] text-right">
                                      {item.progress_pct}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No line items on this purchase order.</p>
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
                Signatures
              </h2>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between gap-2">
                  <span className="text-gray-500">Supplier</span>
                  <span className="font-medium text-right">
                    {c.signed_by_vendor
                      ? `Signed ${formatDate(c.signed_vendor_date)}`
                      : 'Not signed'}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-gray-500">Authority (DG)</span>
                  <span className="font-medium text-right">
                    {c.signed_by_authority
                      ? `Signed ${formatDate(c.signed_authority_date)}`
                      : 'Not signed'}
                  </span>
                </li>
              </ul>
            </section>

            {c.contract_document && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
                  Document
                </h2>
                <a
                  href={c.contract_document}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-zammsa-green hover:underline"
                >
                  <DocumentTextIcon className="w-5 h-5" />
                  Download contract PDF
                </a>
              </section>
            )}

            {(c.legal_hold || c.archived_at) && (
              <section className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-sm">
                {c.legal_hold && <p className="font-bold text-amber-800">Legal hold active</p>}
                {c.archived_at && (
                  <p className="text-amber-700 mt-1">Archived {formatDate(c.archived_at)}</p>
                )}
              </section>
            )}
          </aside>
        </div>
      )}

      {activeTab === 'milestones' && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Milestones</h2>
            <Link
              to="/contracts/milestones"
              className="text-sm font-bold text-zammsa-green hover:underline"
            >
              View all milestones
            </Link>
          </div>
          {!c.milestones?.length ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              No milestones assigned. Contract manager can add milestones when assigning the contract.
            </p>
          ) : (
            <div className="space-y-3">
              {c.milestones
                .slice()
                .sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0))
                .map((m) => {
                  const plannedDate = m.planned_date || m.due_date;
                  const variance = m.variance_days ?? (m.actual_date && plannedDate ? 
                    Math.ceil((new Date(m.actual_date).getTime() - new Date(plannedDate).getTime()) / (1000 * 60 * 60 * 24)) : null);
                  const varianceFlag = m.variance_flag;
                  
                  const getVarianceColor = (flag?: string) => {
                    if (!flag) return 'bg-gray-100 text-gray-600';
                    switch (flag) {
                      case 'green': return 'bg-emerald-50 text-emerald-700';
                      case 'yellow': return 'bg-amber-50 text-amber-700';
                      case 'orange': return 'bg-orange-50 text-orange-700';
                      case 'red': return 'bg-rose-50 text-rose-700';
                      default: return 'bg-gray-100 text-gray-600';
                    }
                  };
                  
                  const getVarianceLabel = (days?: number | null, flag?: string) => {
                    if (days === null || days === undefined) return '—';
                    if (days <= 0) return `On time (${days}d)`;
                    if (days <= 7) return `${days}d late`;
                    if (days <= 14) return `${days}d late`;
                    return `${days}d late`;
                  };
                  
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{m.title || m.milestone_name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Planned: {formatDate(plannedDate)}
                          {m.actual_date && <span className="ml-2">| Actual: {formatDate(m.actual_date)}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {variance !== null && variance !== undefined && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getVarianceColor(varianceFlag)}`}>
                            {getVarianceLabel(variance, varianceFlag)}
                          </span>
                        )}
                        <StatusBadge status={m.status} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'amendments' && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Amendments</h2>
            {c.status === 'active' && (
              <button
                type="button"
                onClick={() => navigate(`/contracts/${id}/amendments`)}
                className="text-sm font-bold text-zammsa-green hover:underline"
              >
                Create amendment
              </button>
            )}
          </div>
          {!c.amendments?.length ? (
            <p className="text-gray-500 text-sm py-8 text-center">No amendments on this contract.</p>
          ) : (
            <div className="space-y-3">
              {c.amendments.map((a) => (
                <div key={a.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-gray-900">Amendment #{a.amendment_number}</p>
                      <p className="text-sm text-gray-600 mt-1">{a.description}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-500">
                      {a.approved_by ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Impact: {formatContractValue(a.value_change ?? a.financial_impact, c.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'appeals' && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Appeals</h2>
            <Link to="/contracts/appeals" className="text-sm font-bold text-zammsa-green hover:underline">
              Appeals register
            </Link>
          </div>
          {!c.appeals?.length ? (
            <p className="text-gray-500 text-sm py-8 text-center">No appeals filed against this contract.</p>
          ) : (
            <div className="space-y-3">
              {c.appeals.map((a: { id: string; status?: string; grounds?: string; filed_at?: string }) => (
                <div key={a.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={a.status || 'pending'} />
                    <span className="text-xs text-gray-500">{formatDate(a.filed_at)}</span>
                  </div>
                  {a.grounds && <p className="text-sm text-gray-700 mt-2">{a.grounds}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'security' && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Performance security</h2>
            <button
              type="button"
              onClick={() => navigate(`/contracts/${id}/signing`)}
              className="text-sm font-bold text-zammsa-green hover:underline"
            >
              Manage signing & security
            </button>
          </div>
          {!c.requires_performance_bond ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              Performance bond not required (contract value ≤ K1,000,000).
            </p>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <dt className="text-gray-500">Uploaded</dt>
                <dd className="font-medium">{c.performance_security_uploaded ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Validated</dt>
                <dd className="font-medium">{c.performance_security_validated ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          )}
          {c.securities?.length ? (
            <div className="space-y-3">
              {c.securities.map((s) => (
                <div key={s.id || s.security_id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold capitalize">{s.security_type?.replace('_', ' ')}</p>
                      <p className="text-sm text-gray-600">{s.issuing_bank}</p>
                      <p className="text-xs text-gray-500 font-mono mt-1">{s.reference_number}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={s.status} />
                      <p className="text-sm font-bold mt-2">{formatContractValue(s.amount, c.currency)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            c.requires_performance_bond && (
              <p className="text-gray-500 text-sm text-center py-4">No security records uploaded yet.</p>
            )
          )}
        </section>
      )}
    </div>
  );
};

export default ContractDetail;

import React, { useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ContractSigningSteps } from '../contracts/ContractSigningSteps';
import {
  formatContractValue,
  formatDate,
  canSupplierSign,
  canUploadPerformanceSecurity,
  isStandstillExpired,
} from '../contracts/contractUtils';
import { Contract } from '../../types';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon,
  ExclamationIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/outline';

const VendorContractDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: contract, isLoading, isError } = useQuery({
    queryKey: ['vendor-contract', id],
    queryFn: () => vendorApi.contracts.get(id!),
    enabled: !!id,
  });

  const signMutation = useMutation({
    mutationFn: () => vendorApi.contracts.sign(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-contract', id] });
      queryClient.invalidateQueries({ queryKey: ['vendor-contracts'] });
      toast.success('Contract signed successfully. Awaiting Director General countersignature.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to sign contract'),
  });

  const [showSecurityForm, setShowSecurityForm] = useState(false);
  const [securityData, setSecurityData] = useState({
    amount: '',
    issuing_bank: '',
    reference_number: '',
    expiry_date: '',
  });

  const securityMutation = useMutation({
    mutationFn: (data: { amount: number; issuing_bank: string; reference_number?: string; expiry_date?: string }) =>
      vendorApi.contracts.uploadSecurity(id!, { security_type: 'performance', ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-contract', id] });
      toast.success('Performance security submitted. Awaiting validation by ZAMMSA.');
      setShowSecurityForm(false);
      setSecurityData({ amount: '', issuing_bank: '', reference_number: '', expiry_date: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to upload security'),
  });

  const c = contract as Contract | undefined;

  const actionState = useMemo(() => {
    if (!c) return null;
    if (canSupplierSign(c)) return 'sign';
    if (!c.award_notice_published) return 'standstill_pending';
    if (!isStandstillExpired(c)) return 'standstill_active';
    if (!c.signed_by_vendor) return 'sign';
    if (!c.signed_by_authority) return 'awaiting_dg';
    if (canUploadPerformanceSecurity(c)) return 'upload_bond';
    if (c.performance_security_uploaded && !c.performance_security_validated) return 'awaiting_validation';
    if (c.status === 'active') return 'active';
    return 'monitor';
  }, [c]);

  const handleSecuritySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityData.amount || !securityData.issuing_bank) {
      toast.error('Amount and issuing bank are required');
      return;
    }
    if (!securityData.expiry_date) {
      toast.error('Expiry date is required');
      return;
    }
    securityMutation.mutate({
      amount: parseFloat(securityData.amount),
      issuing_bank: securityData.issuing_bank,
      reference_number: securityData.reference_number || undefined,
      expiry_date: securityData.expiry_date,
    });
  };

  if (isLoading) return <LoadingSpinner className="py-24" />;
  if (isError || !c) {
    return (
      <div className="py-24 text-center">
        <p className="text-lg font-bold text-gray-500">Contract not found</p>
        <Link to="/vendor/contracts" className="text-zammsa-green font-bold mt-4 inline-block">
          Back to my contracts
        </Link>
      </div>
    );
  }

  const bondRequired = c.requires_performance_bond || c.performance_security_required;
  const suggestedBond = Math.round((c.value || 0) * 0.05);
  const existingBonds = c.securities?.filter((s) => s.security_type === 'performance') || [];

  return (
    <div className="pb-12 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              to="/vendor/contracts"
              className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{c.title || c.contract_number}</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1 ml-11 font-mono">{c.contract_number}</p>
        </div>
      </div>

      {/* Primary action banner */}
      {actionState === 'sign' && (
        <div className="rounded-2xl border border-zammsa-green/30 bg-zammsa-green/5 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-zammsa-green">Action required</p>
            <h2 className="text-lg font-bold text-gray-900 mt-1">Sign your contract</h2>
            <p className="text-sm text-gray-600 mt-1">
              Standstill is complete. Review the terms below and apply your digital signature.
            </p>
          </div>
          <button
            type="button"
            onClick={() => signMutation.mutate()}
            disabled={signMutation.isPending}
            className="shrink-0 px-8 py-3 bg-zammsa-green text-white rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {signMutation.isPending ? 'Signing...' : 'Sign contract'}
          </button>
        </div>
      )}

      {actionState === 'standstill_pending' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <ExclamationIcon className="w-5 h-5 inline mr-2" />
          Award notice has not been published yet. ZAMMSA will notify you when signing opens.
        </div>
      )}

      {actionState === 'standstill_active' && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <p className="font-bold">Standstill period in progress</p>
          <p className="mt-1">
            Signing opens on or after {formatDate(c.waiting_period_end)}. No action is required from you yet.
          </p>
        </div>
      )}

      {actionState === 'awaiting_dg' && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-900">
          <CheckCircleIcon className="w-5 h-5 inline mr-2 text-indigo-600" />
          You have signed this contract. Waiting for Director General countersignature at ZAMMSA.
        </div>
      )}

      {actionState === 'upload_bond' && (
        <div className="rounded-2xl border border-zammsa-green/30 bg-zammsa-green/5 p-6">
          <p className="text-sm font-black uppercase tracking-wider text-zammsa-green">Action required</p>
          <h2 className="text-lg font-bold text-gray-900 mt-1 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5" />
            Upload performance security
          </h2>
          <p className="text-sm text-gray-600 mt-1 mb-4">
            Required amount: approximately {formatContractValue(suggestedBond, c.currency)} (5% of contract value).
          </p>
          {!showSecurityForm ? (
            <button
              type="button"
              onClick={() => {
                setSecurityData((prev) => ({
                  ...prev,
                  amount: String(suggestedBond),
                }));
                setShowSecurityForm(true);
              }}
              className="px-6 py-2.5 bg-zammsa-green text-white rounded-xl text-sm font-bold"
            >
              Upload performance bond
            </button>
          ) : null}
        </div>
      )}

      {actionState === 'awaiting_validation' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Performance security submitted. ZAMMSA contract management is validating your bond.
        </div>
      )}

      {actionState === 'active' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm font-bold text-emerald-800">Contract is active. You may submit invoices.</p>
          <button
            type="button"
            onClick={() => navigate('/vendor/invoices')}
            className="px-5 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold"
          >
            Go to invoices
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Contract details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Value</dt>
                <dd className="font-bold text-lg">{formatContractValue(c.value, c.currency)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Period</dt>
                <dd className="font-medium">
                  {formatDate(c.start_date)} – {formatDate(c.end_date)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Your signature</dt>
                <dd className="font-medium">
                  {c.signed_by_vendor ? `Signed ${formatDate(c.signed_vendor_date)}` : 'Pending'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Authority signature</dt>
                <dd className="font-medium">
                  {c.signed_by_authority ? `Signed ${formatDate(c.signed_authority_date)}` : 'Pending'}
                </dd>
              </div>
            </dl>
          </section>

          {showSecurityForm && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Performance security details</h2>
              <form onSubmit={handleSecuritySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ZMW) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={securityData.amount}
                    onChange={(e) => setSecurityData((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issuing bank *</label>
                  <input
                    type="text"
                    value={securityData.issuing_bank}
                    onChange={(e) => setSecurityData((prev) => ({ ...prev, issuing_bank: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference number</label>
                  <input
                    type="text"
                    value={securityData.reference_number}
                    onChange={(e) => setSecurityData((prev) => ({ ...prev, reference_number: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry date *</label>
                  <input
                    type="date"
                    value={securityData.expiry_date}
                    onChange={(e) => setSecurityData((prev) => ({ ...prev, expiry_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={securityMutation.isPending}
                    className="px-6 py-2.5 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50"
                  >
                    {securityMutation.isPending ? 'Submitting...' : 'Submit security'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSecurityForm(false)}
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          {bondRequired && existingBonds.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Submitted security</h2>
              {existingBonds.map((bond) => (
                <dl key={bond.id || bond.security_id} className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-4 rounded-xl">
                  <div>
                    <dt className="text-gray-500">Amount</dt>
                    <dd className="font-bold">{formatContractValue(bond.amount, c.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Bank</dt>
                    <dd className="font-bold">{bond.issuing_bank}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Status</dt>
                    <dd>
                      <StatusBadge status={c.performance_security_validated ? 'active' : 'pending'} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Reference</dt>
                    <dd className="font-mono text-xs">{bond.reference_number}</dd>
                  </div>
                </dl>
              ))}
            </section>
          )}

          {c.milestones?.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Milestones</h2>
              <div className="space-y-3">
                {c.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <div>
                      <p className="font-medium">{m.title || m.milestone_name}</p>
                      <p className="text-xs text-gray-500">Due {formatDate(m.due_date)}</p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <ContractSigningSteps contract={c} title="Your signing steps" />
          {c.contract_document && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5" />
                Contract document
              </h2>
              <a
                href={c.contract_document}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-zammsa-green hover:underline"
              >
                Download PDF
              </a>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};

export default VendorContractDetail;

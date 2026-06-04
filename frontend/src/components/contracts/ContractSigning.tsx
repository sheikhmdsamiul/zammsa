import React, { useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { ContractSigningSteps } from './ContractSigningSteps';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import {
  formatContractValue,
  formatDate,
  canDGCountersign,
  canValidatePerformanceSecurity,
} from './contractUtils';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon,
  ShieldCheckIcon,
  ArrowLeftIcon,
  ExclamationIcon,
} from '@heroicons/react/outline';

const ContractSigning: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role || '';

  const isDG = role === ROLES.DIRECTOR_GENERAL;
  const isContractManager =
    role === ROLES.CONTRACT_MANAGER ||
    role === ROLES.PROCUREMENT_MANAGER ||
    role === ROLES.DIRECTOR_PROCUREMENT ||
    role === ROLES.SYSTEM_ADMIN;
  const isProcurementOfficer = role === ROLES.PROCUREMENT_OFFICER || role === ROLES.SYSTEM_ADMIN;
  const canCountersign = isDG;
  const canValidate = isContractManager;

  const { data: contract, isLoading, isError } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  const countersignMutation = useMutation({
    mutationFn: () => contractsApi.countersign(id!),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract countersigned by Director General');
      if (data?.performance_security_required) {
        toast('Supplier must upload performance security in the vendor portal', { icon: 'info' });
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to countersign'),
  });

  const perfSecurity = useMemo(() => {
    if (!contract?.securities?.length) return null;
    return (
      contract.securities.find((s) => s.security_type === 'performance') || contract.securities[0]
    );
  }, [contract?.securities]);

  const securityId = perfSecurity?.id || perfSecurity?.security_id;

  const validateMutation = useMutation({
    mutationFn: () => contractsApi.validateSecurity(id!, securityId!, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Performance security validated. Contract is now active.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to validate security'),
  });

  if (isLoading) return <LoadingSpinner className="py-24" />;
  if (isError || !contract) {
    return (
      <div className="max-w-3xl mx-auto py-24 text-center">
        <p className="text-lg font-bold text-gray-500">Contract not found</p>
        <Link to="/contracts" className="text-zammsa-green font-bold mt-4 inline-block">
          Back to contracts
        </Link>
      </div>
    );
  }

  const bondRequired = contract.requires_performance_bond || contract.performance_security_required;
  const showDGPanel = canCountersign && canDGCountersign(contract);
  const showValidatePanel = canValidate && canValidatePerformanceSecurity(contract);
  const dgDone = contract.signed_by_authority;
  const supplierDone = contract.signed_by_vendor;

  return (
    <div className="pb-12 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Contract Signing & Activation"
        description={`${contract.contract_number} · ${contract.vendor_name}`}
        breadcrumbs={[
          { label: 'Contracts', path: '/contracts' },
          { label: contract.contract_number },
          { label: 'Signing' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to={`/contracts/${id}`}
              className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <StatusBadge status={contract.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier — vendor portal only */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Supplier signature</h2>
            <p className="text-sm text-gray-500 mb-4">
              Performed by the awarded supplier in the <strong>Vendor Portal</strong> — not on this screen.
            </p>
            {supplierDone ? (
              <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                <CheckCircleIcon className="w-5 h-5" />
                <span className="text-sm font-bold">
                  Signed by supplier on {formatDate(contract.signed_vendor_date)}
                </span>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
                <p className="font-bold">Waiting for supplier</p>
                <p className="mt-1 text-blue-800">
                  Ask the supplier to log in at the vendor portal → My Contracts → open this contract → Sign
                  Contract.
                </p>
              </div>
            )}
          </section>

          {/* DG countersignature */}
          {(isDG || isProcurementOfficer || isContractManager) && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Director General countersignature</h2>
              {dgDone ? (
                <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                  <CheckCircleIcon className="w-5 h-5" />
                  <span className="text-sm font-bold">
                    Countersigned on {formatDate(contract.signed_authority_date)}
                  </span>
                </div>
              ) : !supplierDone ? (
                <p className="text-sm text-gray-500">Available after the supplier signs.</p>
              ) : !canCountersign ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                  Only the Director General can apply the countersignature. Log in as{' '}
                  <span className="font-mono">dg@zammsa.gov.zm</span> to complete this step.
                </div>
              ) : showDGPanel ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Value: {formatContractValue(contract.value, contract.currency)} · Supplier:{' '}
                    {contract.vendor_name}
                  </p>
                  <button
                    type="button"
                    onClick={() => countersignMutation.mutate()}
                    disabled={countersignMutation.isPending}
                    className="w-full sm:w-auto px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    {countersignMutation.isPending ? 'Signing...' : 'Apply DG Countersignature'}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex gap-2">
                  <ExclamationIcon className="w-5 h-5 shrink-0" />
                  Standstill must be complete before countersignature.
                </div>
              )}
            </section>
          )}

          {/* Performance security validation */}
          {bondRequired && (isContractManager || isDG || isProcurementOfficer) && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-zammsa-green" />
                Performance security
              </h2>
              {contract.performance_security_validated ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-bold">
                  Bond validated — contract is active.
                </div>
              ) : !contract.performance_security_uploaded ? (
                <p className="text-sm text-gray-500">
                  Supplier uploads the bond in the vendor portal after DG countersignature.
                </p>
              ) : !canValidate ? (
                <p className="text-sm text-gray-500">
                  Bond uploaded. A Contract Manager must validate it (
                  <span className="font-mono">contract@zammsa.gov.zm</span>).
                </p>
              ) : showValidatePanel && securityId ? (
                <div className="space-y-4">
                  {perfSecurity && (
                    <dl className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-4 rounded-xl">
                      <div>
                        <dt className="text-gray-500">Amount</dt>
                        <dd className="font-bold">{formatContractValue(perfSecurity.amount, contract.currency)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Bank</dt>
                        <dd className="font-bold">{perfSecurity.issuing_bank}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Reference</dt>
                        <dd className="font-mono text-xs">{perfSecurity.reference_number}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Expiry</dt>
                        <dd className="font-bold">{formatDate(perfSecurity.expiry_date)}</dd>
                      </div>
                    </dl>
                  )}
                  <button
                    type="button"
                    onClick={() => validateMutation.mutate()}
                    disabled={validateMutation.isPending}
                    className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    {validateMutation.isPending ? 'Validating...' : 'Validate performance security'}
                  </button>
                </div>
              ) : null}
            </section>
          )}

          {contract.status === 'active' && (
            <div className="text-center p-6 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <CheckCircleIcon className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-emerald-900">Contract is active</p>
              <button
                type="button"
                onClick={() => navigate(`/contracts/${id}`)}
                className="mt-4 px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold"
              >
                View contract
              </button>
            </div>
          )}
        </div>

        <div>
          <ContractSigningSteps contract={contract} />
        </div>
      </div>
    </div>
  );
};

export default ContractSigning;

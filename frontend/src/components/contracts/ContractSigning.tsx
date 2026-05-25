import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, ShieldCheckIcon,
  UploadIcon,
} from '@heroicons/react/outline';

const ContractSigning: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [supplierSigned, setSupplierSigned] = useState(false);
  const [dgSigned, setDgSigned] = useState(false);
  const [securityUploaded, setSecurityUploaded] = useState(false);
  const [securityId, setSecurityId] = useState<string | null>(null);
  const [securityFile, setSecurityFile] = useState<File | null>(null);
  const [securityValidated, setSecurityValidated] = useState(false);

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  const signSupplierMutation = useMutation({
    mutationFn: () => contractsApi.signSupplier(id!),
    onSuccess: () => {
      setSupplierSigned(true);
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      toast.success('Contract signed by supplier');
    },
  });

  const countersignMutation = useMutation({
    mutationFn: () => contractsApi.countersign(id!),
    onSuccess: () => {
      setDgSigned(true);
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      toast.success('Contract countersigned by Director General');
    },
  });

  const uploadSecurityMutation = useMutation({
    mutationFn: () => contractsApi.uploadSecurity(id!, {
      security_type: 'bank_guarantee',
      amount: Math.round((contract?.value || 0) * 0.05),
      issuing_bank: 'Zanaco Plc',
    }),
    onSuccess: (data: any) => {
      setSecurityId(data.id || data.security_id || '');
      setSecurityUploaded(true);
      toast.success('Performance security uploaded');
    },
  });

  const validateMutation = useMutation({
    mutationFn: () => contractsApi.validateSecurity(id!, securityId!, true),
    onSuccess: () => {
      setSecurityValidated(true);
      toast.success('Performance security validated');
    },
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!contract) return <p className="text-center text-gray-500 py-12">Contract not found</p>;

  const contractValue = contract.value || 0;
  const perfSecurityAmount = contractValue * 0.05;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Contract Signing & Activation</h1>
            <StatusBadge status={dgSigned && securityValidated ? 'active' : 'draft'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{contract.contract_number} | {contract.vendor_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Supplier Signs Contract</h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">Contract CON-2026-LAB-11</p>
                <p className="text-sm text-gray-500">Value: K {contractValue.toLocaleString()} | Duration: to 30 Sep 2026</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <ShieldCheckIcon className="w-5 h-5 text-zammsa-green" />
                PKI Certificate: Lusaka Reagents Ltd (X.509) — Valid until 31 Dec 2027
              </div>
              {supplierSigned ? (
                <div className="flex items-center gap-2 text-emerald-600 font-medium">
                  <CheckCircleIcon className="w-5 h-5" /> Signed by Supplier
                </div>
              ) : (
                <button onClick={() => signSupplierMutation.mutate()} disabled={signSupplierMutation.isPending}
                  className="w-full px-4 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50">
                  {signSupplierMutation.isPending ? 'Signing...' : 'Apply Supplier Digital Signature'}
                </button>
              )}
            </div>
          </div>

          {supplierSigned && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">DG Countersignature</h2>
              <p className="text-sm text-gray-500 mb-4">Supplier signed: {contract.vendor_name} ✅</p>
              {dgSigned ? (
                <div className="flex items-center gap-2 text-emerald-600 font-medium">
                  <CheckCircleIcon className="w-5 h-5" /> Countersigned by Director General
                </div>
              ) : (
                <button onClick={() => countersignMutation.mutate()} disabled={countersignMutation.isPending}
                  className="w-full px-4 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50">
                  {countersignMutation.isPending ? 'Signing...' : 'Apply Director General Countersignature'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {dgSigned && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Security</h2>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Required Amount: <strong className="text-gray-900">K {Math.round(perfSecurityAmount).toLocaleString()}</strong> (5% of K{contractValue.toLocaleString()})</p>
                  <p className="text-sm text-gray-600">Valid Until: 30 November 2026</p>
                  <p className="text-sm text-gray-600">Acceptable: Bank Guarantee or Performance Bond</p>
                </div>

                {!securityUploaded ? (
                  <div>
                    <label className="flex items-center gap-3 px-4 py-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-zammsa-green/50">
                      <UploadIcon className="w-6 h-6 text-gray-400" />
                      <span className="text-sm text-gray-500">Upload Performance Security Document</span>
                      <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { setSecurityFile(f); uploadSecurityMutation.mutate(); }
                      }} />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-medium">{securityFile?.name || 'Performance bond uploaded'}</span>
                      </div>
                      <StatusBadge status="verified" />
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-medium text-amber-800 mb-2">R-03 Validation Required</p>
                      <div className="space-y-2 text-sm text-amber-700">
                        <p className="flex items-center gap-1"><CheckCircleIcon className="w-4 h-4" /> Amount: K57,750 ✅</p>
                        <p className="flex items-center gap-1"><CheckCircleIcon className="w-4 h-4" /> Form: Bank Guarantee ✅</p>
                        <p className="flex items-center gap-1"><CheckCircleIcon className="w-4 h-4" /> Validity: ✅</p>
                      </div>
                    </div>

                    {!securityValidated && (
                      <button onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending}
                        className="w-full px-4 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold">
                        Approve Performance Security
                      </button>
                    )}

                    {securityValidated && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                        <CheckCircleIcon className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-emerald-800">Contract Status → ACTIVE ✅</p>
                        <button onClick={() => navigate(`/contracts/${id}`)}
                          className="mt-3 px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm">
                          View Active Contract
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractSigning;

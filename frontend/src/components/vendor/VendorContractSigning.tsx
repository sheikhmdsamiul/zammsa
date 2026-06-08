import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatContractValue, formatDate } from '../contracts/contractUtils';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, DocumentTextIcon, ShieldCheckIcon, CheckCircleIcon } from '@heroicons/react/outline';

const VendorContractSigning: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);

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
      navigate(`/vendor/contracts/${id}`, { replace: true });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to sign contract'),
  });

  if (isLoading) return <LoadingSpinner className="py-24" />;
  if (isError || !contract) {
    return (
      <div className="py-24 text-center">
        <p className="text-lg font-bold text-gray-500">Contract not found</p>
        <Link to="/vendor/contracts" className="text-zammsa-green font-bold mt-4 inline-block">
          Back to my contracts
        </Link>
      </div>
    );
  }

  const handleSign = () => {
    if (!agreed) {
      toast.error('Please read and agree to the contract terms before signing');
      return;
    }
    signMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <Link
          to={`/vendor/contracts/${id}`}
          className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sign Contract</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {contract.contract_number} &mdash; {contract.title}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 bg-zammsa-green rounded-full" />
          <span className="text-xs font-black uppercase tracking-wider text-gray-400">Contract Summary</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-50 rounded-xl p-5 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Contract Value</p>
            <p className="text-3xl font-black text-gray-900">{formatContractValue(contract.value, contract.currency)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-5 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Duration</p>
            <p className="text-xl font-bold text-gray-900">
              {contract.start_date && contract.end_date ? (
                <>
                  {formatDate(contract.start_date)} &mdash; {formatDate(contract.end_date)}
                </>
              ) : '—'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-5 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Effective Date</p>
            <p className="text-xl font-bold text-gray-900">{formatDate(contract.start_date)}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6">
          <a
            href={contract.contract_document || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-6 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-all group"
          >
            <DocumentTextIcon className="w-6 h-6 text-zammsa-green" />
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900 group-hover:text-zammsa-green transition-colors">
                Download & Review Full Contract PDF
              </p>
              <p className="text-xs text-gray-400">Review all terms and conditions before signing</p>
            </div>
          </a>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheckIcon className="w-5 h-5 text-zammsa-green" />
          <span className="text-xs font-black uppercase tracking-wider text-gray-400">Digital Signature</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <ShieldCheckIcon className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Loaded</span>
                <span className="text-sm font-bold text-emerald-900">Government PKI Certificate (X.509)</span>
              </div>
              <p className="text-sm text-emerald-700">Issued to: <span className="font-bold">{contract.vendor_name || 'Your Company'}</span></p>
              <p className="text-sm text-emerald-700">Valid until: 31 Dec 2027</p>
            </div>
          </div>
        </div>

        <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer group">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-zammsa-green focus:ring-zammsa-green cursor-pointer"
          />
          <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-relaxed">
            I have read, understood and agree to the contract terms and conditions.
            I confirm this signature is legally binding.
          </span>
        </label>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-amber-800">
          <span className="font-bold">Note:</span> After you sign, the ZAMMSA Director General will countersign.
          You will receive the fully executed contract by email.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate(`/vendor/contracts/${id}`)}
          className="px-6 py-3 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSign}
          disabled={signMutation.isPending || !agreed}
          className="px-10 py-3 bg-zammsa-green text-white rounded-xl font-bold hover:bg-zammsa-green-dark disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zammsa-green/20 transition-all flex items-center gap-2"
        >
          {signMutation.isPending ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Signing...
            </>
          ) : (
            <>
              <CheckCircleIcon className="w-5 h-5" />
              Apply Digital Signature
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default VendorContractSigning;

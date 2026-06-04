import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

const VendorContractDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: contract, isLoading } = useQuery({
    queryKey: ['vendor-contract', id],
    queryFn: () => vendorApi.contracts.get(id!),
    enabled: !!id,
  });

  const signMutation = useMutation({
    mutationFn: () => vendorApi.contracts.sign(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-contract', id] });
      queryClient.invalidateQueries({ queryKey: ['vendor-contracts'] });
      toast.success('Contract signed successfully');
    },
  });

  // Performance security upload state
  const [showSecurityForm, setShowSecurityForm] = useState(false);
  const [securityData, setSecurityData] = useState({
    amount: '',
    issuing_bank: '',
    reference_number: '',
    expiry_date: '',
  });

  const securityMutation = useMutation({
    mutationFn: (data: { amount: number; issuing_bank: string; reference_number?: string; expiry_date?: string }) =>
      vendorApi.contracts.uploadSecurity(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-contract', id] });
      toast.success('Performance security uploaded successfully. Awaiting validation.');
      setShowSecurityForm(false);
      setSecurityData({ amount: '', issuing_bank: '', reference_number: '', expiry_date: '' });
    },
    onError: () => toast.error('Failed to upload security'),
  });

  const handleSecuritySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityData.amount || !securityData.issuing_bank) {
      toast.error('Amount and issuing bank are required');
      return;
    }
    securityMutation.mutate({
      amount: parseFloat(securityData.amount),
      issuing_bank: securityData.issuing_bank,
      reference_number: securityData.reference_number || undefined,
      expiry_date: securityData.expiry_date || undefined,
    });
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!contract) return <p className="text-center text-gray-500 py-12">Contract not found</p>;

  // Determine if performance security section should be shown
  const requiresSecurity = contract.performance_security_required;
  const securityUploaded = contract.performance_security_uploaded;
  const securityValidated = contract.performance_security_validated;
  const existingBonds = contract.securities?.filter((s: any) => s.security_type === 'performance') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
            <StatusBadge status={contract.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{contract.contract_number}</p>
        </div>
        <div className="flex gap-2">
          {!contract.signed_by_vendor && contract.status === 'active' && (
            <button onClick={() => signMutation.mutate(undefined)} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm">Sign Contract</button>
          )}
          <button onClick={() => navigate('/vendor/contracts')} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm">Back</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Contract Value</dt><dd className="font-medium text-lg">{contract.value?.toLocaleString()} {contract.currency}</dd></div>
              <div><dt className="text-gray-500">Duration</dt><dd className="font-medium">{contract.start_date ? new Date(contract.start_date).toLocaleDateString() : '-'} - {contract.end_date ? new Date(contract.end_date).toLocaleDateString() : '-'}</dd></div>
              <div><dt className="text-gray-500">Signed by You</dt><dd className="font-medium">{contract.signed_by_vendor ? `Yes (${contract.signed_vendor_date ? new Date(contract.signed_vendor_date).toLocaleDateString() : ''})` : 'Pending'}</dd></div>
              <div><dt className="text-gray-500">Signed by Authority</dt><dd className="font-medium">{contract.signed_by_authority ? `Yes (${contract.signed_authority_date ? new Date(contract.signed_authority_date).toLocaleDateString() : ''})` : 'Pending'}</dd></div>
            </dl>
          </div>

          {contract.milestones?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Milestones</h2>
              <div className="space-y-3">
                {contract.milestones.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.title}</p>
                      <p className="text-xs text-gray-500">Due: {new Date(m.due_date).toLocaleDateString()}</p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Security Section */}
          {requiresSecurity && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Security</h2>

              {existingBonds.length > 0 && (
                <div className="mb-4 space-y-2">
                  {existingBonds.map((bond: any) => (
                    <div key={bond.id || bond.security_id} className="p-4 bg-gray-50 rounded-lg text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Amount</span>
                        <span className="font-medium">K {parseFloat(bond.amount).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Issuing Bank</span>
                        <span className="font-medium">{bond.issuing_bank}</span>
                      </div>
                      {bond.expiry_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Expiry</span>
                          <span className="font-medium">{new Date(bond.expiry_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status</span>
                        <StatusBadge status={bond.status || 'active'} />
                      </div>
                      {bond.reference_number && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Reference</span>
                          <span className="font-medium">{bond.reference_number}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!securityUploaded && !showSecurityForm && (
                <button
                  onClick={() => setShowSecurityForm(true)}
                  className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm"
                >
                  Upload Performance Security
                </button>
              )}

              {securityUploaded && !securityValidated && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <p className="text-amber-800 font-medium">Security uploaded - awaiting validation by procurement authority.</p>
                </div>
              )}

              {securityValidated && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                  <p className="text-emerald-800 font-medium">✓ Performance security validated and active.</p>
                </div>
              )}

              {showSecurityForm && (
                <form onSubmit={handleSecuritySubmit} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ZMW) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={securityData.amount}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Bank *</label>
                    <input
                      type="text"
                      value={securityData.issuing_bank}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, issuing_bank: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                    <input
                      type="text"
                      value={securityData.reference_number}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, reference_number: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={securityData.expiry_date}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, expiry_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" disabled={securityMutation.isPending}
                      className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm disabled:opacity-50">
                      {securityMutation.isPending ? 'Uploading...' : 'Submit Security'}
                    </button>
                    <button type="button" onClick={() => setShowSecurityForm(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {contract.contract_document && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Document</h2>
              <button className="text-zammsa-green hover:underline text-sm">Download Contract</button>
            </div>
          )}

          {contract.amendments?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Amendments</h2>
              <div className="space-y-2">
                {contract.amendments.map((a: any) => (
                  <div key={a.id} className="text-sm p-2 bg-gray-50 rounded">
                    <p className="font-medium">Amendment #{a.amendment_number}</p>
                    <p className="text-gray-600 text-xs">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorContractDetail;

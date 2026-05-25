import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const ContractDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  const signMutation = useMutation({
    mutationFn: () => contractsApi.signSupplier(id!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contract', id] }); toast.success('Contract signed'); },
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!contract) return <p className="text-center text-gray-500 py-12">Contract not found</p>;

  const isAuthOfficer = user?.role === 'contract_manager' || user?.role === 'procurement_officer';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
            <StatusBadge status={contract.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{contract.contract_number} | {contract.vendor_name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(contract.status === 'draft' || contract.status === 'awarded') && (
            <button onClick={() => navigate(`/contracts/${id}/standstill`)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Award & Standstill</button>
          )}
          {contract.status === 'active' && (
            <>
              <button onClick={() => navigate(`/contracts/${id}/signing`)} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold">Signing & Security</button>
              <button onClick={() => navigate(`/contracts/${id}/amendments`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Amendments</button>
              <button onClick={() => navigate(`/contracts/${id}/ld`)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold">Liquidated Damages</button>
            </>
          )}
          {(contract.status === 'active' || contract.status === 'completed') && (
            <>
              <button onClick={() => navigate(`/contracts/${id}/performance`)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold">Performance Eval</button>
              <button onClick={() => navigate(`/contracts/${id}/closure`)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">Close Contract</button>
            </>
          )}
          {contract.status === 'closed' && (
            <button onClick={() => navigate(`/contracts/${id}/archive`)} className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-bold">Archive</button>
          )}
          {isAuthOfficer && contract.status === 'draft' && (
            <button onClick={() => signMutation.mutate()} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Supplier Sign</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Contract Value</dt><dd className="font-medium text-lg">{contract.value?.toLocaleString()} {contract.currency}</dd></div>
              <div><dt className="text-gray-500">Duration</dt><dd className="font-medium">{contract.start_date ? new Date(contract.start_date).toLocaleDateString() : '-'} - {contract.end_date ? new Date(contract.end_date).toLocaleDateString() : '-'}</dd></div>
              <div><dt className="text-gray-500">Solicitation</dt><dd className="font-medium">{contract.solicitation || '-'}</dd></div>
              <div><dt className="text-gray-500">Vendor</dt><dd className="font-medium">{contract.vendor_name}</dd></div>
              <div><dt className="text-gray-500">Signed by Vendor</dt><dd className="font-medium">{contract.signed_by_vendor ? `Yes (${contract.signed_vendor_date ? new Date(contract.signed_vendor_date).toLocaleDateString() : ''})` : 'No'}</dd></div>
              <div><dt className="text-gray-500">Signed by Authority</dt><dd className="font-medium">{contract.signed_by_authority ? `Yes (${contract.signed_authority_date ? new Date(contract.signed_authority_date).toLocaleDateString() : ''})` : 'No'}</dd></div>
            </dl>
          </div>

          {contract.milestones?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Milestones ({contract.milestones.length})</h2>
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

          {contract.amendments?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Amendments</h2>
              <div className="space-y-3">
                {contract.amendments.map((a: any) => (
                  <div key={a.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <p className="font-medium text-gray-900">Amendment #{a.amendment_number}</p>
                    <p className="text-gray-600">{a.description}</p>
                    <p className="text-xs text-gray-400 mt-1">Value change: {a.value_change?.toLocaleString()} | Approved: {a.approved ? 'Yes' : 'No'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Timeline</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${contract.status !== 'draft' ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>Draft</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${['active', 'amended', 'terminated', 'completed', 'closed'].includes(contract.status) ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${contract.status === 'completed' || contract.status === 'closed' ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${contract.status === 'closed' ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span>Closed</span>
              </div>
            </div>
          </div>

          {contract.contract_document && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Document</h2>
              <button className="text-zammsa-green hover:underline text-sm">Download Contract Document</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractDetail;

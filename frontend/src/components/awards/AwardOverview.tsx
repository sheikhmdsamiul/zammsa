import React, { useState, useEffect } from 'react';
import { contractsApi } from '../../api/contracts';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import { Contract } from '../../types';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'pending_notice': { 
    label: 'Award Notice Pending', 
    color: 'bg-amber-50 text-amber-700 border-amber-200', 
    icon: <span className="text-amber-700">📝</span> 
  },
  'waiting_period': { 
    label: 'Waiting Period', 
    color: 'bg-blue-50 text-blue-700 border-blue-200', 
    icon: <span className="text-blue-700">⏳</span> 
  },
  'waiting_signature': { 
    label: 'Awaiting Signatures', 
    color: 'bg-purple-50 text-purple-700 border-purple-200', 
    icon: <span className="text-purple-700"> ✍️</span> 
  },
  'active': { 
    label: 'Contract Active', 
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', 
    icon: <span className="text-emerald-700">✅</span> 
  },
  'completed': { 
    label: 'Contract Completed', 
    color: 'bg-gray-50 text-gray-700 border-gray-200', 
    icon: <span className="text-gray-700">✔️</span> 
  },
};

const AwardOverview: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContracts = async () => {
      try {
        const response = await contractsApi.list({ status: ['pending_acceptance', 'active', 'completed'] });
        setContracts(response.results || []);
      } catch (error) {
        console.error('Error loading contracts:', error);
        toast.error('Failed to load contract award data');
      } finally {
        setLoading(false);
      }
    };
    
    loadContracts();
  }, []);

  const getContractStatusInfo = (contract: Contract) => {
    if (contract.status === 'completed' || contract.archived_at) {
      return statusConfig['completed'];
    }
    if (contract.status === 'active') {
      return statusConfig['active'];
    }
    if (contract.status === 'pending_acceptance' && !contract.signed_by_vendor) {
      return statusConfig['waiting_signature'];
    }
    if (contract.waiting_period_start && !contract.award_date) {
      return statusConfig['waiting_period'];
    }
    return statusConfig['pending_notice'];
  };

  if (loading) return <LoadingSpinner className="py-12" />;

  if (!contracts.length) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No contract awards yet</h2>
        <p className="mt-2 text-gray-500">Contracts will appear here after bid evaluation and award decisions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contract Awards Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track the status of all awarded contracts from award to completion
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statusConfig.parsing ? null : ['pending_notice', 'waiting_period', 'waiting_signature', 'active', 'completed'].map((statusKey) => {
          const statusInfo = statusConfig[statusKey as keyof typeof statusConfig];
          const count = contracts.filter(c => {
            if (statusKey === 'completed') return c.status === 'completed' || !!c.archived_at;
            if (statusKey === 'active') return c.status === 'active';
            if (statusKey === 'pending_notice') return c.status === 'pending_acceptance' && !!c.award_date;
            if (statusKey === 'waiting_period') return !!c.waiting_period_start && !c.award_date;
            if (statusKey === 'waiting_signature') return c.status === 'pending_acceptance' && !c.signed_by_vendor;
            return false;
          }).length;
          
          return (
            <div key={statusKey} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${statusKey === 'pending_notice' ? 'bg-amber-50' : statusKey === 'waiting_period' ? 'bg-blue-50' : statusKey === 'waiting_signature' ? 'bg-purple-50' : statusKey === 'active' ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                  {statusInfo.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500">{statusInfo.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Contract Status</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Contract</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Vendor</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Contract Value</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Award Date</th>
                <th className="px-6 py-3 text-center font-bold text-gray-500 text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-6 py-3 text-right font-bold text-gray-500 text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map((contract) => {
                const statusInfo = getContractStatusInfo(contract);
                
                return (
                  <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{contract.contract_number}</div>
                      <div className="text-xs text-gray-600 truncate max-w-xs">{contract.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {contract.vendor_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {new Intl.NumberFormat('en-GB', { style: 'currency', currency: contract.currency || 'ZMW' }).format(contract.value || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {contract.award_date || 'TBD'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a href={`/contracts/${contract.id}`} className="text-zammsa-green font-semibold text-xs hover:underline">
                        View Details
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AwardOverview;

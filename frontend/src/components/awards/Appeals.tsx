import React, { useState, useEffect } from 'react';
import { contractsApi } from '../../api/contracts';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

interface AppealRecord {
  id: string;
  contractNumber: string;
  title: string;
  vendorName: string;
  grounds: string;
  filedAt: string;
  status: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

const Appeals: React.FC = () => {
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAppeals = async () => {
      try {
        const response = await contractsApi.listAppeals({});
        const records = (response.results || []).map((appeal: any) => ({
          id: appeal.id,
          contractNumber: appeal.contract_number || 'Unknown',
          title: appeal.contract_title || 'Unknown',
          vendorName: appeal.bidder_name || 'Unknown',
          grounds: appeal.grounds || '',
          filedAt: appeal.filed_at,
          status: appeal.status,
          resolvedAt: appeal.resolved_at,
          resolutionNotes: appeal.resolution_notes,
        }));
        setAppeals(records);
      } catch (error) {
        console.error('Error loading appeals:', error);
        toast.error('Failed to load appeals');
      } finally {
        setLoading(false);
      }
    };
    
    loadAppeals();
  }, []);

  if (loading) return <LoadingSpinner className="py-12" />;

  if (!appeals.length) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No appeals</h2>
        <p className="mt-2 text-gray-500">All contracts have been finalized without appeals.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appeals & Disputes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage all bid appeals and contract disputes
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            Open: {appeals.filter(a => a.status === 'filed' || a.status === 'under_review').length}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            Resolved: {appeals.filter(a => a.status === 'upheld' || a.status === 'dismissed').length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {appeals.filter(a => a.status === 'filed' || a.status === 'under_review').slice(0, 3).map((appeal) => (
          <div key={appeal.id} className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-2">Appeal #{appeal.id.substring(0, 8)}</h3>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{appeal.grounds}</p>
            <div className="space-y-2 text-xs">
              <p><span className="font-semibold text-gray-700">Contract:</span> {appeal.contractNumber}</p>
              <p><span className="font-semibold text-gray-700">Filed by:</span> {appeal.vendorName}</p>
              <p><span className="font-semibold text-gray-700">Status:</span> <span className="text-amber-700">Open</span></p>
            </div>
          </div>
        ))}
        
        {appeals.filter(a => a.status === 'upheld').slice(0, 3).map((appeal) => (
          <div key={appeal.id} className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-2">Resolved Appeal #{appeal.id.substring(0, 8)}</h3>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{appeal.grounds}</p>
            <div className="space-y-2 text-xs">
              <p><span className="font-semibold text-gray-700">Resolution:</span> <span className="text-emerald-700">Upheld</span></p>
              <p><span className="font-semibold text-gray-700">Contract:</span> {appeal.contractNumber}</p>
              <p><span className="font-semibold text-gray-700">Resolved by:</span> {appeal.vendorName}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Contract</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Appellant</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Grounds</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Date Filed</th>
                <th className="px-6 py-3 text-center font-bold text-gray-500 text-[10px] uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appeals.map((appeal) => (
                <tr key={appeal.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{appeal.contractNumber}</div>
                    <div className="text-xs text-gray-600 truncate max-w-xs">{appeal.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{appeal.vendorName}</td>
                  <td className="px-6 py-4 max-w-xs truncate text-gray-600">{appeal.grounds}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {new Date(appeal.filedAt || '').toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {appeal.status === 'filed' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
                        Filed
                      </span>
                    ) : appeal.status === 'under_review' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                        Under Review
                      </span>
                    ) : appeal.status === 'upheld' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                        Upheld
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-700">
                        Dismissed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Appeals;

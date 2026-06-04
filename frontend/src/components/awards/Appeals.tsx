import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

interface AppealRecord {
  id: string;
  contractId?: string;
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
  const queryClient = useQueryClient();
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<{ open: boolean; appeal: AppealRecord | null }>({ open: false, appeal: null });
  const [resolution, setResolution] = useState<'upheld' | 'dismissed'>('dismissed');
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    const loadAppeals = async () => {
      try {
        const response = await contractsApi.listAppeals({});
        const records = (response.results || []).map((appeal: any) => ({
          id: appeal.id,
          contractId: appeal.contract || appeal.contract_id,
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

  const resolveMutation = useMutation({
    mutationFn: (data: { contractId: string; appealId: string; resolution: string; notes: string }) =>
      contractsApi.resolveAppeal(data.contractId, data.appealId, { resolution: data.resolution, notes: data.notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appeals'] });
      toast.success('Appeal resolved successfully');
      setResolveModal({ open: false, appeal: null });
      // Reload appeals list
      contractsApi.listAppeals({}).then((response: any) => {
        const records = (response.results || []).map((appeal: any) => ({
          id: appeal.id,
          contractId: appeal.contract || appeal.contract_id,
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
      });
    },
    onError: () => toast.error('Failed to resolve appeal'),
  });

  const handleResolve = () => {
    if (!resolveModal.appeal || !resolveModal.appeal.contractId) {
      toast.error('Cannot resolve appeal: missing contract ID');
      return;
    }
    resolveMutation.mutate({
      contractId: resolveModal.appeal.contractId,
      appealId: resolveModal.appeal.id,
      resolution,
      notes: resolutionNotes,
    });
  };

  const openResolveModal = (appeal: AppealRecord) => {
    setResolution('dismissed');
    setResolutionNotes('');
    setResolveModal({ open: true, appeal });
  };

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

      {/* Open Appeals Cards */}
      {appeals.filter(a => a.status === 'filed' || a.status === 'under_review').length > 0 && (
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
              <button
                onClick={() => openResolveModal(appeal)}
                className="mt-3 w-full px-3 py-2 text-xs font-semibold bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 border border-amber-200"
              >
                Resolve Appeal
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Resolved Appeals Cards */}
      {appeals.filter(a => a.status === 'upheld').length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {appeals.filter(a => a.status === 'upheld').slice(0, 3).map((appeal) => (
            <div key={appeal.id} className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">Resolved Appeal #{appeal.id.substring(0, 8)}</h3>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{appeal.grounds}</p>
              <div className="space-y-2 text-xs">
                <p><span className="font-semibold text-gray-700">Resolution:</span> <span className="text-emerald-700">Upheld</span></p>
                <p><span className="font-semibold text-gray-700">Contract:</span> {appeal.contractNumber}</p>
                <p><span className="font-semibold text-gray-700">Resolved:</span> {appeal.resolvedAt ? new Date(appeal.resolvedAt).toLocaleDateString() : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Appeals Table */}
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
                <th className="px-6 py-3 text-center font-bold text-gray-500 text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appeals.map((appeal) => (
                <React.Fragment key={appeal.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{appeal.contractNumber}</div>
                      <div className="text-xs text-gray-600 truncate max-w-xs">{appeal.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{appeal.vendorName}</td>
                    <td className="px-6 py-4 max-w-xs truncate text-gray-600">
                      <button
                        onClick={() => setExpandedId(expandedId === appeal.id ? null : appeal.id)}
                        className="text-left hover:text-zammsa-green"
                      >
                        {appeal.grounds}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {new Date(appeal.filedAt || '').toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {appeal.status === 'filed' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">Filed</span>
                      ) : appeal.status === 'under_review' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">Under Review</span>
                      ) : appeal.status === 'upheld' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">Upheld</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-700">Dismissed</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {(appeal.status === 'filed' || appeal.status === 'under_review') && (
                        <button
                          onClick={() => openResolveModal(appeal)}
                          className="px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 border border-amber-200"
                        >
                          Resolve
                        </button>
                      )}
                      {appeal.status === 'upheld' && (
                        <span className="text-xs text-emerald-600 font-medium">Contract cancelled</span>
                      )}
                      {appeal.status === 'dismissed' && (
                        <span className="text-xs text-gray-500 font-medium">Proceed</span>
                      )}
                    </td>
                  </tr>
                  {/* Expanded grounds row */}
                  {expandedId === appeal.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-4 text-sm text-gray-700">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900 mb-1">Full Grounds of Appeal:</p>
                            <p className="whitespace-pre-wrap">{appeal.grounds}</p>
                            {appeal.resolutionNotes && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <p className="font-semibold text-gray-900 mb-1">Resolution Notes:</p>
                                <p className="whitespace-pre-wrap text-emerald-700">{appeal.resolutionNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolve Modal */}
      {resolveModal.open && resolveModal.appeal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black bg-opacity-40 transition-opacity" onClick={() => setResolveModal({ open: false, appeal: null })} />
            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 z-10">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Resolve Appeal</h3>
              <p className="text-sm text-gray-500 mb-4">
                Appeal by {resolveModal.appeal.vendorName} for contract {resolveModal.appeal.contractNumber}
              </p>

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm font-medium text-gray-700 mb-1">Grounds:</p>
                <p className="text-sm text-gray-600">{resolveModal.appeal.grounds}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setResolution('dismissed')}
                      className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        resolution === 'dismissed'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Dismiss
                      <p className="text-xs font-normal mt-0.5">Contract proceeds</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setResolution('upheld')}
                      className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        resolution === 'upheld'
                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Upheld
                      <p className="text-xs font-normal mt-0.5">Contract cancelled</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green focus:border-zammsa-green outline-none"
                    placeholder="Enter resolution notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setResolveModal({ open: false, appeal: null })}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={resolveMutation.isPending}
                  className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 ${
                    resolution === 'upheld' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-zammsa-green hover:bg-green-700'
                  }`}
                >
                  {resolveMutation.isPending ? 'Resolving...' : resolution === 'upheld' ? 'Upheld - Cancel Contract' : 'Dismiss - Proceed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appeals;

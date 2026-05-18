import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { GeneralProcurementNotice } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

const PUBLISH_TARGETS = ['zammsa_website', 'egp_portal', 'govt_gazette'];

const GPNList: React.FC = () => {
  const navigate = useNavigate();
  const [gpns, setGpns] = useState<GeneralProcurementNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishModal, setPublishModal] = useState<GeneralProcurementNotice | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['zammsa_website']);
  const [proofUrls, setProofUrls] = useState('');
  const [processing, setProcessing] = useState('');

  useEffect(() => { loadGPNs(); }, []);

  const loadGPNs = async () => {
    setLoading(true);
    try { const res = await procurementPlanningApi.gpn.list({ page_size: 100 }); setGpns(res.results); }
    catch { setGpns([]); }
    setLoading(false);
  };

  const handlePublish = async (gpn: GeneralProcurementNotice) => {
    setProcessing(gpn.gpn_id);
    try {
      const urls = proofUrls ? proofUrls.split('\n').map((u) => u.trim()).filter(Boolean) : [];
      const res = await procurementPlanningApi.gpn.publish(gpn.gpn_id, selectedTargets, urls);
      toast.success(res.message);
      setPublishModal(null);
      setSelectedTargets(['website']);
      setProofUrls('');
      loadGPNs();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Publish failed'); }
    setProcessing('');
  };

  const handleArchive = async (gpn: GeneralProcurementNotice) => {
    setProcessing(gpn.gpn_id);
    try {
      const res = await procurementPlanningApi.gpn.archive(gpn.gpn_id);
      toast.success(res.message);
      loadGPNs();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Archive failed'); }
    setProcessing('');
  };

  const toggleTarget = (t: string) => {
    setSelectedTargets((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">General Procurement Notices</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? <div className="p-8"><LoadingSpinner /></div> : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">APP</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Targets</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Generated</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Published</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {gpns.map((gpn) => (
                <tr key={gpn.gpn_id} onClick={() => navigate(`/procurement-planning/gpns/${gpn.gpn_id}`)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 text-sm text-gray-900">{gpn.app}</td>
                  <td className="px-4 py-3"><StatusBadge status={gpn.publication_status} /></td>
                  <td className="px-4 py-3 text-sm">
                    {gpn.publication_targets?.length ? gpn.publication_targets.join(', ') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(gpn.generated_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{gpn.published_at ? new Date(gpn.published_at).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {gpn.publication_status === 'draft' && (
                        <>
                          <button onClick={() => setPublishModal(gpn)} disabled={processing === gpn.gpn_id} className="px-3 py-1.5 text-xs bg-zammsa-green text-white rounded hover:bg-zammsa-green-dark disabled:opacity-50">
                            Publish
                          </button>
                          <button onClick={() => handleArchive(gpn)} disabled={processing === gpn.gpn_id} className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
                            Archive
                          </button>
                        </>
                      )}
                      {gpn.publication_status === 'published' && (
                        <button onClick={() => handleArchive(gpn)} disabled={processing === gpn.gpn_id} className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {gpns.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No GPNs found. Generate from an approved APP.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {publishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-medium">Publish GPN</h3>
            <p className="text-sm text-gray-500 mt-1">Select publication channels</p>
            <div className="mt-4 space-y-2">
              {PUBLISH_TARGETS.map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedTargets.includes(t)} onChange={() => toggleTarget(t)} className="rounded border-gray-300" />
                  <span className="text-sm capitalize">{t.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-1">Proof URLs (one per line, optional)</label>
              <textarea value={proofUrls} onChange={(e) => setProofUrls(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-md p-2 text-sm" placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setPublishModal(null); setSelectedTargets(['zammsa_website']); setProofUrls(''); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={() => handlePublish(publishModal)} disabled={selectedTargets.length === 0 || processing !== ''} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm disabled:opacity-50">
                {processing ? 'Publishing...' : `Publish to ${selectedTargets.length} channel(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GPNList;

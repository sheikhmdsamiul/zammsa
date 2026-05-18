import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { GeneralProcurementNotice } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const PUBLISH_TARGETS = [
  { key: 'zammsa_website', label: 'ZAMMSA Website' },
  { key: 'egp_portal', label: 'e-GP Portal (ZPPA)' },
  { key: 'govt_gazette', label: 'Government Gazette' },
];

const GPNDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gpn, setGpn] = useState<GeneralProcurementNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['zammsa_website']);
  const [proofUrls, setProofUrls] = useState('');

  const loadGPN = async () => {
    if (!id) return;
    setLoading(true);
    try { setGpn(await procurementPlanningApi.gpn.detail(id)); } catch { setGpn(null); }
    setLoading(false);
  };

  useEffect(() => { loadGPN(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePublish = async () => {
    setActionLoading('publish');
    try {
      const urls = proofUrls ? proofUrls.split('\n').map((u) => u.trim()).filter(Boolean) : [];
      const res = await procurementPlanningApi.gpn.publish(id!, selectedTargets, urls);
      toast.success(res.message);
      setShowPublishModal(false);
      setSelectedTargets(['zammsa_website']);
      setProofUrls('');
      loadGPN();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Publish failed'); }
    setActionLoading('');
  };

  const handleArchive = async () => {
    setActionLoading('archive');
    try {
      const res = await procurementPlanningApi.gpn.archive(id!);
      toast.success(res.message);
      loadGPN();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Archive failed'); }
    setActionLoading('');
  };

  const canPublish = gpn?.publication_status === 'draft' && ['procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'].includes(user?.role || '');
  const canArchive = ['draft', 'published'].includes(gpn?.publication_status || '');

  if (loading) return <div className="p-12"><LoadingSpinner size="lg" /></div>;
  if (!gpn) return <div className="p-12 text-center text-gray-500">GPN not found</div>;

  const lineItems = gpn.content?.line_items || [];
  const totalValue = lineItems.reduce((sum: number, item: any) => sum + (item.estimated_value || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">GPN Detail</h1>
            <StatusBadge status={gpn.publication_status} />
          </div>
          <p className="text-sm text-gray-500">Generated: {new Date(gpn.generated_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/procurement-planning/${gpn.app}`)} className="text-sm text-gray-500 hover:text-gray-700">View APP →</button>
          <button onClick={() => navigate('/procurement-planning/gpns')} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to List</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Department</p>
          <p className="text-sm font-medium">{gpn.content?.department || '-'}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Fiscal Year</p>
          <p className="text-sm font-medium">{gpn.content?.fiscal_year || '-'}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Total Estimated Value</p>
          <p className="text-xl font-bold">ZMW {Number(totalValue).toLocaleString()}</p>
        </div>
      </div>

      {gpn.publication_targets && gpn.publication_targets.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Publication Targets</h2>
          <div className="grid grid-cols-3 gap-4">
            {PUBLISH_TARGETS.map(target => {
              const isPublished = gpn.publication_targets?.includes(target.key);
              return (
                <div key={target.key} className={`p-3 rounded-lg border ${isPublished ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <p className="text-sm font-medium">{target.label}</p>
                  <p className={`text-xs mt-1 ${isPublished ? 'text-green-700' : 'text-gray-400'}`}>
                    {isPublished ? 'Published' : 'Not published'}
                  </p>
                </div>
              );
            })}
          </div>
          {gpn.published_at && <p className="text-xs text-gray-400 mt-3">Published at: {new Date(gpn.published_at).toLocaleString()}</p>}
          {gpn.published_by_name && <p className="text-xs text-gray-400">Published by: {gpn.published_by_name}</p>}
        </div>
      )}

      {gpn.publication_proof_urls && gpn.publication_proof_urls.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Publication Proofs</h2>
          <ul className="space-y-1">
            {gpn.publication_proof_urls.map((url: string, i: number) => (
              <li key={i}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-zammsa-green hover:underline">{url}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Line Items ({lineItems.length})</h2>
          <span className="text-sm text-gray-500">Total: ZMW {Number(totalValue).toLocaleString()}</span>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Value (ZMW)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Method</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Issue Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Award Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {lineItems.map((item: any, i: number) => (
              <tr key={i}>
                <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">{Number(item.estimated_value).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.recommended_method?.replace(/_/g, ' ') || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.planned_issue_date || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.planned_award_date || '-'}</td>
              </tr>
            ))}
            {lineItems.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No line items</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Actions</h2>
        <div className="flex flex-wrap gap-2">
          {canPublish && (
            <button onClick={() => setShowPublishModal(true)} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark">
              Publish GPN
            </button>
          )}
          {canArchive && (
            <button onClick={handleArchive} disabled={actionLoading === 'archive'} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              {actionLoading === 'archive' ? 'Archiving...' : 'Archive'}
            </button>
          )}
        </div>
      </div>

      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-medium">Publish GPN</h3>
            <p className="text-sm text-gray-500 mt-1">Select publication channels</p>
            <div className="mt-4 space-y-2">
              {PUBLISH_TARGETS.map((t) => (
                <label key={t.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTargets.includes(t.key)}
                    onChange={() => setSelectedTargets(prev => prev.includes(t.key) ? prev.filter(x => x !== t.key) : [...prev, t.key])}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-1">Proof URLs (one per line, optional)</label>
              <textarea value={proofUrls} onChange={(e) => setProofUrls(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-md p-2 text-sm" placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowPublishModal(false); setSelectedTargets(['zammsa_website']); setProofUrls(''); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={handlePublish} disabled={selectedTargets.length === 0 || actionLoading !== ''} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm disabled:opacity-50">
                {actionLoading ? 'Publishing...' : `Publish to ${selectedTargets.length} channel(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GPNDetail;

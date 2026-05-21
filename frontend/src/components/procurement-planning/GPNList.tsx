import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { GeneralProcurementNotice } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { DataTable } from '../common/DataTable';
import toast from 'react-hot-toast';
import { 
  GlobeIcon, ArchiveIcon, CloudUploadIcon, 
  ExternalLinkIcon, CheckIcon, XIcon, PlusIcon
} from '@heroicons/react/outline';

export default function GPNList() {
  const navigate = useNavigate();
  const [gpns, setGpns] = useState<GeneralProcurementNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishModal, setPublishModal] = useState<GeneralProcurementNotice | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['zammsa_website']);
  const [proofUrls, setProofUrls] = useState('');
  const [processing, setProcessing] = useState('');

  const PUBLISH_TARGETS = [
     { key: 'zammsa_website', label: 'ZAMMSA Portal' },
     { key: 'egp_portal', label: 'ZPPA e-GP' },
     { key: 'govt_gazette', label: 'Government Gazette' }
  ];

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
      toast.success(res.message || 'Notice published successfully');
      setPublishModal(null);
      setSelectedTargets(['zammsa_website']);
      setProofUrls('');
      loadGPNs();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Publish failed'); }
    setProcessing('');
  };

  const handleArchive = async (gpn: GeneralProcurementNotice) => {
    if (!window.confirm('Archive this notice?')) return;
    setProcessing(gpn.gpn_id);
    try {
      const res = await procurementPlanningApi.gpn.archive(gpn.gpn_id);
      toast.success(res.message || 'Notice archived');
      loadGPNs();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Archive failed'); }
    setProcessing('');
  };

  const toggleTarget = (t: string) => {
    setSelectedTargets((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const columns = [
    { 
      key: 'gpn_id', 
      label: 'Notice Ref', 
      render: (v: string) => <span className="font-mono text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100 uppercase">{v.slice(0, 8)}</span>
    },
    { 
       key: 'app', 
       label: 'Parent APP', 
       render: (v: string) => <span className="font-bold text-gray-900">APP Reference</span>
    },
    { key: 'publication_status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { 
      key: 'publication_targets', 
      label: 'Active Channels', 
      render: (v: string[]) => (
        <div className="flex gap-1">
           {v?.length ? v.map(t => (
              <span key={t} className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-tighter">{t.split('_')[0]}</span>
           )) : <span className="text-gray-300 italic text-xs">No channels</span>}
        </div>
      )
    },
    { 
      key: 'generated_at', 
      label: 'Generated', 
      render: (v: string) => <span className="text-gray-400 text-xs">{new Date(v).toLocaleDateString('en-GB')}</span>
    },
    { 
      key: 'published_at', 
      label: 'Published', 
      render: (v: string) => v ? <span className="text-emerald-600 font-bold text-xs">{new Date(v).toLocaleDateString('en-GB')}</span> : <span className="text-gray-300">---</span>
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: (_: any, row: any) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.publication_status === 'draft' && (
            <>
              <button onClick={() => setPublishModal(row)} disabled={processing === row.gpn_id} className="p-2 text-zammsa-green hover:bg-green-50 rounded-lg transition-all" title="Publish"><CloudUploadIcon className="w-4 h-4"/></button>
              <button onClick={() => handleArchive(row)} disabled={processing === row.gpn_id} className="p-2 text-gray-400 hover:text-rose-600 transition-all" title="Archive"><ArchiveIcon className="w-4 h-4"/></button>
            </>
          )}
          {row.publication_status === 'published' && (
            <button onClick={() => handleArchive(row)} disabled={processing === row.gpn_id} className="p-2 text-gray-400 hover:text-rose-600 transition-all" title="Archive"><ArchiveIcon className="w-4 h-4"/></button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="pb-12">
      <PageHeader 
        title="Procurement Notices"
        description="Public General Procurement Notices (GPN) registered and dispatched to registries."
      />

      <DataTable 
        columns={columns}
        data={gpns}
        loading={loading}
        onRowClick={(row) => navigate(`/procurement-planning/gpns/${row.gpn_id}`)}
      />

      {gpns.length === 0 && !loading && (
        <div className="mt-8 bg-white rounded-3xl border border-gray-100 p-12 text-center">
           <GlobeIcon className="w-12 h-12 text-gray-100 mx-auto mb-4" />
           <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No notices published yet</p>
           <p className="text-xs text-gray-400 mt-2">Notices are generated automatically from approved APPs.</p>
        </div>
      )}

      {publishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-lg w-full p-10 border border-white/20 transform animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-2xl bg-zammsa-green/10 text-zammsa-green flex items-center justify-center mb-8">
               <CloudUploadIcon className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Dispatch Notice</h3>
            <p className="text-sm font-medium text-gray-500 mt-2 mb-8">Confirm the publication channels and provide any available evidence links.</p>
            
            <div className="space-y-6">
              <div>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Targets</p>
                 <div className="flex flex-wrap gap-2">
                   {PUBLISH_TARGETS.map((t) => (
                     <button 
                        key={t.key} 
                        onClick={() => toggleTarget(t.key)}
                        className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                           selectedTargets.includes(t.key) ? 'bg-zammsa-green border-zammsa-green text-white shadow-lg shadow-zammsa-green/20' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                        }`}
                     >
                       {t.label}
                     </button>
                   ))}
                 </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Evidence Links (Proof URLs)</label>
                <textarea 
                   value={proofUrls} 
                   onChange={(e) => setProofUrls(e.target.value)} 
                   rows={3} 
                   className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm mt-3 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" 
                   placeholder="https://egp.zppa.org.zm/..." 
                />
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={() => { setPublishModal(null); setSelectedTargets(['zammsa_website']); setProofUrls(''); }} className="flex-1 py-4 text-sm font-bold text-gray-400 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all uppercase tracking-widest">Cancel</button>
              <button 
                 onClick={() => handlePublish(publishModal)} 
                 disabled={selectedTargets.length === 0 || processing !== ''} 
                 className="flex-1 py-4 bg-zammsa-green text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-zammsa-green/20 hover:bg-zammsa-green-dark disabled:opacity-50 transition-all"
              >
                {processing ? 'Processing...' : 'Confirm Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
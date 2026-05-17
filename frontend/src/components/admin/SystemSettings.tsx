import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchSystemSettings, updateSystemSetting, uploadLogo, testEmail } from '../../api/admin';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { OfficeBuildingIcon } from '@heroicons/react/outline';

const SystemSettings: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'general' | 'security' | 'email' | 'notifications'>('general');
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [emailTestResult, setEmailTestResult] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['systemSettings', tab],
    queryFn: () => fetchSystemSettings(tab),
  });

  const updateMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => updateSystemSetting(key, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['systemSettings', tab] }); toast.success('Setting updated'); setEditKey(null); },
    onError: (err: any) => toast.error(err?.message || 'Failed'),
  });

  const logoMut = useMutation({
    mutationFn: (file: File) => uploadLogo(file),
    onSuccess: () => toast.success('Logo uploaded'),
    onError: (err: any) => toast.error(err?.message || 'Upload failed'),
  });

  const emailTestMut = useMutation({
    mutationFn: () => testEmail({}),
    onSuccess: () => { setEmailTestResult('Test email sent successfully'); toast.success('Test email sent'); },
    onError: (err: any) => { setEmailTestResult(`Failed: ${err?.message}`); toast.error('Test email failed'); },
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['general', 'security', 'email', 'notifications'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-zammsa-green text-zammsa-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {/* Settings */}
      <div className="bg-white rounded-lg shadow p-5">
        {tab === 'general' && (
          <div className="space-y-4">
            <div><label className="text-xs text-gray-500">Site Logo</label><div className="mt-1 flex items-center gap-3"><div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center"><OfficeBuildingIcon className="h-8 w-8 text-gray-400" /></div><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && logoMut.mutate(e.target.files[0])} className="text-sm" /></div></div>
            {data?.map((s: any) => (
              <div key={s.key}>
                <label className="text-xs text-gray-500">{s.description || s.key}</label>
                {editKey === s.key ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" autoFocus />
                    <button onClick={() => updateMut.mutate({ key: s.key, value: editValue })} disabled={updateMut.isPending} className="px-3 py-1.5 text-xs bg-zammsa-green text-white rounded-lg hover:bg-green-700">Save</button>
                    <button onClick={() => setEditKey(null)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-gray-900">{s.value || '-'}</span>
                    <button onClick={() => { setEditKey(s.key); setEditValue(s.value); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'security' && (
          <div className="space-y-4">
            {data?.map((s: any) => (
              <div key={s.key}>
                <label className="text-xs text-gray-500">{s.description || s.key}</label>
                {editKey === s.key ? (
                  <div className="flex items-center gap-2 mt-1">
                    {s.key.includes('mfa') || s.key.includes('password') ? (
                      <select value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="true">Enabled</option><option value="false">Disabled</option>
                      </select>
                    ) : (
                      <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    )}
                    <button onClick={() => updateMut.mutate({ key: s.key, value: editValue })} disabled={updateMut.isPending} className="px-3 py-1.5 text-xs bg-zammsa-green text-white rounded-lg hover:bg-green-700">Save</button>
                    <button onClick={() => setEditKey(null)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-gray-900">{s.value || '-'}</span>
                    <button onClick={() => { setEditKey(s.key); setEditValue(s.value); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'email' && (
          <div className="space-y-4">
            {data?.map((s: any) => (
              <div key={s.key}>
                <label className="text-xs text-gray-500">{s.description || s.key}</label>
                {editKey === s.key ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    <button onClick={() => updateMut.mutate({ key: s.key, value: editValue })} disabled={updateMut.isPending} className="px-3 py-1.5 text-xs bg-zammsa-green text-white rounded-lg hover:bg-green-700">Save</button>
                    <button onClick={() => setEditKey(null)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-gray-900">{s.key.includes('password') ? '********' : s.value || '-'}</span>
                    <button onClick={() => { setEditKey(s.key); setEditValue(s.value); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                  </div>
                )}
              </div>
            ))}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button onClick={() => emailTestMut.mutate()} disabled={emailTestMut.isPending} className="px-4 py-2 bg-zammsa-orange text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50">Send Test Email</button>
              {emailTestResult && <p className={`text-sm mt-2 ${emailTestResult.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{emailTestResult}</p>}
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Configure notification templates and delivery channels.</p>
            {data?.map((s: any) => (
              <div key={s.key}>
                <label className="text-xs text-gray-500">{s.description || s.key}</label>
                {editKey === s.key ? (
                  <div className="flex items-center gap-2 mt-1">
                    <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
                    <div className="flex flex-col gap-1">
                      <button onClick={() => updateMut.mutate({ key: s.key, value: editValue })} disabled={updateMut.isPending} className="px-3 py-1.5 text-xs bg-zammsa-green text-white rounded-lg hover:bg-green-700">Save</button>
                      <button onClick={() => setEditKey(null)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-gray-900 font-mono text-xs truncate max-w-[80%]">{s.value || '-'}</span>
                    <button onClick={() => { setEditKey(s.key); setEditValue(s.value); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemSettings;

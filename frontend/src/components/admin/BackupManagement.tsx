import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchBackups, createBackup, restoreBackup, updateBackupSchedule } from '../../api/admin';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CheckIcon, ExclamationIcon } from '@heroicons/react/outline';

const BackupManagement: React.FC = () => {
  const qc = useQueryClient();
  const [showRestore, setShowRestore] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({ frequency: 'daily', time: '02:00', retention: '30', offsite_enabled: false, offsite_endpoint: '', offsite_key: '' });

  const { data, isLoading } = useQuery({ queryKey: ['backups'], queryFn: fetchBackups });

  const backupMut = useMutation({
    mutationFn: (type: string) => createBackup(type),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backups'] }); toast.success('Backup created'); },
    onError: (err: any) => toast.error(err?.message || 'Backup failed'),
  });
  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreBackup(id),
    onSuccess: () => { toast.success('Restore initiated. System may be unavailable during restore.'); setShowRestore(null); },
    onError: (err: any) => toast.error(err?.message || 'Restore failed'),
  });
  const configMut = useMutation({
    mutationFn: () => updateBackupSchedule(config),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backups'] }); toast.success('Backup schedule updated'); setShowConfig(false); },
    onError: (err: any) => toast.error(err?.message || 'Failed'),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Backup Management</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => backupMut.mutate('full')} disabled={backupMut.isPending} className="px-4 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">Manual Full Backup</button>
          <button onClick={() => backupMut.mutate('incremental')} disabled={backupMut.isPending} className="px-4 py-2 bg-zammsa-orange text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50">Incremental Backup</button>
        </div>
      </div>

      {/* Backup Schedule Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-5"><p className="text-sm text-gray-500">Next Scheduled Backup</p><p className="text-lg font-bold text-gray-900">Today, 02:00 AM</p></div>
        <div className="bg-white rounded-lg shadow p-5"><p className="text-sm text-gray-500">Last Full Backup</p><p className="text-lg font-bold text-gray-900">{data?.length ? new Date(data[0].created_at).toLocaleDateString() : 'N/A'}</p></div>
        <div className="bg-white rounded-lg shadow p-5"><p className="text-sm text-gray-500">Total Backups</p><p className="text-lg font-bold text-gray-900">{data?.length || 0}</p></div>
      </div>

      {/* Backup List */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Backup History</h2>
        {data && data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left font-medium text-gray-500">Filename</th><th className="px-4 py-3 text-left font-medium text-gray-500">Type</th><th className="px-4 py-3 text-right font-medium text-gray-500">Size</th><th className="px-4 py-3 text-center font-medium text-gray-500">Status</th><th className="px-4 py-3 text-right font-medium text-gray-500">Date</th><th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((b: any) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900">{b.filename}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${b.type === 'full' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.type}</span></td>
                    <td className="px-4 py-3 text-right text-gray-700">{b.size}</td>
                    <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.status === 'completed' ? 'bg-green-100 text-green-700' : b.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.status}</span></td>
                    <td className="px-4 py-3 text-right text-gray-500">{new Date(b.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setShowRestore(b.id)} disabled={b.status !== 'completed'} className="text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed">Restore</button>
                        {b.downloaded ? <CheckIcon className="h-4 w-4 text-green-600" /> : <span className="inline-block w-3 h-3 rounded-full border border-gray-400" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-gray-400 text-sm text-center py-8">No backups yet</p>}
      </div>

      {/* Schedule Config */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Backup Schedule</h2>
          <button onClick={() => setShowConfig(true)} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700">Configure</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-500">Frequency</p><p className="font-medium">Daily</p></div>
          <div><p className="text-gray-500">Time</p><p className="font-medium">02:00 AM</p></div>
          <div><p className="text-gray-500">Retention</p><p className="font-medium">30 days</p></div>
          <div><p className="text-gray-500">Offsite Backup</p><p className="font-medium">Enabled</p></div>
        </div>
      </div>

      {/* Restore Modal */}
      {showRestore && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900">Restore Backup</h3>
            <p className="text-sm text-gray-500 mt-2">Restoring will replace current data with the selected backup. The system will be unavailable during the restore process. This action cannot be undone.</p>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-700 flex items-center gap-1"><ExclamationIcon className="h-4 w-4 flex-shrink-0" /> All current data since this backup will be lost. Ensure you have a recent backup of the current state.</p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowRestore(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => restoreMut.mutate(showRestore)} disabled={restoreMut.isPending} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">{restoreMut.isPending ? 'Restoring...' : 'Restore'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900">Backup Schedule Configuration</h3>
            <div className="mt-4 space-y-3">
              <select value={config.frequency} onChange={(e) => setConfig({ ...config, frequency: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
              <input type="time" value={config.time} onChange={(e) => setConfig({ ...config, time: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input type="number" value={config.retention} onChange={(e) => setConfig({ ...config, retention: e.target.value })} placeholder="Retention (days)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.offsite_enabled} onChange={(e) => setConfig({ ...config, offsite_enabled: e.target.checked })} className="h-4 w-4 text-zammsa-green border-gray-300 rounded" /> Enable Offsite Backup</label>
              {config.offsite_enabled && (<><input value={config.offsite_endpoint} onChange={(e) => setConfig({ ...config, offsite_endpoint: e.target.value })} placeholder="S3/Offsite Endpoint" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /><input value={config.offsite_key} onChange={(e) => setConfig({ ...config, offsite_key: e.target.value })} placeholder="Access Key" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></>)}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowConfig(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => configMut.mutate()} disabled={configMut.isPending} className="px-4 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg hover:bg-green-700 disabled:opacity-50">Save Configuration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupManagement;

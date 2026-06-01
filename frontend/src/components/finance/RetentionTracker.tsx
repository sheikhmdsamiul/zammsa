import React, { useState, useEffect } from 'react';
import { contractsApi } from '../../api/contracts';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

interface RetentionRecord {
  id: string;
  contractNumber: string;
  title: string;
  vendorName: string;
  contractValue: number;
  currency: string;
  retentionExpiry: string | null;
  archivedAt: string | null;
  status: string;
  daysRemaining: number | null;
  legalHold: boolean;
}

const RetentionTracker: React.FC = () => {
  const [records, setRecords] = useState<RetentionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRetention = async () => {
      try {
        const response = await contractsApi.listRetention({});
        const now = new Date();
        const recs = (response.results || []).map((c: any) => {
          const expiry = c.retention_expiry ? new Date(c.retention_expiry) : null;
          const daysRemaining = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
          return {
            id: c.id,
            contractNumber: c.contract_number || 'N/A',
            title: c.title || 'Unknown',
            vendorName: c.vendor_name || 'Unknown',
            contractValue: c.value || 0,
            currency: c.currency || 'ZMW',
            retentionExpiry: c.retention_expiry,
            archivedAt: c.archived_at,
            status: c.status || 'unknown',
            daysRemaining,
            legalHold: c.legal_hold || false,
          };
        });
        setRecords(recs);
      } catch (error) {
        console.error('Error loading retention data:', error);
        toast.error('Failed to load retention data');
      } finally {
        setLoading(false);
      }
    };
    
    loadRetention();
  }, []);

  const getStatusColor = (daysRemaining: number | null, legalHold: boolean) => {
    if (legalHold) return 'bg-rose-50 text-rose-700';
    if (daysRemaining === null) return 'bg-gray-50 text-gray-700';
    if (daysRemaining <= 0) return 'bg-amber-50 text-amber-700';
    if (daysRemaining <= 90) return 'bg-orange-50 text-orange-700';
    if (daysRemaining <= 365) return 'bg-blue-50 text-blue-700';
    return 'bg-emerald-50 text-emerald-700';
  };

  if (loading) return <LoadingSpinner className="py-12" />;

  if (!records.length) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No retention tracking data</h2>
        <p className="mt-2 text-gray-500">Records will appear here after contracts are archived.</p>
      </div>
    );
  }

  const expiringSoon = records.filter(r => r.daysRemaining !== null && r.daysRemaining <= 90 && r.daysRemaining > 0);
  const expired = records.filter(r => r.daysRemaining !== null && r.daysRemaining <= 0);
  const legalHold = records.filter(r => r.legalHold);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retention Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor contract record retention periods and legal holds
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{records.length}</p>
          <p className="text-xs text-gray-500">Total Records</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-amber-700">{expiringSoon.length}</p>
          <p className="text-xs text-amber-600">Expiring Soon (≤90 days)</p>
        </div>
        <div className="bg-white rounded-xl border border-rose-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-rose-700">{expired.length}</p>
          <p className="text-xs text-rose-600">Expired</p>
        </div>
        <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-purple-700">{legalHold.length}</p>
          <p className="text-xs text-purple-600">Legal Hold</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Contract</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Vendor</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Value</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Retention Expiry</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Archived</th>
                <th className="px-6 py-3 text-center font-bold text-gray-500 text-[10px] uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{rec.contractNumber}</div>
                    <div className="text-xs text-gray-600 truncate max-w-xs">{rec.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{rec.vendorName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: rec.currency }).format(rec.contractValue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {rec.retentionExpiry || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {rec.archivedAt || 'Active'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(rec.daysRemaining, rec.legalHold)}`}>
                      {rec.legalHold ? <span>⚖️ Legal Hold</span> :
                       rec.daysRemaining !== null && rec.daysRemaining <= 0 ? <span>🗑️ Expired</span> :
                       rec.daysRemaining !== null && rec.daysRemaining <= 90 ? <span>⚠️ {rec.daysRemaining}d left</span> :
                       rec.daysRemaining !== null ? <span>📦 {rec.daysRemaining}d left</span> :
                       <span>📄 Active</span>}
                    </span>
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

export default RetentionTracker;

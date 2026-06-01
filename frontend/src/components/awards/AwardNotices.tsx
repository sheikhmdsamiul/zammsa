import React, { useState, useEffect } from 'react';
import { contractsApi } from '../../api/contracts';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

interface NoticeRecord {
  id: string;
  contractNumber: string;
  title: string;
  vendorName: string;
  awardDate: string;
  publishedAt: string | null;
  waitingPeriodEnd: string | null;
  needsAttention: boolean;
}

const AwardNotices: React.FC = () => {
  const [contracts, setContracts] = useState<NoticeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotices = async () => {
      try {
        const response = await contractsApi.list({ status: 'active' });
        const records = (response.results || []).map((c: any) => ({
          id: c.id,
          contractNumber: c.contract_number,
          title: c.title,
          vendorName: c.vendor_name || 'Unknown',
          awardDate: c.award_date || 'TBD',
          publishedAt: c.award_notice_published_at,
          waitingPeriodEnd: c.waiting_period_end,
          needsAttention: c.appeal_pending || !c.award_notice_published,
        }));
        setContracts(records);
      } catch (error) {
        console.error('Error loading notices:', error);
        toast.error('Failed to load award notices');
      } finally {
        setLoading(false);
      }
    };
    
    loadNotices();
  }, []);

  if (loading) return <LoadingSpinner className="py-12" />;

  if (!contracts.length) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No award notices</h2>
        <p className="mt-2 text-gray-500">Award notices will appear here after contracts are awarded.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Award Notices Status</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track award notice publication and waiting period compliance
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gray-500"></span>
            Total: {contracts.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            Needs Attention: {contracts.filter(c => c.needsAttention).length}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Contract</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Vendor</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Award Date</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Notice Published</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Waiting Period</th>
                <th className="px-6 py-3 text-center font-bold text-gray-500 text-[10px] uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{record.contractNumber}</div>
                    <div className="text-xs text-gray-600 truncate max-w-xs">{record.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{record.vendorName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{record.awardDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {record.publishedAt || <span className="text-gray-400">Not published</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {record.waitingPeriodEnd || <span className="text-gray-400">TBD</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {record.needsAttention ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
                        ⚠️ Needs Attention
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                        ✅ Complete
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

export default AwardNotices;

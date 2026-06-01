import React, { useState, useEffect } from 'react';
import { contractsApi } from '../../api/contracts';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

interface MilestoneRecord {
  id: string;
  contractNumber: string;
  title: string;
  dueDate: string;
  status: string;
  completionDate: string | null;
  notes: string | null;
}

const MilestoneTracker: React.FC = () => {
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractFilter, setContractFilter] = useState<string>('all');

  useEffect(() => {
    const loadMilestones = async () => {
      try {
        const params: Record<string, any> = {};
        if (contractFilter !== 'all') {
          params.contract = contractFilter;
        }
        
        const response = await contractsApi.listMilestones(params);
        const records = (response.results || []).map((m: any) => ({
          id: m.id,
          contractNumber: m.contract?.contract_number || 'Unknown',
          title: m.title || m.milestone_name || 'Milestone',
          dueDate: m.due_date,
          status: m.status || 'pending',
          completionDate: m.completion_date,
          notes: m.notes,
        }));
        setMilestones(records);
      } catch (error) {
        console.error('Error loading milestones:', error);
        toast.error('Failed to load milestones');
      } finally {
        setLoading(false);
      }
    };
    
    loadMilestones();
  }, [contractFilter]);

  if (loading) return <LoadingSpinner className="py-12" />;

  if (!milestones.length) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No milestones</h2>
        <p className="mt-2 text-gray-500">Milestones will appear here after contract award.</p>
      </div>
    );
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700';
      case 'in_progress': return 'bg-blue-50 text-blue-700';
      case 'delayed': return 'bg-amber-50 text-amber-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contract Milestones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor contract milestone delivery and completion
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Contracts</option>
            {Array.from(new Set(milestones.map(m => m.contractNumber))).map((cn) => (
              <option key={cn} value={cn}>{cn}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['pending', 'in_progress', 'completed', 'delayed'].map((status) => {
          const count = milestones.filter(m => m.status === status).length;
          return (
            <div key={status} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                  status === 'pending' ? 'bg-gray-100 text-gray-600' :
                  status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                  status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-amber-100 text-amber-600'
                }`}>
                  {status === 'pending' ? '⏳' : status === 'in_progress' ? '🚀' : status === 'completed' ? '✅' : '⚠️'}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500 capitalize">{status.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Contract</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Milestone</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Due Date</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {milestones.map((milestone) => (
                <tr key={milestone.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{milestone.contractNumber}</div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{milestone.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {new Date(milestone.dueDate).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusColor(milestone.status)}`}>
                      <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
                      {milestone.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {milestone.completionDate || '—'}
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

export default MilestoneTracker;

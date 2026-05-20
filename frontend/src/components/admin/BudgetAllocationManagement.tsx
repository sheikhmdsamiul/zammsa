import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchBudgetAllocations, createBudgetAllocation, updateBudgetAllocation, fetchDepartments, fetchFiscalYears } from '../../api/admin';
import { LoadingSpinner } from '../common/LoadingSpinner';

const BudgetAllocationManagement: React.FC = () => {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ entity_code: '', fiscal_year: '', allocated_amount: '' });

  const { data, isLoading } = useQuery({ queryKey: ['budgetAllocations'], queryFn: fetchBudgetAllocations });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const { data: fiscalYears } = useQuery({ queryKey: ['fiscalYears'], queryFn: fetchFiscalYears });

  const updateMut = useMutation({
    mutationFn: ({ id, allocated_amount }: { id: string; allocated_amount: number }) => updateBudgetAllocation(id, { allocated_amount }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgetAllocations'] }); toast.success('Budget updated'); setEditId(null); },
    onError: (err: any) => toast.error(err?.message || 'Failed to update'),
  });

  const createMut = useMutation({
    mutationFn: () => createBudgetAllocation({
      entity_code: createForm.entity_code,
      fiscal_year: createForm.fiscal_year,
      allocated_amount: parseFloat(createForm.allocated_amount) || 0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgetAllocations'] }); toast.success('Budget allocation created'); setShowCreate(false); setCreateForm({ entity_code: '', fiscal_year: '', allocated_amount: '' }); },
    onError: (err: any) => toast.error(err?.message || 'Failed to create'),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Budget Allocations</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-green-700">+ Add Allocation</button>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Department</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Fiscal Year</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Allocated</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Encumbered</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Expended</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Available</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Source</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.map((ba: any) => (
                <tr key={ba.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ba.entity_name}</td>
                  <td className="px-4 py-3 text-gray-600">{ba.fiscal_year}</td>
                  <td className="px-4 py-3 text-right">
                    {editId === ba.id ? (
                      <input
                        type="number" min="0" step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-32 border border-gray-300 rounded px-2 py-1 text-right text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="font-mono">K {Number(ba.allocated_amount).toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">K {Number(ba.encumbered_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">K {Number(ba.expended_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">K {Number(ba.available).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ba.sync_source === 'erp_api' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {ba.sync_source === 'erp_api' ? 'ERP' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editId === ba.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { const num = parseFloat(editValue); if (isNaN(num) || num < 0) { toast.error('Enter a valid amount'); return; } updateMut.mutate({ id: ba.id, allocated_amount: num }); }} disabled={updateMut.isPending} className="text-xs text-green-600 hover:underline font-medium">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditId(ba.id); setEditValue(String(ba.allocated_amount)); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                    )}
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No budget allocations yet. Click "+ Add Allocation" to create one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900">Add Budget Allocation</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500">Department</label>
                <select value={createForm.entity_code} onChange={(e) => setCreateForm({ ...createForm, entity_code: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="">Select department...</option>
                  {(departments || []).map((d: any) => (
                    <option key={d.id} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Fiscal Year</label>
                <select value={createForm.fiscal_year} onChange={(e) => setCreateForm({ ...createForm, fiscal_year: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="">Select fiscal year...</option>
                  {(fiscalYears || []).map((fy: any) => (
                    <option key={fy.id} value={fy.name}>{fy.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Allocated Amount (ZMW)</label>
                <input type="number" min="0" step="0.01" value={createForm.allocated_amount} onChange={(e) => setCreateForm({ ...createForm, allocated_amount: e.target.value })} placeholder="e.g. 5000000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !createForm.entity_code || !createForm.fiscal_year} className="px-4 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg hover:bg-green-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetAllocationManagement;

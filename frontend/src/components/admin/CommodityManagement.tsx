import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchCommodities, createCommodity, updateCommodity, deleteCommodity } from '../../api/admin';
import { LoadingSpinner } from '../common/LoadingSpinner';

const CommodityManagement: React.FC = () => {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ commodity_code: '', commodity_name: '', category: '', sub_category: '' });

  const { data, isLoading } = useQuery({ queryKey: ['commodities'], queryFn: fetchCommodities });

  const createMut = useMutation({
    mutationFn: () => createCommodity(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commodities'] }); toast.success('Commodity created'); closeModal(); },
    onError: (err: any) => toast.error(err?.message || 'Failed to create'),
  });

  const updateMut = useMutation({
    mutationFn: () => updateCommodity(editingId!, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commodities'] }); toast.success('Commodity updated'); closeModal(); },
    onError: (err: any) => toast.error(err?.message || 'Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCommodity(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commodities'] }); toast.success('Commodity deactivated'); },
    onError: (err: any) => toast.error(err?.message || 'Failed to delete'),
  });

  function closeModal() { setShowModal(false); setEditingId(null); setForm({ commodity_code: '', commodity_name: '', category: '', sub_category: '' }); }

  function openCreate() { setForm({ commodity_code: '', commodity_name: '', category: '', sub_category: '' }); setEditingId(null); setShowModal(true); }

  function openEdit(item: any) {
    setForm({ commodity_code: item.commodity_code, commodity_name: item.commodity_name, category: item.category, sub_category: item.sub_category });
    setEditingId(item.id); setShowModal(true);
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Commodity Management</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-green-700">+ Add Commodity</button>
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Code</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Sub-Category</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">UOM</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.commodity_code}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.commodity_name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.category}</td>
                  <td className="px-4 py-3 text-gray-600">{c.sub_category}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{c.uom_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(c)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      {c.is_active && (
                        <button onClick={() => deleteMut.mutate(c.id)} disabled={deleteMut.isPending} className="text-xs text-red-600 hover:underline">Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No commodities found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-medium text-gray-900">{editingId ? 'Edit Commodity' : 'Add Commodity'}</h3>
            <div className="mt-4 space-y-3">
              <input
                value={form.commodity_code}
                onChange={(e) => setForm({ ...form, commodity_code: e.target.value })}
                placeholder="Code (e.g. MED-PAR-001)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={form.commodity_name}
                onChange={(e) => setForm({ ...form, commodity_name: e.target.value })}
                placeholder="Name (e.g. Paracetamol 500mg Tablets)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Category (e.g. Pharmaceuticals)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={form.sub_category}
                onChange={(e) => setForm({ ...form, sub_category: e.target.value })}
                placeholder="Sub-Category (e.g. Analgesics)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => (editingId ? updateMut : createMut).mutate()}
                disabled={createMut.isPending || updateMut.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommodityManagement;

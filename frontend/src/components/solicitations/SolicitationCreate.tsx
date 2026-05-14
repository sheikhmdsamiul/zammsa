import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { solicitationsApi } from '../../api/solicitations';
import toast from 'react-hot-toast';
import DepartmentSelect from '../common/DepartmentSelect';

const SolicitationCreate: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', type: 'rfb', department: '', procurement_method: 'open',
    estimated_value: 0, currency: 'ZMW', budget_code: '', issue_date: '',
    closing_date: '', closing_hour: '10', closing_minute: '00',
    opening_date: '', opening_hour: '10', opening_minute: '00',
    requisition: '',
  });

  const getDateTime = (date: string, hour: string, minute: string) => {
    if (!date) return '';
    return `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 8).padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const mutation = useMutation({
    mutationFn: (data: any) => solicitationsApi.create(data),
    onSuccess: (res) => {
      toast.success('Solicitation created successfully');
      navigate(`/solicitations/${res.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      closing_date: getDateTime(form.closing_date, form.closing_hour, form.closing_minute),
      opening_date: getDateTime(form.opening_date, form.opening_hour, form.opening_minute),
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Create Solicitation</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Solicitation Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green">
                <option value="rfq">RFQ - Request for Quotation</option>
                <option value="rfb">RFB - Request for Bids</option>
                <option value="rfp">RFP - Request for Proposals</option>
                <option value="rfi">RFI - Request for Information</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <DepartmentSelect value={form.department} onChange={(v) => setForm({ ...form, department: v })} required className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Procurement Method</label>
              <select value={form.procurement_method} onChange={(e) => setForm({ ...form, procurement_method: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green">
                <option value="open">Open Tender</option>
                <option value="limited">Limited Bidding</option>
                <option value="direct">Direct Procurement</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Value</label>
              <input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: parseFloat(e.target.value) || 0 })} min={0} className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green">
                <option value="ZMW">ZMW</option><option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget Code</label>
              <input type="text" value={form.budget_code} onChange={(e) => setForm({ ...form, budget_code: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requisition ID (optional)</label>
              <input type="text" value={form.requisition} onChange={(e) => setForm({ ...form, requisition: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
              <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Closing Date</label>
              <input type="date" value={form.closing_date} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} required className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green" />
              <div className="flex gap-2 mt-2">
                <select value={form.closing_hour} onChange={(e) => setForm({ ...form, closing_hour: e.target.value })} className="flex-1 border-gray-300 rounded-lg px-2 py-2 focus:ring-zammsa-green focus:border-zammsa-green text-sm">
                  {hours.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="self-center text-gray-500">:</span>
                <select value={form.closing_minute} onChange={(e) => setForm({ ...form, closing_minute: e.target.value })} className="flex-1 border-gray-300 rounded-lg px-2 py-2 focus:ring-zammsa-green focus:border-zammsa-green text-sm">
                  {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Date</label>
              <input type="date" value={form.opening_date} onChange={(e) => setForm({ ...form, opening_date: e.target.value })} required className="w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green" />
              <div className="flex gap-2 mt-2">
                <select value={form.opening_hour} onChange={(e) => setForm({ ...form, opening_hour: e.target.value })} className="flex-1 border-gray-300 rounded-lg px-2 py-2 focus:ring-zammsa-green focus:border-zammsa-green text-sm">
                  {hours.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="self-center text-gray-500">:</span>
                <select value={form.opening_minute} onChange={(e) => setForm({ ...form, opening_minute: e.target.value })} className="flex-1 border-gray-300 rounded-lg px-2 py-2 focus:ring-zammsa-green focus:border-zammsa-green text-sm">
                  {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/solicitations')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="px-6 py-2 text-sm font-medium text-white bg-zammsa-green rounded-lg hover:bg-zammsa-green-dark disabled:opacity-50">
            {mutation.isPending ? 'Creating...' : 'Create Solicitation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SolicitationCreate;

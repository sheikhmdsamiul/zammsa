import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { solicitationsApi } from '../../api/solicitations';
import toast from 'react-hot-toast';

interface Template {
  template_id: string;
  template_name: string;
  method: string;
  document_type: string;
  version: string;
  is_active: boolean;
  is_zppa_template: boolean;
  mandatory_clauses: any[];
  template_content?: string;
}

const METHOD_OPTIONS = [
  { value: 'itb', label: 'ITB (Goods/Works)' },
  { value: 'open_tender', label: 'Open National Bidding' },
  { value: 'rfp', label: 'RFP (Consulting)' },
  { value: 'rfq', label: 'RFQ (Quotations)' },
  { value: 'international', label: 'International' },
  { value: 'limited', label: 'Limited' },
  { value: 'simplified', label: 'Simplified' },
  { value: 'direct', label: 'Direct' },
  { value: '', label: 'All / General' },
];

const DOC_TYPE_OPTIONS = [
  { value: 'bidding_document', label: 'Bidding Document' },
  { value: 'specification', label: 'Specification' },
  { value: 'addendum', label: 'Addendum' },
  { value: 'other', label: 'Other' },
];

export default function TemplateManagement() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const [form, setForm] = useState({
    template_name: '',
    method: '',
    document_type: 'bidding_document',
    version: '1.0',
    is_active: true,
    is_zppa_template: true,
    template_content: '',
    mandatory_clauses: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-templates', filter],
    queryFn: () => solicitationsApi.templates.list({ search: filter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => solicitationsApi.templates.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Template created');
      resetForm();
    },
    onError: () => toast.error('Failed to create template'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => solicitationsApi.templates.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Template updated');
      resetForm();
    },
    onError: () => toast.error('Failed to update template'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => solicitationsApi.templates.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Template deleted');
    },
    onError: () => toast.error('Failed to delete template'),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({
      template_name: '', method: '', document_type: 'bidding_document',
      version: '1.0', is_active: true, is_zppa_template: true,
      template_content: '', mandatory_clauses: '',
    });
  };

  const handleEdit = (tpl: Template) => {
    setEditId(tpl.template_id);
    setForm({
      template_name: tpl.template_name,
      method: tpl.method,
      document_type: tpl.document_type,
      version: tpl.version,
      is_active: tpl.is_active,
      is_zppa_template: tpl.is_zppa_template,
      template_content: tpl.template_content || '',
      mandatory_clauses: JSON.stringify(tpl.mandatory_clauses, null, 2),
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      mandatory_clauses: (() => {
        try { return JSON.parse(form.mandatory_clauses || '[]'); }
        catch { return []; }
      })(),
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  };

  const templates: Template[] = data?.results || [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitation Templates</h1>
          <p className="text-gray-500 mt-1">Manage ITB, RFP, RFQ templates and clause library</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-zammsa-green text-white rounded-lg hover:bg-green-700 transition"
        >
          {showForm ? 'Cancel' : '+ Upload New Template'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editId ? 'Edit Template' : 'Create / Upload Template'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <input
                value={form.template_name}
                onChange={e => setForm(f => ({ ...f, template_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zammsa-green focus:border-transparent"
                placeholder="e.g. Standard ITB (Goods)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
              <select
                value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zammsa-green focus:border-transparent"
              >
                {METHOD_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
              <select
                value={form.document_type}
                onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zammsa-green focus:border-transparent"
              >
                {DOC_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <input
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zammsa-green focus:border-transparent"
                placeholder="e.g. v3.2 2026"
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="rounded text-zammsa-green focus:ring-zammsa-green" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_zppa_template}
                  onChange={e => setForm(f => ({ ...f, is_zppa_template: e.target.checked }))}
                  className="rounded text-zammsa-green focus:ring-zammsa-green" />
                <span className="text-sm text-gray-700">ZPPA-Approved</span>
              </label>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Content (HTML)</label>
            <textarea
              value={form.template_content}
              onChange={e => setForm(f => ({ ...f, template_content: e.target.value }))}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-zammsa-green focus:border-transparent"
              placeholder="<h2>Invitation to Bid</h2><p>...</p>"
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Mandatory Clauses (JSON)</label>
            <textarea
              value={form.mandatory_clauses}
              onChange={e => setForm(f => ({ ...f, mandatory_clauses: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-zammsa-green focus:border-transparent"
              placeholder='[{"clause_id": "...", "clause_text": "...", "is_locked": true}]'
            />
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!form.template_name || createMutation.isPending || updateMutation.isPending}
              className="px-6 py-2 bg-zammsa-green text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {editId ? 'Update Template' : 'Create Template'}
            </button>
            <button onClick={resetForm} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search templates..."
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zammsa-green focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Template Name</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Type</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Version</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Status</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">ZPPA</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : templates.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No templates found</td></tr>
            ) : templates.map((tpl: Template) => (
              <tr key={tpl.template_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{tpl.template_name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                    {tpl.method || 'General'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{tpl.version}</td>
                <td className="px-4 py-3">
                  {tpl.is_active ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-red-600">
                      <span className="w-2 h-2 bg-red-500 rounded-full" /> Retired
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {tpl.is_zppa_template ? (
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-600">ZPPA</span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleEdit(tpl)}
                    className="text-sm text-zammsa-green hover:text-green-700 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${tpl.template_name}"?`)) deleteMutation.mutate(tpl.template_id);
                    }}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

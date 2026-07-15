import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, ClipboardListIcon,
  ChevronDownIcon, ChevronUpIcon, ClockIcon,
} from '@heroicons/react/outline';

const CATEGORY_LABELS: Record<string, string> = {
  legal: 'Legal & Registration',
  financial: 'Financial',
  technical: 'Technical Capacity',
  reference: 'Client References',
  compliance: 'Compliance',
};

const CATEGORY_COLORS: Record<string, string> = {
  legal: 'bg-blue-50 text-blue-700 border-blue-200',
  financial: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  technical: 'bg-purple-50 text-purple-700 border-purple-200',
  reference: 'bg-amber-50 text-amber-700 border-amber-200',
  compliance: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PostQualification: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedPQ, setSelectedPQ] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    legal: true, financial: true, technical: true, reference: true, compliance: true,
  });
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState('');
  const [contactResult, setContactResult] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['post-qualifications', page, pageSize, search],
    queryFn: () => evaluationsApi.listPostQuals({ page, page_size: pageSize, search }),
  });

  const { data: selectedData, isLoading: selectedLoading } = useQuery({
    queryKey: ['post-qualification', selectedPQ],
    queryFn: () => evaluationsApi.getPostQual(selectedPQ!),
    enabled: !!selectedPQ,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ pqId, itemId, status, notes, contact_result }: any) =>
      evaluationsApi.updatePQItem(pqId, { item_id: itemId, status, notes, contact_result }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['post-qualifications'] });
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      queryClient.invalidateQueries({ queryKey: ['phase-status'] });
      setEditingItem(null);
      setItemNotes('');
      setContactResult('');
      toast.success('Verification item updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to update'),
  });

  const generateChecklistMutation = useMutation({
    mutationFn: (pqId: string) => evaluationsApi.generatePQChecklist(pqId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['post-qualifications'] });
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      toast.success('Verification checklist generated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to generate checklist'),
  });

  const pqs = data?.results || [];
  const selected = selectedData;
  const verificationItems = selected?.verification_items || [];

  const pending = pqs.filter((p: any) => p.status === 'pending').length;
  const inProgress = pqs.filter((p: any) => p.status === 'in_progress').length;
  const cleared = pqs.filter((p: any) => p.status === 'cleared').length;
  const failed = pqs.filter((p: any) => p.status === 'failed').length;

  const groupedItems = verificationItems.reduce((acc: Record<string, any[]>, item: any) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryProgress = (items: any[]) => {
    const done = items.filter(i => i.status === 'cleared' || i.status === 'failed').length;
    return { done, total: items.length, percent: items.length > 0 ? Math.round((done / items.length) * 100) : 0 };
  };

  const overallProgress = verificationItems.length > 0
    ? Math.round((verificationItems.filter((i: any) => i.status === 'cleared' || i.status === 'failed').length / verificationItems.length) * 100)
    : 0;

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleUpdateItem = (itemId: string, status: string) => {
    if (!selectedPQ) return;
    updateItemMutation.mutate({
      pqId: selectedPQ,
      itemId,
      status,
      notes: itemNotes,
      contact_result: contactResult,
    });
  };

  // Detail view
  if (selectedPQ && selected) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => { setSelectedPQ(null); setEditingItem(null); }}
              className="text-sm text-gray-500 hover:text-gray-900 mb-1 flex items-center gap-1"
            >
              ← Back to Post-Qualifications
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Post-Qualification Verification</h1>
              <StatusBadge status={selected.status} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {selected.submission_id} — {selected.bidder_name}
            </p>
          </div>
          {(!selected.verification_items || selected.verification_items.length === 0) && (
            <button
              onClick={() => generateChecklistMutation.mutate(selectedPQ)}
              disabled={generateChecklistMutation.isPending}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
            >
              <ClipboardListIcon className="w-4 h-4" />
              {generateChecklistMutation.isPending ? 'Generating...' : 'Generate Checklist'}
            </button>
          )}
        </div>

        {selectedLoading ? <LoadingSpinner className="py-12" /> : (
          <>
            {/* Progress Overview */}
            {verificationItems.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Verification Progress</h3>
                  <span className={`text-sm font-bold ${overallProgress === 100 ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {overallProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      overallProgress === 100 ? 'bg-emerald-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-gray-900">{verificationItems.length}</p>
                    <p className="text-[10px] text-gray-500">Total Items</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-emerald-600">
                      {verificationItems.filter((i: any) => i.status === 'cleared').length}
                    </p>
                    <p className="text-[10px] text-emerald-600">Cleared</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-red-600">
                      {verificationItems.filter((i: any) => i.status === 'failed').length}
                    </p>
                    <p className="text-[10px] text-red-600">Failed</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-lg font-bold text-amber-600">
                      {verificationItems.filter((i: any) => i.status === 'pending' || i.status === 'in_progress').length}
                    </p>
                    <p className="text-[10px] text-amber-600">Pending</p>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Categories */}
            {verificationItems.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <ClipboardListIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Verification Checklist</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Generate a verification checklist to begin post-qualification checks.
                </p>
                <button
                  onClick={() => generateChecklistMutation.mutate(selectedPQ)}
                  disabled={generateChecklistMutation.isPending}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
                >
                  {generateChecklistMutation.isPending ? 'Generating...' : 'Generate Verification Checklist'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                  const items = groupedItems[cat];
                  if (!items || items.length === 0) return null;
                  const prog = categoryProgress(items);
                  const isExpanded = expandedCategories[cat];

                  return (
                    <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleCategory(cat)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`px-2 py-1 rounded text-xs font-semibold border ${CATEGORY_COLORS[cat]}`}>
                            {label}
                          </div>
                          <span className="text-xs text-gray-500">
                            {prog.done}/{prog.total} complete
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-20 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-full rounded-full ${prog.percent === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                              style={{ width: `${prog.percent}%` }}
                            />
                          </div>
                          {isExpanded ? (
                            <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          {items.map((item: any) => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-3 p-4 border-b border-gray-50 last:border-b-0 ${
                                item.status === 'cleared' ? 'bg-emerald-50/30' :
                                item.status === 'failed' ? 'bg-red-50/30' : ''
                              }`}
                            >
                              <div className="shrink-0">
                                {item.status === 'cleared' ? (
                                  <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                                ) : item.status === 'failed' ? (
                                  <XCircleIcon className="w-5 h-5 text-red-500" />
                                ) : (
                                  <ClockIcon className="w-5 h-5 text-gray-300" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                                {item.notes && (
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">{item.notes}</p>
                                )}
                                {item.contact_result && (
                                  <p className="text-xs text-blue-600 mt-0.5 truncate">{item.contact_result}</p>
                                )}
                                {item.verified_by && (
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    Verified by {item.verified_by} on {item.verified_at ? new Date(item.verified_at).toLocaleDateString() : '-'}
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0 flex items-center gap-1">
                                {editingItem === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleUpdateItem(item.id, 'cleared')}
                                      className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded hover:bg-emerald-700"
                                    >
                                      Pass
                                    </button>
                                    <button
                                      onClick={() => handleUpdateItem(item.id, 'failed')}
                                      className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                                    >
                                      Fail
                                    </button>
                                    <button
                                      onClick={() => { setEditingItem(null); setItemNotes(''); setContactResult(''); }}
                                      className="px-2 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold rounded hover:bg-gray-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingItem(item.id);
                                      setItemNotes(item.notes || '');
                                      setContactResult(item.contact_result || '');
                                    }}
                                    className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded hover:bg-gray-200"
                                  >
                                    Update
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                          {editingItem && (
                            <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Verification Notes</label>
                                <textarea
                                  value={itemNotes}
                                  onChange={(e) => setItemNotes(e.target.value)}
                                  rows={2}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                  placeholder="Enter verification notes..."
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Contact Result</label>
                                <input
                                  value={contactResult}
                                  onChange={(e) => setContactResult(e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                  placeholder="e.g. Confirmed by phone on 2024-01-15"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Overall Notes</h3>
              <textarea
                value={selected.notes || ''}
                onChange={(e) => {
                  // TODO: Save notes on blur
                }}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Add overall verification notes for this supplier..."
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Post-Qualification</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verify winning bidder credentials, references, and compliance before contract award
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending</p>
            <ClockIcon className="w-5 h-5 text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-orange-600 mt-1">{pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">In Progress</p>
            <ClipboardListIcon className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-blue-600 mt-1">{inProgress}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cleared</p>
            <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{cleared}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Failed</p>
            <XCircleIcon className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-3xl font-bold text-red-600 mt-1">{failed}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by bidder name or submission ID..." />
        </div>

        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <div className="divide-y divide-gray-100">
            {pqs.map((pq: any) => {
              const items = pq.verification_items || [];
              const done = items.filter((i: any) => i.status === 'cleared' || i.status === 'failed').length;
              const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

              return (
                <div
                  key={pq.id}
                  onClick={() => setSelectedPQ(pq.id)}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="shrink-0">
                    {pq.status === 'cleared' ? (
                      <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                    ) : pq.status === 'failed' ? (
                      <XCircleIcon className="w-8 h-8 text-red-500" />
                    ) : pq.status === 'in_progress' ? (
                      <ClipboardListIcon className="w-8 h-8 text-blue-500" />
                    ) : (
                      <ClockIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{pq.bidder_name}</p>
                      <StatusBadge status={pq.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{pq.submission_id}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    {items.length > 0 ? (
                      <>
                        <p className="text-sm font-bold text-gray-900">{pct}%</p>
                        <p className="text-[10px] text-gray-500">{done}/{items.length} items</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">No checklist</p>
                    )}
                  </div>

                  <ChevronDownIcon className="w-5 h-5 text-gray-300 -rotate-90 shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        {pqs.length === 0 && !isLoading && (
          <div className="py-12 text-center text-gray-400">
            <ClipboardListIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">No post-qualification records</p>
            <p className="text-sm mt-1">Records are created when a winner is selected during Financial Evaluation</p>
          </div>
        )}

        {data && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil((data.count || 0) / pageSize)}
            pageSize={pageSize}
            totalItems={data.count || 0}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default PostQualification;

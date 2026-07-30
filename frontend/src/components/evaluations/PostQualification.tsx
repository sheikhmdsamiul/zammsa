import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import toast from 'react-hot-toast';
import type {
  PostQualification as PQType, PQVerificationItem, PQVerificationContext,
  PQStage, PQCondition, PQDocumentRequest, PQCommitteeReview,
} from '../../types';

const STAGE_LABELS: Record<PQStage, string> = {
  initiation: 'Initiation',
  desktop_review: 'Desktop Review',
  document_collection: 'Document Collection',
  site_inspection: 'Site Inspection',
  reference_check: 'Reference Check',
  evaluation: 'Evaluation & Recommendation',
  committee_review: 'Committee Review',
  closed: 'Closed',
};

const STAGE_ORDER: PQStage[] = ['initiation', 'desktop_review', 'document_collection', 'site_inspection', 'reference_check', 'evaluation', 'committee_review', 'closed'];

const CATEGORY_LABELS: Record<string, string> = {
  legal: 'Legal & Registration',
  financial: 'Financial',
  technical: 'Technical Capacity',
  reference: 'References',
};

const CATEGORY_COLORS: Record<string, string> = {
  legal: 'bg-blue-50 text-blue-700 border-blue-200',
  financial: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  technical: 'bg-purple-50 text-purple-700 border-purple-200',
  reference: 'bg-amber-50 text-amber-700 border-amber-200',
};

const CATEGORY_BAR_COLORS: Record<string, string> = {
  legal: 'bg-blue-500',
  financial: 'bg-emerald-500',
  technical: 'bg-purple-500',
  reference: 'bg-amber-500',
};

const PostQualification: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const solicitationFilter = searchParams.get('solicitation') || '';
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedPQ, setSelectedPQ] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('checklist');

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    legal: true, financial: true, technical: true, reference: true,
  });
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState('');
  const [contactResult, setContactResult] = useState('');
  const [notesValue, setNotesValue] = useState('');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignUserId, setReassignUserId] = useState('');
  const [showChairDecision, setShowChairDecision] = useState(false);
  const [chairDecision, setChairDecision] = useState<'passed' | 'failed' | 'passed_with_conditions' | null>(null);
  const [chairNotes, setChairNotes] = useState('');
  const [chairConditions, setChairConditions] = useState<{ condition: string; deadline: string }[]>([]);
  const [editingSiteVisit, setEditingSiteVisit] = useState<string | null>(null);
  const [siteVisitData, setSiteVisitData] = useState({ date: '', visited_by: '', location: '', observations: '', photos: [] as string[] });
  const [editingReference, setEditingReference] = useState<string | null>(null);

  const [showDocRequest, setShowDocRequest] = useState(false);
  const [docType, setDocType] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docDueDate, setDocDueDate] = useState('');

  const [showCondition, setShowCondition] = useState(false);
  const [conditionDesc, setConditionDesc] = useState('');
  const [conditionDeadline, setConditionDeadline] = useState('');

  const [recommendationText, setRecommendationText] = useState('');
  const [showRecommendation, setShowRecommendation] = useState(false);

  const [committeeDecision, setCommitteeDecision] = useState<'approve' | 'approve_with_conditions' | 'reject' | null>(null);
  const [committeeComments, setCommitteeComments] = useState('');
  const [showCommitteeReview, setShowCommitteeReview] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['post-qualifications', page, pageSize, search, solicitationFilter],
    queryFn: () => evaluationsApi.listPostQuals({ page, page_size: pageSize, search, solicitation: solicitationFilter || undefined }),
  });

  const { data: selectedData, isLoading: selectedLoading } = useQuery({
    queryKey: ['post-qualification', selectedPQ],
    queryFn: () => evaluationsApi.getPostQual(selectedPQ!),
    enabled: !!selectedPQ,
  });

  const { data: contextData, isLoading: contextLoading } = useQuery({
    queryKey: ['pq-verification-context', selectedPQ],
    queryFn: () => evaluationsApi.getPQVerificationContext(selectedPQ!),
    enabled: !!selectedPQ,
  });

  const saveNotesMutation = useMutation({
    mutationFn: (data: { pqId: string; notes: string }) =>
      evaluationsApi.savePQNotes(data.pqId, data.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      toast.success('Notes saved');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to save notes'),
  });

  const reassignMutation = useMutation({
    mutationFn: (data: { pqId: string; assignedTo: string }) =>
      evaluationsApi.reassignPQ(data.pqId, data.assignedTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      queryClient.invalidateQueries({ queryKey: ['post-qualifications'] });
      toast.success('Post-qualification reassigned');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to reassign'),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ pqId, itemId, status, notes, contact_result, site_visit, reference_data }: {
      pqId: string; itemId: string; status?: string; notes?: string;
      contact_result?: string; site_visit?: any; reference_data?: any;
    }) =>
      evaluationsApi.updatePQItem(pqId, { item_id: itemId, status, notes, contact_result, site_visit, reference_data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualifications'] });
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      queryClient.invalidateQueries({ queryKey: ['pq-verification-context', selectedPQ] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualifications'] });
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      queryClient.invalidateQueries({ queryKey: ['pq-verification-context', selectedPQ] });
      toast.success('Verification checklist generated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to generate checklist'),
  });

  const advanceStageMutation = useMutation({
    mutationFn: ({ pqId, stage }: { pqId: string; stage: PQStage }) =>
      evaluationsApi.advancePQStage(pqId, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualifications'] });
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      toast.success('Workflow stage advanced');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to advance stage'),
  });

  const chairDecisionMutation = useMutation({
    mutationFn: ({ pqId, decision, decision_notes, conditions }: {
      pqId: string; decision: 'passed' | 'failed' | 'passed_with_conditions'; decision_notes?: string; conditions?: any[];
    }) => evaluationsApi.submitPQChairDecision(pqId, { decision, decision_notes, conditions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualifications'] });
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      queryClient.invalidateQueries({ queryKey: ['pq-verification-context', selectedPQ] });
      setShowChairDecision(false);
      setChairDecision(null);
      setChairNotes('');
      setChairConditions([]);
      toast.success('Chair decision recorded');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to record chair decision'),
  });

  const docRequestMutation = useMutation({
    mutationFn: (data: { pqId: string; document_type: string; description: string; due_date?: string }) =>
      evaluationsApi.managePQDocuments(data.pqId, { action: 'request', ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      setShowDocRequest(false);
      setDocType('');
      setDocDescription('');
      setDocDueDate('');
      toast.success('Document request created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to request document'),
  });

  const conditionMutation = useMutation({
    mutationFn: (data: { pqId: string; condition: string; deadline?: string }) =>
      evaluationsApi.managePQConditions(data.pqId, { action: 'add', ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      setShowCondition(false);
      setConditionDesc('');
      setConditionDeadline('');
      toast.success('Condition added');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to add condition'),
  });

  const verifyConditionMutation = useMutation({
    mutationFn: ({ pqId, condition_id, notes }: { pqId: string; condition_id: string; notes?: string }) =>
      evaluationsApi.managePQConditions(pqId, { action: 'verify', condition_id, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      toast.success('Condition verified');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to verify condition'),
  });

  const recommendationMutation = useMutation({
    mutationFn: ({ pqId, recommendation }: { pqId: string; recommendation: string }) =>
      evaluationsApi.submitPQRecommendation(pqId, recommendation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualifications'] });
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      setShowRecommendation(false);
      toast.success('Recommendation submitted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to submit recommendation'),
  });

  const committeeReviewMutation = useMutation({
    mutationFn: ({ pqId, decision, comments }: { pqId: string; decision: 'approve' | 'approve_with_conditions' | 'reject'; comments?: string }) =>
      evaluationsApi.submitPQCommitteeReview(pqId, { decision, comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
      setShowCommitteeReview(false);
      setCommitteeDecision(null);
      setCommitteeComments('');
      toast.success('Review submitted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to submit review'),
  });

  const pqs: PQType[] = data?.results || [];
  const selected: PQType | undefined = selectedData;
  const verificationItems: PQVerificationItem[] = selected?.verification_items || [];
  const stageIndex = selected ? STAGE_ORDER.indexOf(selected.workflow_stage || 'initiation') : 0;

  useEffect(() => {
    if (selected) {
      setNotesValue(selected.notes || '');
      setRecommendationText(selected.recommendation || '');
    }
  }, [selected?.id]);

  const debouncedSaveNotes = useCallback((pqId: string, notes: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveNotesMutation.mutate({ pqId, notes });
    }, 800);
  }, [saveNotesMutation]);

  const pending = pqs.filter((p) => p.status === 'pending' || p.status === 'initiation').length;
  const inProgress = pqs.filter((p) => !['pending', 'initiation', 'cleared', 'failed'].includes(p.status)).length;
  const cleared = pqs.filter((p) => p.status === 'cleared').length;
  const failed = pqs.filter((p) => p.status === 'failed').length;

  const groupedItems = verificationItems.reduce<Record<string, PQVerificationItem[]>>((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryProgress = (items: PQVerificationItem[]) => {
    const done = items.filter(i => i.status === 'cleared' || i.status === 'failed').length;
    return { done, total: items.length, percent: items.length > 0 ? Math.round((done / items.length) * 100) : 0 };
  };

  const overallProgress = verificationItems.length > 0
    ? Math.round((verificationItems.filter((i) => i.status === 'cleared' || i.status === 'failed').length / verificationItems.length) * 100)
    : 0;

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleUpdateItem = (itemId: string, status: string) => {
    if (!selectedPQ) return;
    updateItemMutation.mutate({ pqId: selectedPQ, itemId, status, notes: itemNotes, contact_result: contactResult });
  };

  const handleAdvanceStage = (stage: PQStage) => {
    if (!selectedPQ) return;
    advanceStageMutation.mutate({ pqId: selectedPQ, stage });
  };

  if (selectedPQ && selected) {
    const ctx: PQVerificationContext | undefined = contextData;
    const verificationItems: PQVerificationItem[] = ctx?.verification_items || selected?.verification_items || [];

    const DetailRow = ({ label, value, mono }: { label: string; value: any; mono?: boolean }) => (
      <div className="flex justify-between py-1.5">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-xs font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>{value || '-'}</span>
      </div>
    );

    const tabs = [
      { id: 'checklist', label: 'Verification Checklist', count: verificationItems.length },
      { id: 'documents', label: 'Documents', count: selected.pending_doc_requests },
      { id: 'conditions', label: 'Conditions', count: selected.open_conditions_count },
      { id: 'recommendation', label: 'Recommendation' },
      { id: 'committee', label: 'Committee Review', count: selected.committee_review?.length },
      { id: 'audit', label: 'Audit Trail', count: selected.action_logs?.length },
    ];

    const StageStepper = () => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between overflow-x-auto gap-1">
          {STAGE_ORDER.filter(s => s !== 'closed').map((stage, idx) => {
            const currentIdx = stageIndex;
            const isActive = stage === selected.workflow_stage;
            const isPast = idx < currentIdx;
            const isClickable = idx <= currentIdx + 1 || isPast;
            return (
              <button
                key={stage}
                disabled={!isClickable || selected.status === 'cleared' || selected.status === 'failed'}
                onClick={() => handleAdvanceStage(stage)}
                className={`flex flex-col items-center gap-1 min-w-0 px-2 py-1 rounded-lg transition-colors ${
                  isActive ? 'bg-teal-50 border border-teal-200' : isPast ? 'bg-emerald-50/50' : 'opacity-40'
                } ${isClickable && !isActive ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isPast ? 'bg-emerald-500 text-white' : isActive ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {isPast ? '✓' : idx + 1}
                </div>
                <span className={`text-[9px] font-medium whitespace-nowrap ${isActive ? 'text-teal-700' : isPast ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {STAGE_LABELS[stage]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );

    const renderChecklistTab = () => (
      <div className="space-y-4">
        {verificationItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Verification Checklist</h3>
            <p className="text-sm text-gray-500 mb-4">Generate a verification checklist to begin post-qualification checks.</p>
            <button
              onClick={() => generateChecklistMutation.mutate(selectedPQ!)}
              disabled={generateChecklistMutation.isPending}
              className="px-6 py-3 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
            >
              {generateChecklistMutation.isPending ? 'Generating...' : 'Generate Verification Checklist'}
            </button>
          </div>
        ) : (
          <div>
            {/* Progress Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Verification Progress</h3>
                <span className={`text-sm font-bold ${overallProgress === 100 ? 'text-emerald-600' : 'text-gray-900'}`}>{overallProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div className={`h-full rounded-full transition-all duration-500 ${selected.failed_count > 0 ? 'bg-red-500' : overallProgress === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${overallProgress}%` }} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-4">
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-lg font-bold text-gray-900">{verificationItems.length}</p><p className="text-[10px] text-gray-500">Total Items</p></div>
                <div className="bg-emerald-50 rounded-lg p-3"><p className="text-lg font-bold text-emerald-600">{verificationItems.filter(i => i.status === 'cleared').length}</p><p className="text-[10px] text-emerald-600">Cleared</p></div>
                <div className="bg-red-50 rounded-lg p-3"><p className="text-lg font-bold text-red-600">{selected.failed_count}</p><p className="text-[10px] text-red-600">Failed</p></div>
                <div className="bg-amber-50 rounded-lg p-3"><p className="text-lg font-bold text-amber-600">{verificationItems.filter(i => i.status === 'pending' || i.status === 'in_progress').length}</p><p className="text-[10px] text-amber-600">Pending</p></div>
              </div>
              <div className="space-y-2">
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                  const items = verificationItems.filter(i => i.category === cat);
                  if (items.length === 0) return null;
                  const done = items.filter(i => i.status === 'cleared' || i.status === 'failed').length;
                  const pct = Math.round((done / items.length) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-16 shrink-0">{label}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div className={`h-full rounded-full ${CATEGORY_BAR_COLORS[cat] || 'bg-teal-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-medium text-gray-600 w-8 text-right">{done}/{items.length}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Accordions */}
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const items = groupedItems[cat];
              if (!items || items.length === 0) return null;
              const prog = categoryProgress(items);
              const isExpanded = expandedCategories[cat];
              return (
                <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-3">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleCategory(cat)}>
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded text-xs font-semibold border ${CATEGORY_COLORS[cat]}`}>{label}</div>
                      <span className="text-xs text-gray-500">{prog.done}/{prog.total} complete</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 bg-gray-200 rounded-full h-1.5">
                        <div className={`h-full rounded-full ${prog.percent === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${prog.percent}%` }} />
                      </div>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {items.map((item: PQVerificationItem) => (
                        <div key={item.id} className={`p-4 border-b border-gray-50 last:border-b-0 ${item.status === 'cleared' ? 'bg-emerald-50/30' : item.status === 'failed' ? 'bg-red-50/30' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className="shrink-0">
                              {item.status === 'cleared' ? (
                                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              ) : item.status === 'failed' ? (
                                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              ) : (
                                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                                {item.verification_method === 'auto' && (
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded flex items-center gap-0.5">
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                                    Auto
                                  </span>
                                )}
                              </div>
                              {item.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.notes}</p>}
                              {item.verified_by && <p className="text-[10px] text-gray-400 mt-0.5">Verified by {item.verified_by} on {item.verified_at ? new Date(item.verified_at).toLocaleDateString() : '-'}</p>}
                            </div>
                            <div className="shrink-0 flex items-center gap-1">
                              {editingItem === item.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleUpdateItem(item.id, 'cleared')} className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded hover:bg-emerald-700">Pass</button>
                                  <button onClick={() => handleUpdateItem(item.id, 'failed')} className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700">Fail</button>
                                  <button onClick={() => { setEditingItem(null); setItemNotes(''); setContactResult(''); }} className="px-2 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold rounded hover:bg-gray-300">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => { setEditingItem(item.id); setItemNotes(item.notes || ''); setContactResult(item.contact_result || ''); }}
                                    className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded hover:bg-gray-200">Update</button>
                                </div>
                              )}
                            </div>
                          </div>
                          {item.site_visit && (
                            <div className="mt-2 ml-8 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-[10px] font-bold text-blue-700 uppercase mb-1.5">Site Visit Report</p>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                                <div><span className="text-gray-500">Date:</span> {item.site_visit.date ? new Date(item.site_visit.date).toLocaleDateString() : '-'}</div>
                                <div><span className="text-gray-500">Visited by:</span> {item.site_visit.visited_by || '-'}</div>
                                <div><span className="text-gray-500">Location:</span> {item.site_visit.location || '-'}</div>
                                <div><span className="text-gray-500">Observations:</span> {item.site_visit.observations || '-'}</div>
                              </div>
                            </div>
                          )}
                          {item.reference_data && (
                            <div className="mt-2 ml-8 p-3 bg-amber-50 rounded-lg border border-amber-200">
                              <p className="text-[10px] font-bold text-amber-700 uppercase mb-1.5">Reference Check</p>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                                <div><span className="text-gray-500">Organization:</span> {item.reference_data.organization || '-'}</div>
                                <div><span className="text-gray-500">Contact:</span> {item.reference_data.contact_person || '-'}</div>
                                <div><span className="text-gray-500">Phone:</span> {item.reference_data.contact_number || '-'}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {editingItem && (
                        <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Verification Notes</label>
                            <textarea value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} rows={2}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Enter verification notes..." />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Contact Result</label>
                            <input value={contactResult} onChange={(e) => setContactResult(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="e.g. Confirmed by phone on 2024-01-15" />
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
      </div>
    );

    const renderDocumentsTab = () => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Document Requests</h3>
          <button onClick={() => setShowDocRequest(true)}
            className="px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700">
            + Request Document
          </button>
        </div>
        {(selected.pq_document_requests || []).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No document requests yet. Request documents from the supplier.</p>
        ) : (
          <div className="space-y-3">
            {(selected.pq_document_requests || []).map((dr: PQDocumentRequest) => (
              <div key={dr.request_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{dr.document_type}</p>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      dr.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' :
                      dr.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>{dr.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{dr.description}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Requested by {dr.requested_by} on {new Date(dr.requested_at).toLocaleDateString()}
                    {dr.due_date && ` · Due: ${new Date(dr.due_date).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="shrink-0 ml-3">
                  {dr.status === 'requested' && (
                    <button onClick={() => {
                      evaluationsApi.managePQDocuments(selectedPQ!, { action: 'submit', request_id: dr.request_id }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['post-qualification', selectedPQ] });
                      }).catch(() => toast.error('Failed to update'));
                    }} className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded hover:bg-emerald-200">
                      Mark Submitted
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showDocRequest && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <p className="text-xs font-bold text-gray-700">New Document Request</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Document Type</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs">
                  <option value="">Select type...</option>
                  <option value="financial_statements">Financial Statements</option>
                  <option value="tax_clearance">Tax Clearance Certificate</option>
                  <option value="company_registration">Company Registration</option>
                  <option value="insurance_certificate">Insurance Certificate</option>
                  <option value="performance_bond">Performance Bond</option>
                  <option value="license">License / Permit</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Due Date</label>
                <input type="date" value={docDueDate} onChange={(e) => setDocDueDate(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Description</label>
              <textarea value={docDescription} onChange={(e) => setDocDescription(e.target.value)} rows={2}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" placeholder="Describe what document is needed..." />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowDocRequest(false); setDocType(''); setDocDescription(''); setDocDueDate(''); }}
                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => {
                if (!selectedPQ || !docType || !docDescription) { toast.error('Document type and description required'); return; }
                docRequestMutation.mutate({ pqId: selectedPQ, document_type: docType, description: docDescription, due_date: docDueDate || undefined });
              }} disabled={docRequestMutation.isPending}
                className="px-3 py-1 bg-teal-600 text-white text-xs font-bold rounded hover:bg-teal-700 disabled:opacity-50">
                {docRequestMutation.isPending ? 'Requesting...' : 'Request Document'}
              </button>
            </div>
          </div>
        )}
      </div>
    );

    const renderConditionsTab = () => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Conditions</h3>
          <button onClick={() => setShowCondition(true)}
            className="px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700">
            + Add Condition
          </button>
        </div>
        {(selected.conditions || []).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No conditions defined. Conditions are used when awarding with conditions.</p>
        ) : (
          <div className="space-y-3">
            {(selected.conditions || []).map((c: PQCondition) => (
              <div key={c.condition_id} className={`p-3 rounded-lg border ${c.status === 'verified' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{c.condition}</p>
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${c.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.status === 'verified' ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                    {c.deadline && <p className="text-xs text-gray-500 mt-0.5">Deadline: {new Date(c.deadline).toLocaleDateString()}</p>}
                    {c.verified_by && <p className="text-xs text-gray-500 mt-0.5">Verified by {c.verified_by} on {c.verified_at ? new Date(c.verified_at).toLocaleDateString() : '-'}</p>}
                  </div>
                  {c.status === 'pending' && (
                    <button onClick={() => verifyConditionMutation.mutate({ pqId: selectedPQ!, condition_id: c.condition_id })}
                      disabled={verifyConditionMutation.isPending}
                      className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded hover:bg-emerald-200 disabled:opacity-50">
                      Verify
                    </button>
                  )}
                </div>
                {c.notes && <p className="text-xs text-gray-500 mt-1">{c.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {showCondition && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <p className="text-xs font-bold text-gray-700">New Condition</p>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Condition</label>
              <textarea value={conditionDesc} onChange={(e) => setConditionDesc(e.target.value)} rows={2}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" placeholder="Describe the condition..." />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Deadline (optional)</label>
              <input type="date" value={conditionDeadline} onChange={(e) => setConditionDeadline(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowCondition(false); setConditionDesc(''); setConditionDeadline(''); }}
                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => {
                if (!selectedPQ || !conditionDesc) { toast.error('Condition description required'); return; }
                conditionMutation.mutate({ pqId: selectedPQ, condition: conditionDesc, deadline: conditionDeadline || undefined });
              }} disabled={conditionMutation.isPending}
                className="px-3 py-1 bg-teal-600 text-white text-xs font-bold rounded hover:bg-teal-700 disabled:opacity-50">
                {conditionMutation.isPending ? 'Adding...' : 'Add Condition'}
              </button>
            </div>
          </div>
        )}
      </div>
    );

    const renderRecommendationTab = () => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">PQ Officer Recommendation</h3>
        {selected.recommendation ? (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              <p className="text-sm font-bold text-blue-800">Recommendation Submitted</p>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.recommendation}</p>
            {selected.recommended_by_name && (
              <p className="text-xs text-gray-500 mt-2">Recommended by {selected.recommended_by_name}</p>
            )}
          </div>
        ) : (
          <div>
            {!showRecommendation ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-4">Submit your recommendation based on the verification findings before proceeding to committee review.</p>
                <button onClick={() => setShowRecommendation(true)}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700">
                  Write Recommendation
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea value={recommendationText} onChange={(e) => setRecommendationText(e.target.value)} rows={5}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  placeholder="Provide your recommendation to the committee. Include summary of findings and recommended outcome..." />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowRecommendation(false); setRecommendationText(''); }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                  <button onClick={() => {
                    if (!selectedPQ || !recommendationText.trim()) { toast.error('Recommendation text required'); return; }
                    recommendationMutation.mutate({ pqId: selectedPQ, recommendation: recommendationText });
                  }} disabled={recommendationMutation.isPending}
                    className="px-4 py-1.5 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50">
                    {recommendationMutation.isPending ? 'Submitting...' : 'Submit Recommendation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );

    const renderCommitteeTab = () => (
      <div className="space-y-4">
        {/* Existing Reviews */}
        {(selected.committee_review || []).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Committee Reviews</h3>
            <div className="space-y-3">
              {(selected.committee_review || []).map((r: PQCommitteeReview, i: number) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">{r.member_name}</p>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      r.decision === 'approve' ? 'bg-emerald-100 text-emerald-700' :
                      r.decision === 'approve_with_conditions' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>{r.decision.replace(/_/g, ' ')}</span>
                  </div>
                  {r.comments && <p className="text-xs text-gray-600">{r.comments}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">Reviewed on {new Date(r.decided_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Review */}
        {selected.workflow_stage === 'committee_review' && selected.status !== 'cleared' && selected.status !== 'failed' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Submit Your Review</h3>
            {!showCommitteeReview ? (
              <button onClick={() => setShowCommitteeReview(true)}
                className="px-4 py-2 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700">
                Submit Committee Review
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-3">
                  {(['approve', 'approve_with_conditions', 'reject'] as const).map((d) => (
                    <button key={d} onClick={() => setCommitteeDecision(d)}
                      className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                        committeeDecision === d
                          ? d === 'approve' ? 'border-emerald-500 bg-emerald-50' :
                            d === 'approve_with_conditions' ? 'border-amber-500 bg-amber-50' : 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <p className="text-xs font-bold">{d === 'approve' ? 'Approve' : d === 'approve_with_conditions' ? 'Approve with Conditions' : 'Reject'}</p>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Comments</label>
                  <textarea value={committeeComments} onChange={(e) => setCommitteeComments(e.target.value)} rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Add your comments..." />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowCommitteeReview(false); setCommitteeDecision(null); setCommitteeComments(''); }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                  <button onClick={() => {
                    if (!selectedPQ || !committeeDecision) { toast.error('Please select a decision'); return; }
                    committeeReviewMutation.mutate({ pqId: selectedPQ, decision: committeeDecision, comments: committeeComments });
                  }} disabled={committeeReviewMutation.isPending}
                    className="px-4 py-1.5 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50">
                    {committeeReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommendation Summary */}
        {selected.recommendation && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">PQ Officer Recommendation</h3>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.recommendation}</p>
              {selected.recommended_by_name && <p className="text-xs text-gray-500 mt-1">By {selected.recommended_by_name}</p>}
            </div>
          </div>
        )}
      </div>
    );

    const renderAuditTab = () => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Audit Trail</h3>
        {(selected.action_logs || []).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No actions recorded yet.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(selected.action_logs || []).map((log) => (
              <div key={log.log_id} className="flex items-start gap-3 text-sm border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                <div className="shrink-0 w-2 h-2 rounded-full bg-gray-400 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium">{log.action_display}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{log.details}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">By {log.performed_by_name || 'System'} on {new Date(log.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => { setSelectedPQ(null); setEditingItem(null); setActiveTab('checklist'); }}
              className="text-sm text-gray-500 hover:text-gray-900 mb-1 flex items-center gap-1">
              ← Back to Post-Qualifications
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Post-Qualification Verification</h1>
              <StatusBadge status={selected.status} />
              {selected.rank != null && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-bold rounded">Rank #{selected.rank}</span>
              )}
              {selected.result && (
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                  selected.result === 'award' ? 'bg-emerald-100 text-emerald-700' :
                  selected.result === 'award_with_conditions' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>{selected.result_display}</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{selected.submission_id} — {selected.bidder_name}</p>
          </div>
          <div className="flex items-center gap-2">
            {(!selected.verification_items || selected.verification_items.length === 0) && (
              <button onClick={() => generateChecklistMutation.mutate(selectedPQ!)}
                disabled={generateChecklistMutation.isPending}
                className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {generateChecklistMutation.isPending ? 'Generating...' : 'Generate Checklist'}
              </button>
            )}
          </div>
        </div>

        {selectedLoading || contextLoading ? <LoadingSpinner className="py-12" /> : (
          <>
            {/* Blacklist Warning */}
            {ctx?.blacklist && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                <div>
                  <p className="text-sm font-bold text-red-800">BLACKLISTED SUPPLIER</p>
                  <p className="text-xs text-red-700 mt-1">Reason: {ctx.blacklist.reason}</p>
                  {ctx.blacklist.debarred_until && <p className="text-xs text-red-700">Debarred until: {new Date(ctx.blacklist.debarred_until!).toLocaleDateString()}</p>}
                </div>
              </div>
            )}

            {/* Stage Stepper */}
            <StageStepper />

            {/* Supplier Info Cards */}
            {ctx?.supplier_profile && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Supplier Company Profile</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8">
                  <div className="divide-y divide-gray-50">
                    <DetailRow label="Company Name" value={ctx.supplier_profile.name} />
                    <DetailRow label="Registration No." value={ctx.supplier_profile.registration_number} mono />
                    <DetailRow label="TIN" value={ctx.supplier_profile.tin} mono />
                    <DetailRow label="CEEC Category" value={ctx.supplier_profile.ceec_category?.replace(/_/g, ' ')} />
                  </div>
                  <div className="divide-y divide-gray-50">
                    <DetailRow label="Status" value={<span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ctx.supplier_profile.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{ctx.supplier_profile.status}</span>} />
                    <DetailRow label="Risk Level" value={<span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ctx.supplier_profile.risk_level === 'low' ? 'bg-emerald-100 text-emerald-700' : ctx.supplier_profile.risk_level === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{ctx.supplier_profile.risk_level || 'N/A'}</span>} />
                    <DetailRow label="Bank" value={ctx.supplier_profile.bank_name} />
                    <DetailRow label="Account Name" value={ctx.supplier_profile.bank_account_name} />
                  </div>
                  <div className="divide-y divide-gray-50">
                    <DetailRow label="Bid Price" value={`ZMW ${Number(ctx.bid?.bid_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                    <DetailRow label="Evaluated Price" value={ctx.financial_evaluation ? `ZMW ${Number(ctx.financial_evaluation.evaluated_price).toLocaleString()}` : '-'} />
                    <DetailRow label="Financial Score" value={ctx.financial_evaluation?.financial_score?.toFixed(2)} />
                    <DetailRow label="Technical Avg" value={ctx.technical_scores?.length ? (ctx.technical_scores.reduce((s, t) => s + t.weighted_score, 0) / ctx.technical_scores.length).toFixed(2) : '-'} />
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex gap-4 overflow-x-auto">
                {tabs.filter(t => t.id !== 'audit' || (selected.action_logs?.length || 0) > 0).map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded ${activeTab === tab.id ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'checklist' && renderChecklistTab()}
            {activeTab === 'documents' && renderDocumentsTab()}
            {activeTab === 'conditions' && renderConditionsTab()}
            {activeTab === 'recommendation' && renderRecommendationTab()}
            {activeTab === 'committee' && renderCommitteeTab()}
            {activeTab === 'audit' && renderAuditTab()}

            {/* Chair Decision Section */}
            {(selected.status === 'cleared' || selected.status === 'failed') && selected.chair_decision && (
              <div className={`rounded-xl shadow-sm border p-6 ${selected.chair_decision === 'passed' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {selected.chair_decision === 'passed' ? (
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  )}
                  <h3 className={`text-sm font-bold ${selected.chair_decision === 'passed' ? 'text-emerald-800' : 'text-red-800'}`}>
                    Chair Decision: {selected.chair_decision.toUpperCase()} — {selected.result_display}
                  </h3>
                </div>
                {selected.chair_decision_notes && <p className="text-sm text-gray-700 mt-1">{selected.chair_decision_notes}</p>}
                {selected.conditions && selected.conditions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-bold text-gray-700">Conditions:</p>
                    {selected.conditions.map((c: PQCondition, i: number) => (
                      <div key={i} className="text-xs text-gray-600 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {c.condition}
                      </div>
                    ))}
                  </div>
                )}
                {selected.chair_decided_at && <p className="text-xs text-gray-500 mt-2">Recorded on {new Date(selected.chair_decided_at).toLocaleString()}</p>}
              </div>
            )}

            {/* Chair Decision Action */}
            {(selected.status === 'cleared' || selected.status === 'failed') && !selected.chair_decision && selected.workflow_stage === 'committee_review' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Chair Decision Required</h3>
                  {!showChairDecision && (
                    <button onClick={() => setShowChairDecision(true)}
                      className="px-4 py-2 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                      Record Chair Decision
                    </button>
                  )}
                </div>
                {showChairDecision && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Review all verification items above, then record your decision as Committee Chairperson.</p>
                    <div className="flex gap-3">
                      <button onClick={() => setChairDecision('passed')}
                        className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${chairDecision === 'passed' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 hover:border-emerald-300'}`}>
                        <svg className="w-8 h-8 mx-auto mb-1 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-sm font-bold">Award</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Supplier passes all checks</p>
                      </button>
                      <button onClick={() => setChairDecision('passed_with_conditions')}
                        className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${chairDecision === 'passed_with_conditions' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 hover:border-amber-300'}`}>
                        <svg className="w-8 h-8 mx-auto mb-1 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>
                        <p className="text-sm font-bold">Award with Conditions</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Supplier must meet conditions</p>
                      </button>
                      <button onClick={() => setChairDecision('failed')}
                        className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${chairDecision === 'failed' ? 'border-red-500 bg-red-50 text-red-800' : 'border-gray-200 hover:border-red-300'}`}>
                        <svg className="w-8 h-8 mx-auto mb-1 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-sm font-bold">No Award</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Supplier fails PQ</p>
                      </button>
                    </div>
                    {chairDecision === 'passed_with_conditions' && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-700">Conditions for Award</p>
                        {chairConditions.map((cond, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input value={cond.condition} onChange={(e) => {
                              const updated = [...chairConditions];
                              updated[i].condition = e.target.value;
                              setChairConditions(updated);
                            }} className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" placeholder="Condition description" />
                            <input type="date" value={cond.deadline} onChange={(e) => {
                              const updated = [...chairConditions];
                              updated[i].deadline = e.target.value;
                              setChairConditions(updated);
                            }} className="border border-gray-200 rounded px-2 py-1 text-xs w-36" />
                            {chairConditions.length > 1 && (
                              <button onClick={() => setChairConditions(chairConditions.filter((_, j) => j !== i))}
                                className="text-red-500 text-xs">Remove</button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => setChairConditions([...chairConditions, { condition: '', deadline: '' }])}
                          className="text-xs text-teal-600 font-medium hover:text-teal-700">+ Add condition</button>
                      </div>
                    )}
                    {chairDecision && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Decision Notes {chairDecision === 'failed' && <span className="text-red-500">*</span>}</label>
                          <textarea value={chairNotes} onChange={(e) => setChairNotes(e.target.value)} rows={3}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                            placeholder={chairDecision === 'failed' ? 'Explain reason for failure (required)...' : 'Optional notes...'} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setShowChairDecision(false); setChairDecision(null); setChairNotes(''); setChairConditions([]); }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                          <button onClick={() => {
                            if (!selectedPQ || !chairDecision) return;
                            if (chairDecision === 'failed' && !chairNotes.trim()) { toast.error('Decision notes are required when rejecting'); return; }
                            if (chairDecision === 'passed_with_conditions') {
                              const validConds = chairConditions.filter(c => c.condition.trim());
                              if (validConds.length === 0) { toast.error('At least one condition is required'); return; }
                              chairDecisionMutation.mutate({
                                pqId: selectedPQ,
                                decision: 'passed_with_conditions',
                                decision_notes: chairNotes,
                                conditions: validConds.map(c => ({ condition: c.condition, deadline: c.deadline || null, status: 'pending' })),
                              });
                            } else {
                              chairDecisionMutation.mutate({ pqId: selectedPQ, decision: chairDecision, decision_notes: chairNotes });
                            }
                          }} disabled={chairDecisionMutation.isPending}
                            className={`px-6 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 ${
                              chairDecision === 'passed' || chairDecision === 'passed_with_conditions' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                            }`}>
                            {chairDecisionMutation.isPending ? 'Submitting...' : `Confirm ${chairDecision === 'passed' ? 'Award' : chairDecision === 'passed_with_conditions' ? 'Award with Conditions' : 'No Award'}`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Assignment & Deadline */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Assignment & Deadline</h3>
                <button onClick={() => { setShowReassignModal(true); setReassignUserId(''); }}
                  className="text-xs font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                  Reassign
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-gray-500">Assigned To</span>
                  <p className="font-medium text-gray-900 mt-0.5">{selected.assigned_to_name || 'Unassigned'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Deadline</span>
                  <p className={`font-medium mt-0.5 ${selected.is_overdue ? 'text-red-600' : selected.days_until_deadline !== null && selected.days_until_deadline < 3 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {selected.deadline ? new Date(selected.deadline).toLocaleDateString() : 'No deadline set'}
                    {selected.days_until_deadline !== null && selected.days_until_deadline >= 0 && (
                      <span className="text-xs text-gray-500 ml-2">({selected.days_until_deadline}d remaining)</span>
                    )}
                  </p>
                </div>
              </div>
              {selected.is_overdue && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  This post-qualification is overdue. The deadline has passed.
                </div>
              )}
            </div>
          </>
        )}

        {/* Reassign Modal */}
        {showReassignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReassignModal(false)}>
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Reassign Post-Qualification</h3>
              <p className="text-sm text-gray-500 mb-4">Enter the user ID of the new assignee.</p>
              <input type="text" value={reassignUserId} onChange={(e) => setReassignUserId(e.target.value)}
                placeholder="User ID (e.g. UUID)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 mb-4" autoFocus />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowReassignModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button onClick={() => { if (reassignUserId && selectedPQ) { reassignMutation.mutate({ pqId: selectedPQ, assignedTo: reassignUserId }); setShowReassignModal(false); } }}
                  disabled={!reassignUserId || reassignMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {reassignMutation.isPending ? 'Reassigning...' : 'Reassign'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <button onClick={() => navigate('/evaluations')} className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center gap-1 transition-colors">
          ← Back to Evaluations
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Post-Qualification</h1>
        <p className="text-sm text-gray-500 mt-1">Verify winning bidder through the structured workflow stages before contract award</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending</p>
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-3xl font-bold text-orange-600 mt-1">{pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">In Progress</p>
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-3xl font-bold text-blue-600 mt-1">{inProgress}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cleared</p>
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{cleared}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Failed</p>
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
            {pqs.map((pq) => {
              const items: PQVerificationItem[] = pq.verification_items || [];
              const done = items.filter((i) => i.status === 'cleared' || i.status === 'failed').length;
              const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
              const stageLabel = pq.stage_display || pq.workflow_stage?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Initiation';
              return (
                <div key={pq.id} onClick={() => setSelectedPQ(pq.id)}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="shrink-0">
                    {pq.status === 'cleared' ? (
                      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ) : pq.status === 'failed' ? (
                      <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ) : (
                      <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{pq.bidder_name}</p>
                      {pq.rank != null && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded">Rank #{pq.rank}</span>}
                      <StatusBadge status={pq.status} />
                      <span className="px-1.5 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-bold rounded">{stageLabel}</span>
                      {pq.result && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                          pq.result === 'award' ? 'bg-emerald-100 text-emerald-700' :
                          pq.result === 'award_with_conditions' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>{pq.result_display}</span>
                      )}
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
                  <svg className="w-5 h-5 text-gray-300 -rotate-90 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                </div>
              );
            })}
          </div>
        )}

        {pqs.length === 0 && !isLoading && (
          <div className="py-12 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="font-medium">No post-qualification records</p>
            <p className="text-sm mt-1">Records are created when a winner is selected during Financial Evaluation</p>
          </div>
        )}

        {data && (
          <Pagination currentPage={page} totalPages={Math.ceil((data.count || 0) / pageSize)} pageSize={pageSize} totalItems={data.count || 0}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        )}
      </div>
    </div>
  );
};

export default PostQualification;
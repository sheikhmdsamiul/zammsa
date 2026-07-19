import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { usersApi } from '../../api/endpoints';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ROLES, EVALUATION_COMMITTEE_ROLES } from '../../config/rbac';
import toast from 'react-hot-toast';
import {
  UsersIcon, ShieldCheckIcon, PlusIcon, CheckCircleIcon, XCircleIcon, TrashIcon,
  CalendarIcon, DocumentReportIcon,
} from '@heroicons/react/outline';

const CommitteeFormation: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();

  const [solicitation, setSolicitation] = useState('');
  const [chairperson, setChairperson] = useState('');
  const [secretary, setSecretary] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [nonOfficialMembers, setNonOfficialMembers] = useState<{firstName: string; lastName: string; email: string; expertise: string; validFrom?: string; validUntil?: string; userId?: string}[]>([]);
  const [coiRequired, setCoiRequired] = useState(true);
  const [editingCommitteeId, setEditingCommitteeId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: committeesData, isLoading: committeesLoading } = useQuery({
    queryKey: ['evaluation-committees'],
    queryFn: () => evaluationsApi.listCommittees({ page_size: 50 }),
  });

  const { data: solsData, isLoading: solsLoading } = useQuery({
    queryKey: ['solicitations-for-committee'],
    queryFn: () => solicitationsApi.list({ page_size: 50 }),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users-for-committee'],
    queryFn: () => usersApi.list({ page_size: 100 }),
  });

  const allUsers = usersData?.results || [];
  const committees = committeesData?.results || [];

  const eligibleUsers = useMemo(() =>
    allUsers.filter((u: any) =>
      EVALUATION_COMMITTEE_ROLES.includes(u.role) && !u.temp_password
    ),
    [allUsers],
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const solicitationParam = params.get('solicitation');
    if (solicitationParam) {
      setSolicitation(solicitationParam);
    }
  }, [location.search]);

  const getErrorMessage = (err: any): string => {
    if (typeof err === 'string') return err;
    const data = err?.response?.data;
    if (!data) return 'Failed to form committee';
    if (typeof data === 'string') return data;
    if (data.error) return data.error;
    if (data.detail) return data.detail;
    const fieldErrors: string[] = [];
    Object.entries(data).forEach(([field, msgs]) => {
      if (Array.isArray(msgs)) {
        fieldErrors.push(`${field}: ${msgs.join(', ')}`);
      } else if (typeof msgs === 'string') {
        fieldErrors.push(`${field}: ${msgs}`);
      }
    });
    if (fieldErrors.length) return fieldErrors.join('; ');
    return Object.values(data)[0] as string || 'Failed to form committee';
  };

  const formMutation = useMutation({
    mutationFn: () => {
      const allMembers = Array.from(new Set([...members, chairperson, secretary].filter(Boolean)));
      const payload: Record<string, any> = {
        solicitation,
        chairperson,
        secretary,
        members: allMembers,
        require_coi: coiRequired,
      };
      if (nonOfficialMembers.length > 0) {
        payload.non_official_members = nonOfficialMembers.map(m => {
          const obj: Record<string, string> = {
            first_name: m.firstName,
            last_name: m.lastName,
            email: m.email,
            expertise: m.expertise,
          };
          if (m.validFrom) obj.valid_from = m.validFrom;
          if (m.validUntil) obj.valid_until = m.validUntil;
          if (m.userId) obj.user_id = m.userId;
          return obj;
        });
      }
      return editingCommitteeId
        ? evaluationsApi.updateCommittee(editingCommitteeId, payload)
        : evaluationsApi.formCommittee(payload);
    },
    onSuccess: () => {
      toast.success(editingCommitteeId ? 'Committee updated successfully' : 'Committee formed successfully');
      setSolicitation('');
      setChairperson('');
      setSecretary('');
      setMembers([]);
      setNonOfficialMembers([]);
      setCoiRequired(true);
      setEditingCommitteeId(null);
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ['evaluation-committees'] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-committee'] });
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err);
      toast.error(msg);
      const data = err?.response?.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(data).forEach(([field, msgs]) => {
          if (Array.isArray(msgs)) fieldErrors[field] = msgs[0];
          else if (typeof msgs === 'string') fieldErrors[field] = msgs;
        });
        setErrors(fieldErrors);
      }
    },
  });

  const selectedSolicitation = useMemo(() => {
    if (!solicitation) return null;
    return (solsData?.results || []).find((sol: any) => sol.id === solicitation) || null;
  }, [solicitation, solsData]);

  const EXPERTISE_LABELS: Record<string, string> = {
    procurement: 'Procurement / regulatory',
    laboratory: 'Laboratory / medical sciences',
    finance: 'Finance / value-for-money',
    legal: 'Legal',
    supply_chain: 'Supply chain / logistics',
    engineering: 'Engineering / technical',
  };

  const cppRequirements = selectedSolicitation?.cpp_resource_requirements;
  const cppMinCommitteeSize = useMemo(() => {
    if (!cppRequirements) return null;
    return (cppRequirements as any).evaluation_committee_size || (cppRequirements as any).evaluationCommitteeSize || null;
  }, [cppRequirements]);
  const cppRequiredExpertise = useMemo(() => {
    if (!cppRequirements?.requiredExpertise) return null;
    const keys: string[] = cppRequirements.requiredExpertise;
    return keys.map((k: string) => EXPERTISE_LABELS[k] || k).join(', ');
  }, [cppRequirements]);

  const [committeePage, setCommitteePage] = useState(1);
  const COMMITTEE_PAGE_SIZE = 5;
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (committeeId: string) => evaluationsApi.deleteCommittee(committeeId),
    onSuccess: () => {
      toast.success('Committee deleted');
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['evaluation-committees'] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-committee'] });
      setCommitteePage(1);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to delete committee');
      setDeleteConfirmId(null);
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!solicitation) newErrors.solicitation = 'Select a solicitation';
    if (!chairperson) newErrors.chairperson = 'Select a chairperson';
    if (!secretary) newErrors.secretary = 'Select a secretary';
    if (chairperson && secretary && chairperson === secretary) {
      newErrors.secretary = 'Chairperson and secretary must be different';
    }
    const uniqueTotal = new Set([chairperson, secretary, ...members].filter(Boolean)).size;
    const nonOfficialTotal = nonOfficialMembers.length;
    if (uniqueTotal + nonOfficialTotal < 3) newErrors.members = `At least 3 unique people required (chairperson + secretary + members + non-official members). Currently: ${uniqueTotal + nonOfficialTotal}`;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    formMutation.mutate();
  };

  const openEditCommittee = (c: any) => {
    const committeeMembers = Array.isArray(c.members)
      ? c.members.map((m: any) => (typeof m === 'string' ? m : m?.user || m?.id)).filter(Boolean)
      : [];
    const chairpersonId = c.chairperson || '';
    const secretaryId = c.secretary || '';

    setEditingCommitteeId(c.id);
    setSolicitation(c.solicitation || '');
    setChairperson(chairpersonId);
    setSecretary(secretaryId);
    setMembers(Array.from(new Set(committeeMembers.filter((id: string) => id !== chairpersonId && id !== secretaryId))));
    setNonOfficialMembers((c.non_official_members || []).map((nom: any) => ({
      firstName: nom.first_name || '',
      lastName: nom.last_name || '',
      email: nom.email || '',
      expertise: nom.expertise || '',
      validFrom: nom.valid_from || '',
      validUntil: nom.valid_until || '',
      userId: nom.user_id || nom.userId || '',
    })));
    setCoiRequired(c.require_coi !== false);
    setErrors({});
  };

  const resetForm = () => {
    setEditingCommitteeId(null);
    setSolicitation('');
    setChairperson('');
    setSecretary('');
    setMembers([]);
    setNonOfficialMembers([]);
    setCoiRequired(true);
    setErrors({});
  };

  const getUserName = (id: string) => {
    const u = allUsers.find((u: any) => u.id === id);
    return u ? `${u.full_name || u.email} (${(u.role || '').replace(/_/g, ' ')})` : id.slice(0, 8);
  };

  const getSolLabel = (sol: any) => {
    const parts = [sol.sol_number, sol.title].filter(Boolean);
    return parts.join(' — ') || sol.id;
  };

  const isLoading = solsLoading || usersLoading;

  if (isLoading && !solsData && !usersData) return <LoadingSpinner className="py-12" />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Form Evaluation Committee</h1>
            <StatusBadge status={committees.length > 0 ? 'active' : 'draft'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Assign 1 Chairperson (EC Chair), 1 Secretary (EC Member), and at least 1 additional Member (EC Member) for a minimum of 3 unique people
          </p>
          {editingCommitteeId && (
            <p className="text-sm text-amber-600 mt-2 font-medium">
              Editing committee — save to apply changes
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Committee Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Solicitation *</label>
                <select value={solicitation} onChange={(e) => { setSolicitation(e.target.value); setErrors(prev => { const n = {...prev}; delete n.solicitation; return n; }); }}
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green ${errors.solicitation ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <option value="">Select solicitation...</option>
                  {(solsData?.results || []).map((sol: any) => (
                    <option key={sol.id} value={sol.id}>{getSolLabel(sol)}</option>
                  ))}
                </select>
                {errors.solicitation && <p className="text-xs text-red-500 mt-1">{errors.solicitation}</p>}

                {cppRequirements && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-2">
                    <div className="flex items-start gap-3">
                      <ShieldCheckIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">CPP Evaluation Committee Requirements</p>
                        <p className="text-xs text-amber-800 mt-1">
                          Minimum committee size: <strong>{cppMinCommitteeSize || 'Not specified'}</strong>
                        </p>
                        {cppRequiredExpertise && (
                          <p className="text-xs text-amber-800 mt-0.5">
                            Required expertise: <strong>{cppRequiredExpertise}</strong>
                          </p>
                        )}
                        <p className="text-xs text-amber-600/70 mt-1 italic">set during CPP creation for this solicitation's CPP</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chairperson *</label>
                  <select value={chairperson} onChange={(e) => { setChairperson(e.target.value); setErrors(prev => { const n = {...prev}; delete n.chairperson; delete n.secretary; return n; }); }}
                    className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green ${errors.chairperson ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select chairperson...</option>
                    {eligibleUsers.filter((u: any) => u.id !== secretary && u.role === ROLES.EVALUATION_COMMITTEE_CHAIR).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email} — {(u.role || '').replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  {errors.chairperson && <p className="text-xs text-red-500 mt-1">{errors.chairperson}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secretary *</label>
                  <select value={secretary} onChange={(e) => { setSecretary(e.target.value); setErrors(prev => { const n = {...prev}; delete n.secretary; return n; }); }}
                    className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green ${errors.secretary ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select secretary...</option>
                    {eligibleUsers.filter((u: any) => u.id !== chairperson && u.role === ROLES.EVALUATION_COMMITTEE_MEMBER).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email} — {(u.role || '').replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  {errors.secretary && <p className="text-xs text-red-500 mt-1">{errors.secretary}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Members *
                  <span className="text-gray-400 font-normal ml-2">({members.length} selected)</span>
                </label>
                {errors.members && <p className="text-xs text-red-500 mb-2">{errors.members}</p>}
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {eligibleUsers.filter((u: any) => u.role === ROLES.EVALUATION_COMMITTEE_MEMBER && u.id !== secretary && u.id !== chairperson).map((u: any) => {
                    const isSelected = members.includes(u.id);
                    return (
                      <label key={u.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm ${isSelected ? 'bg-zammsa-green/5' : 'hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={isSelected}
                          onChange={() => {
                            setMembers(prev => isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]);
                            setErrors(prev => { const n = {...prev}; delete n.members; return n; });
                          }}
                          className="text-zammsa-green rounded focus:ring-zammsa-green" />
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{u.full_name || u.email}</span>
                          <span className="text-gray-400 text-xs ml-2">({(u.role || '').replace(/_/g, ' ')})</span>
                        </div>
                        {chairperson === u.id && <span className="text-xs font-semibold text-zammsa-green">Chairperson</span>}
                        {secretary === u.id && <span className="text-xs font-semibold text-blue-600">Secretary</span>}
                      </label>
                    );
                  })}
                  {eligibleUsers.length === 0 && (
                    <p className="px-4 py-6 text-sm text-gray-400 text-center">No eligible users found</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Non-Official Members</h2>
            <p className="text-xs text-gray-500 mb-4">
              Add external/non-official members to provide required expertise not available in-house.
            </p>
            {nonOfficialMembers.map((nom, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg mb-3">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                    <input type="text" value={nom.firstName} onChange={(e) => {
                      const updated = [...nonOfficialMembers];
                      updated[index] = {...updated[index], firstName: e.target.value};
                      setNonOfficialMembers(updated);
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                    <input type="text" value={nom.lastName} onChange={(e) => {
                      const updated = [...nonOfficialMembers];
                      updated[index] = {...updated[index], lastName: e.target.value};
                      setNonOfficialMembers(updated);
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={nom.email} onChange={(e) => {
                      const updated = [...nonOfficialMembers];
                      updated[index] = {...updated[index], email: e.target.value};
                      setNonOfficialMembers(updated);
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Expertise</label>
                    <select value={nom.expertise} onChange={(e) => {
                      const updated = [...nonOfficialMembers];
                      updated[index] = {...updated[index], expertise: e.target.value};
                      setNonOfficialMembers(updated);
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green">
                      <option value="">Select expertise...</option>
                      {Object.entries(EXPERTISE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Valid From</label>
                    <input type="date" value={nom.validFrom || ''} onChange={(e) => {
                      const updated = [...nonOfficialMembers];
                      updated[index] = {...updated[index], validFrom: e.target.value};
                      setNonOfficialMembers(updated);
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Valid Until</label>
                    <input type="date" value={nom.validUntil || ''} onChange={(e) => {
                      const updated = [...nonOfficialMembers];
                      updated[index] = {...updated[index], validUntil: e.target.value};
                      setNonOfficialMembers(updated);
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green" />
                  </div>
                </div>
                <button onClick={() => setNonOfficialMembers(nonOfficialMembers.filter((_, i) => i !== index))}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-6"
                  title="Remove member">
                  <XCircleIcon className="w-5 h-5" />
                </button>
              </div>
            ))}
            <button onClick={() => setNonOfficialMembers([...nonOfficialMembers, {firstName: '', lastName: '', email: '', expertise: ''}])}
              className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-400 w-full justify-center"
            >
              <PlusIcon className="w-4 h-4" />
              Add Non-Official Member
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Conflict of Interest Configuration</h2>
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
              <input type="checkbox" checked={coiRequired} onChange={(e) => setCoiRequired(e.target.checked)}
                className="text-zammsa-green rounded focus:ring-zammsa-green" />
              <div>
                <p className="text-sm font-medium text-gray-900">Require Conflict of Interest Declarations</p>
                <p className="text-xs text-gray-500">All members must declare COI before evaluation begins</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={resetForm} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              {editingCommitteeId ? 'Cancel Edit' : 'Reset'}
            </button>
            <button onClick={handleSubmit} disabled={formMutation.isPending || !solicitation || !chairperson || !secretary || (new Set([chairperson, secretary, ...members].filter(Boolean)).size + nonOfficialMembers.length < 3)}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2 ${errors && Object.keys(errors).length ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-zammsa-green hover:bg-zammsa-green-dark text-white'}`}>
              {formMutation.isPending ? (
                <><LoadingSpinner size="sm" /> {editingCommitteeId ? 'Updating...' : 'Creating...'}</>
              ) : (
                <><PlusIcon className="w-4 h-4" /> {editingCommitteeId ? 'Update Committee' : 'Form Evaluation Committee'}</>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <UsersIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
              Existing Committees
              {committees.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">({committees.length})</span>
              )}
            </h2>
            {committeesLoading ? (
              <LoadingSpinner size="sm" className="py-4" />
            ) : (
              <div className="space-y-4">
                {(() => {
                  const totalPages = Math.ceil(committees.length / COMMITTEE_PAGE_SIZE);
                  const paginated = committees.slice((committeePage - 1) * COMMITTEE_PAGE_SIZE, committeePage * COMMITTEE_PAGE_SIZE);
                  return (
                    <>
                      {paginated.map((c: any) => {
                        const solStatus = c.solicitation_status || '';
                        const phaseProgress = c.phase_progress || { completed: 0, total: 7, percent: 0 };
                        const currentPhase = c.current_phase || null;
                        const isComplete = phaseProgress.percent === 100;

                        const solStatusColors: Record<string, string> = {
                          draft: 'bg-gray-100 text-gray-700',
                          pending_approval: 'bg-yellow-100 text-yellow-800',
                          approved: 'bg-blue-100 text-blue-800',
                          published: 'bg-green-100 text-green-800',
                          closed: 'bg-gray-200 text-gray-600',
                          awarded: 'bg-emerald-100 text-emerald-800',
                          cancelled: 'bg-red-100 text-red-700',
                        };

                        const phaseColors: Record<string, string> = {
                          coi: 'bg-blue-500',
                          preliminary: 'bg-indigo-500',
                          technical: 'bg-purple-500',
                          consolidation: 'bg-orange-500',
                          financial: 'bg-amber-500',
                          'post-qual': 'bg-teal-500',
                          ber: 'bg-emerald-500',
                        };

                        return (
                          <div key={c.id} className="border border-gray-200 rounded-lg overflow-hidden hover:border-zammsa-green/30 transition-colors">
                            {/* Header: Solicitation info */}
                            <div className="p-3 bg-gray-50 border-b border-gray-100">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-zammsa-green uppercase tracking-wide">{c.solicitation_number || 'N/A'}</p>
                                  <p className="text-sm font-medium text-gray-900 truncate mt-0.5" title={c.solicitation_title}>{c.solicitation_title || 'Untitled Solicitation'}</p>
                                </div>
                                {solStatus && (
                                  <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${solStatusColors[solStatus] || 'bg-gray-100 text-gray-600'}`}>
                                    {solStatus.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Evaluation progress */}
                            <div className="px-3 pt-3 pb-2">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Evaluation Progress</span>
                                {isComplete ? (
                                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                    <CheckCircleIcon className="w-3.5 h-3.5" /> Complete
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-semibold text-gray-500">{phaseProgress.completed}/{phaseProgress.total} phases</span>
                                )}
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-zammsa-green'}`}
                                  style={{ width: `${phaseProgress.percent}%` }}
                                />
                              </div>
                              {currentPhase && !isComplete && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className={`w-2 h-2 rounded-full ${phaseColors[currentPhase.id] || 'bg-gray-400'} animate-pulse`} />
                                  <span className="text-[11px] text-gray-600">
                                    Current: <span className="font-semibold text-gray-800">{currentPhase.label}</span>
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Committee info */}
                            <div className="px-3 pb-3">
                              <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2">
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="w-3 h-3" />
                                  Formed {c.formed_date ? new Date(c.formed_date).toLocaleDateString() : 'N/A'}
                                </span>
                                <span>•</span>
                                <span>{c.member_count || 0} members</span>
                                {c.quorum_met !== undefined && (
                                  <>
                                    <span>•</span>
                                    <span className={c.quorum_met ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                                      {c.quorum_met ? 'Quorum met' : 'Quorum not met'}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Chairperson & Secretary */}
                              <div className="space-y-1.5 mb-2">
                                {c.chairperson_name && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-zammsa-green/10 text-zammsa-green flex items-center justify-center text-[10px] font-bold shrink-0">C</span>
                                    <span className="text-gray-700 truncate">
                                      <span className="font-semibold">{c.chairperson_name}</span>
                                      <span className="text-gray-400 ml-1">Chairperson</span>
                                    </span>
                                  </div>
                                )}
                                {c.secretary_name && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">S</span>
                                    <span className="text-gray-700 truncate">
                                      <span className="font-semibold">{c.secretary_name}</span>
                                      <span className="text-gray-400 ml-1">Secretary</span>
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Member chips */}
                              {Array.isArray(c.members) && c.members.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {c.members.slice(0, 6).map((m: any, idx: number) => {
                                    const memberId = typeof m === 'string' ? m : m?.user || m?.id;
                                    const name = getUserName(memberId);
                                    const displayName = name.split(' (')[0] || memberId?.slice(0, 8);
                                    return (
                                      <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600" title={name}>
                                        {displayName}
                                      </span>
                                    );
                                  })}
                                  {c.members.length > 6 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-500">
                                      +{c.members.length - 6} more
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Non-official members */}
                              {c.non_official_members?.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">External Members</p>
                                  {c.non_official_members.map((nom: any, i: number) => (
                                    <div key={i} className="text-[11px] text-amber-700 pl-2 border-l-2 border-amber-300 mb-1.5">
                                      <p className="font-semibold">{nom.first_name} {nom.last_name}</p>
                                      <p className="text-amber-600">{nom.expertise}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* COI declarations */}
                              {c.coi_declarations && c.coi_declarations.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <p className="text-[10px] font-semibold text-gray-500">
                                    COI Declarations: {c.coi_declarations.length} submitted
                                    {c.coi_declarations.filter((d: any) => d.has_conflict).length > 0 && (
                                      <span className="text-amber-600 ml-1">({c.coi_declarations.filter((d: any) => d.has_conflict).length} conflicts)</span>
                                    )}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 px-3 pb-3">
                              <button type="button" onClick={() => openEditCommittee(c)}
                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1">
                                <DocumentReportIcon className="w-3 h-3" /> Edit
                              </button>
                              {deleteConfirmId === c.id ? (
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => deleteMutation.mutate(c.id)}
                                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">
                                    {deleteMutation.isPending ? 'Deleting...' : 'Confirm'}
                                  </button>
                                  <button type="button" onClick={() => setDeleteConfirmId(null)}
                                    className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-300">
                                    <XCircleIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button type="button" onClick={() => setDeleteConfirmId(c.id)}
                                  className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50">
                                  <TrashIcon className="w-3.5 h-3.5 inline" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {committees.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">No committees formed yet</p>
                      )}

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <button
                            onClick={() => setCommitteePage(p => Math.max(1, p - 1))}
                            disabled={committeePage === 1}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Prev
                          </button>
                          <span className="text-[11px] text-gray-500 font-medium">
                            {committeePage} / {totalPages}
                          </span>
                          <button
                            onClick={() => setCommitteePage(p => Math.min(totalPages, p + 1))}
                            disabled={committeePage === totalPages}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">ZPPA Requirement</p>
                <p className="text-xs text-blue-700 mt-1 space-y-1">
                  <span className="block">• Minimum 3 members, 1 chairperson, 1 secretary</span>
                  <span className="block">• Chairperson and secretary must be different</span>
                  <span className="block">• All members must sign COI declarations</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommitteeFormation;

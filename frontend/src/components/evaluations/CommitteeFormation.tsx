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
} from '@heroicons/react/outline';

const CommitteeFormation: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();

  const [solicitation, setSolicitation] = useState('');
  const [chairperson, setChairperson] = useState('');
  const [secretary, setSecretary] = useState('');
  const [members, setMembers] = useState<string[]>([]);
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
      EVALUATION_COMMITTEE_ROLES.includes(u.role)
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
      const payload = {
        solicitation,
        chairperson,
        secretary,
        members: allMembers,
        require_coi: coiRequired,
      };
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
    return cppRequirements.evaluation_committee_size || cppRequirements.evaluationCommitteeSize || null;
  }, [cppRequirements]);
  const cppRequiredExpertise = useMemo(() => {
    if (!cppRequirements?.requiredExpertise) return null;
    const keys: string[] = cppRequirements.requiredExpertise;
    return keys.map((k: string) => EXPERTISE_LABELS[k] || k).join(', ');
  }, [cppRequirements]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (committeeId: string) => evaluationsApi.deleteCommittee(committeeId),
    onSuccess: () => {
      toast.success('Committee deleted');
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['evaluation-committees'] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-committee'] });
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
    if (uniqueTotal < 3) newErrors.members = `At least 3 unique people required (chairperson + secretary + members). Currently: ${uniqueTotal}`;
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
    setCoiRequired(c.require_coi !== false);
    setErrors({});
  };

  const resetForm = () => {
    setEditingCommitteeId(null);
    setSolicitation('');
    setChairperson('');
    setSecretary('');
    setMembers([]);
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
            <button onClick={handleSubmit} disabled={formMutation.isPending || !solicitation || !chairperson || !secretary || new Set([chairperson, secretary, ...members].filter(Boolean)).size < 3}
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
            </h2>
            {committeesLoading ? (
              <LoadingSpinner size="sm" className="py-4" />
            ) : (
              <div className="space-y-3">
                {committees.slice(0, 10).map((c: any) => (
                  <div key={c.id} className="p-3 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition-colors">
                    <p className="font-medium text-gray-900 truncate">{c.solicitation_number || c.solicitation_title || c.solicitation?.slice(0, 12)}</p>
                    <p className="text-xs text-gray-500">
                      {c.member_count || 0} members · {c.chairperson_name ? `Chair: ${c.chairperson_name.split(' ')[0]}` : ''}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button type="button" onClick={() => openEditCommittee(c)}
                        className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50">
                        Edit
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
                ))}
                {committees.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No committees formed yet</p>
                )}
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

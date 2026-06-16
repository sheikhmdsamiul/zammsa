import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationsApi } from '../../api/evaluations';
import { solicitationsApi } from '../../api/solicitations';
import { usersApi } from '../../api/endpoints';
import { useAppSelector } from '../../hooks/useRedux';
import { ROLES, EVALUATION_COMMITTEE_ROLES } from '../../config/rbac';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'COI Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  no_conflict: { label: 'Declared - No Conflict', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  recused: { label: 'Recused', color: 'text-red-700', bg: 'bg-red-100' },
};

type CommitteeCOIStatus = {
  committeeId: string;
  declared: boolean;
  recused: boolean;
  declarationType?: string;
};

const EvaluationsList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAppSelector((s) => s.auth);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCommitteeId, setEditingCommitteeId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ solicitation: '', chairperson: '', chairpersonName: '', secretary: '', secretaryName: '', members: [] as string[], coiRequired: true });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const myEvaluationsOnly = user?.role ? EVALUATION_COMMITTEE_ROLES.includes(user.role) : false;
  const manageCommitteeRoles: string[] = [
    ROLES.PROCUREMENT_OFFICER,
    ROLES.PROCUREMENT_MANAGER,
    ROLES.DIRECTOR_PROCUREMENT,
    ROLES.SYSTEM_ADMIN,
  ];
  const canManageCommittees = !!user?.role && manageCommitteeRoles.includes(user.role);

  const { data, isLoading } = useQuery({
    queryKey: ['evaluation-committees', page, pageSize, search, myEvaluationsOnly],
    queryFn: () => evaluationsApi.listCommittees({ page, page_size: pageSize, search, mine: myEvaluationsOnly ? true : undefined }),
  });

  const { data: solsData } = useQuery({
    queryKey: ['solicitations-for-committee'],
    queryFn: () => solicitationsApi.list({ page_size: 50 }),
    enabled: showForm,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-committee'],
    queryFn: () => usersApi.list({ page_size: 100 }),
    enabled: showForm,
  });
  const allUsers = usersData?.results || [];
  const eligibleUsers = useMemo(() =>
    allUsers.filter((u: any) =>
      EVALUATION_COMMITTEE_ROLES.includes(u.role)
    ),
    [allUsers],
  );

  const committees = data?.results || [];

  const coiStatuses: CommitteeCOIStatus[] = committees.map((c: any) => {
    const myDecl = (c.coi_declarations || []).find(
      (d: any) => d.member === user?.id || d.user === user?.id || d.user_id === user?.id
    );
    const isRecused = myDecl?.recused === true;
    return {
      committeeId: c.id,
      declared: !!myDecl,
      recused: isRecused,
      declarationType: myDecl?.declaration_type,
    };
  });

  const getMemberStatus = (committeeId: string) => {
    const s = coiStatuses.find(cs => cs.committeeId === committeeId);
    if (!s || !s.declared) return STATUS_CONFIG.pending;
    if (s.recused) return STATUS_CONFIG.recused;
    return STATUS_CONFIG.no_conflict;
  };

  const formMutation = useMutation({
    mutationFn: () => {
      const members = Array.from(new Set([...formData.members, formData.chairperson, formData.secretary].filter(Boolean)));
      const payload = {
        solicitation: formData.solicitation,
        chairperson: formData.chairperson,
        secretary: formData.secretary,
        members,
        require_coi: formData.coiRequired,
      } as any;

      return editingCommitteeId
        ? evaluationsApi.updateCommittee(editingCommitteeId, payload)
        : evaluationsApi.formCommittee(payload);
    },
    onSuccess: () => {
      toast.success(editingCommitteeId ? 'Evaluation committee updated' : 'Evaluation committee formed');
      setShowForm(false);
      setEditingCommitteeId(null);
      setFormData({ solicitation: '', chairperson: '', chairpersonName: '', secretary: '', secretaryName: '', members: [], coiRequired: true });
      setFormErrors({});
      queryClient.invalidateQueries({ queryKey: ['evaluation-committees'] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-committee'] });
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(data).forEach(([field, msgs]) => {
          if (Array.isArray(msgs)) fieldErrors[field] = msgs[0];
          else if (typeof msgs === 'string') fieldErrors[field] = msgs;
        });
        setFormErrors(fieldErrors);
      }
      toast.error(editingCommitteeId ? 'Failed to update committee' : 'Failed to form committee');
    },
  });

  const openCreateForm = () => {
    setEditingCommitteeId(null);
    setFormData({ solicitation: '', chairperson: '', chairpersonName: '', secretary: '', secretaryName: '', members: [], coiRequired: true });
    setFormErrors({});
    setShowForm(true);
  };

  const openEditForm = (row: any) => {
    const committeeMembers = Array.isArray(row.members)
      ? row.members.map((m: any) => (typeof m === 'string' ? m : m?.user || m?.id)).filter(Boolean)
      : [];
    const chairpersonId = row.chairperson || '';
    const secretaryId = row.secretary || '';

    setEditingCommitteeId(row.id);
    setFormData({
      solicitation: row.solicitation || '',
      chairperson: chairpersonId,
      chairpersonName: row.chairperson_name || '',
      secretary: secretaryId,
      secretaryName: row.secretary_name || '',
      members: Array.from(new Set(committeeMembers.filter((id: string) => id !== chairpersonId && id !== secretaryId))),
      coiRequired: row.require_coi !== false,
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleOpenEvaluation = (row: any) => {
    navigate(`/evaluations/${row.id}`);
  };

  const columns = myEvaluationsOnly
    ? [
        {
          key: 'solicitation_number',
          label: 'Solicitation',
          render: (v: string, row: any) => (
            <span className="font-mono text-sm font-medium text-gray-900">{v || row.solicitation?.slice(0, 8) || '-'}</span>
          ),
        },
        {
          key: 'solicitation_title',
          label: 'Title',
          render: (v: string) => (
            <span className="text-sm text-gray-700 max-w-[200px] block truncate">{v || '-'}</span>
          ),
        },
        {
          key: 'phase_progress',
          label: 'Phase Progress',
          render: (_: any, row: any) => {
            const phaseInfo = row.current_phase || { id: 'coi', label: 'COI Declaration' };
            const progress = row.phase_progress || { completed: 0, total: 7, percent: 0 };
            const phaseColors: Record<string, string> = {
              coi: 'bg-amber-100 text-amber-700',
              preliminary: 'bg-yellow-100 text-yellow-700',
              technical: 'bg-blue-100 text-blue-700',
              financial: 'bg-emerald-100 text-emerald-700',
              consolidation: 'bg-purple-100 text-purple-700',
              ber: 'bg-indigo-100 text-indigo-700',
              'post-qual': 'bg-teal-100 text-teal-700',
            };
            const phaseIcons: Record<string, string> = {
              coi: '🔴',
              preliminary: '🟡',
              technical: '🔵',
              financial: '🟢',
              consolidation: '🟣',
              ber: '🟠',
              'post-qual': '🔷',
            };
            return (
              <div className="flex items-center gap-2">
                <span className={`text-xs ${phaseColors[phaseInfo.id] || 'bg-gray-100 text-gray-700'} px-2 py-1 rounded-full font-medium`}>
                  {phaseIcons[phaseInfo.id] || '📋'} {phaseInfo.label}
                </span>
                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zammsa-green transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            );
          },
        },
        {
          key: 'status',
          label: 'Your Status',
          render: (_: any, row: any) => {
            const st = getMemberStatus(row.id);
            return (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.color}`}>
                ⚠ {st.label}
              </span>
            );
          },
        },
        {
          key: 'action',
          label: 'Action',
          render: (_: any, row: any) => (
            <button
              onClick={(e) => { e.stopPropagation(); handleOpenEvaluation(row); }}
              className="px-4 py-1.5 bg-zammsa-green text-white rounded-lg text-xs font-bold hover:bg-green-700"
            >
              Open
            </button>
          ),
        },
      ]
    : [
        { key: 'id', label: 'ID', render: (_: any, row: any) => (
          <span className="text-zammsa-green hover:underline font-medium cursor-pointer" onClick={() => navigate(`/evaluations/${row.id}`)}>{row.id?.slice(0, 8)}</span>
        )},
        { key: 'solicitation', label: 'Solicitation' },
        { key: 'member_count', label: 'Members', render: (v: number) => `${v ?? 0}` },
        { key: 'chairperson_name', label: 'Chairperson' },
        { key: 'secretary_name', label: 'Secretary' },
        { key: 'formed_date', label: 'Formed', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
        { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v || 'active'} /> },
        ...(canManageCommittees ? [{
          key: 'actions',
          label: 'Actions',
          render: (_: any, row: any) => (
            <button
              onClick={(e) => { e.stopPropagation(); openEditForm(row); }}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>
          ),
        }] : []),
      ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {myEvaluationsOnly ? 'My Evaluations' : 'Evaluation Committees'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {myEvaluationsOnly
              ? 'Only evaluations assigned to you are shown'
              : 'Manage evaluation committees, COI declarations, and scoring'}
          </p>
        </div>
        {canManageCommittees && (
          <button onClick={openCreateForm} className="px-4 py-2 bg-zammsa-green text-white rounded-xl text-sm font-bold">
            Form Committee
          </button>
        )}
      </div>

      {canManageCommittees && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setShowForm(false); setEditingCommitteeId(null); setFormErrors({}); }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingCommitteeId ? 'Update Evaluation Committee' : 'Form Evaluation Committee'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Solicitation *</label>
                <select value={formData.solicitation} onChange={(e) => { setFormData(p => ({ ...p, solicitation: e.target.value })); setFormErrors(p => { const n = {...p}; delete n.solicitation; return n; }); }}
                  className={`w-full border rounded-lg px-4 py-2 text-sm ${formErrors.solicitation ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <option value="">Select solicitation...</option>
                  {(solsData?.results || []).map((sol: any) => (
                    <option key={sol.id} value={sol.id}>{sol.sol_number || sol.title}</option>
                  ))}
                </select>
                {formErrors.solicitation && <p className="text-xs text-red-500 mt-1">{formErrors.solicitation}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chairperson *</label>
                  <select value={formData.chairperson} onChange={(e) => { setFormData(p => ({ ...p, chairperson: e.target.value })); setFormErrors(p => { const n = {...p}; delete n.chairperson; delete n.secretary; return n; }); }}
                    className={`w-full border rounded-lg px-4 py-2 text-sm ${formErrors.chairperson ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select chairperson...</option>
                    {eligibleUsers.filter((u: any) => u.id !== formData.secretary && u.role === ROLES.EVALUATION_COMMITTEE_CHAIR).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                  {formErrors.chairperson && <p className="text-xs text-red-500 mt-1">{formErrors.chairperson}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secretary *</label>
                  <select value={formData.secretary} onChange={(e) => { setFormData(p => ({ ...p, secretary: e.target.value })); setFormErrors(p => { const n = {...p}; delete n.secretary; delete n.chairperson; return n; }); }}
                    className={`w-full border rounded-lg px-4 py-2 text-sm ${formErrors.secretary ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">Select secretary...</option>
                    {eligibleUsers.filter((u: any) => u.id !== formData.chairperson && u.role === ROLES.EVALUATION_COMMITTEE_MEMBER).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                  {formErrors.secretary && <p className="text-xs text-red-500 mt-1">{formErrors.secretary}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Members * <span className="text-gray-400 font-normal ml-2">({formData.members.length} selected)</span></label>
                {formErrors.members && <p className="text-xs text-red-500 mb-2">{formErrors.members}</p>}
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {eligibleUsers.filter((u: any) => u.role === ROLES.EVALUATION_COMMITTEE_MEMBER && u.id !== formData.secretary && u.id !== formData.chairperson).map((u: any) => {
                    const isSelected = formData.members.includes(u.id);
                    return (
                      <label key={u.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm ${isSelected ? 'bg-zammsa-green/5' : 'hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={isSelected}
                          onChange={() => setFormData(p => ({
                            ...p,
                            members: isSelected ? p.members.filter((id: string) => id !== u.id) : [...p.members, u.id],
                          }))} />
                        <span className="flex-1">{u.full_name || u.email}</span>
                        <span className="text-gray-400 text-xs">{u.role || ''}</span>
                        {formData.chairperson === u.id && <span className="text-xs font-semibold text-zammsa-green">Chairperson</span>}
                        {formData.secretary === u.id && <span className="text-xs font-semibold text-blue-600">Secretary</span>}
                      </label>
                    );
                  })}
                  {eligibleUsers.length === 0 && <p className="px-3 py-4 text-sm text-gray-400">No eligible users found</p>}
                </div>
              </div>
              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={formData.coiRequired} onChange={(e) => setFormData(p => ({ ...p, coiRequired: e.target.checked }))}
                    className="text-zammsa-green rounded focus:ring-zammsa-green" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Require COI Declarations</p>
                    <p className="text-xs text-gray-500">All members must declare COI before evaluation</p>
                  </div>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditingCommitteeId(null); setFormErrors({}); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => formMutation.mutate()} disabled={!formData.solicitation || !formData.chairperson || !formData.secretary || new Set([formData.chairperson, formData.secretary, ...formData.members].filter(Boolean)).size < 3 || formMutation.isPending}
                className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {formMutation.isPending
                  ? (editingCommitteeId ? 'Updating...' : 'Creating...')
                  : (editingCommitteeId ? 'Update Committee' : 'Create Committee')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search evaluations..." />
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={committees} onRowClick={(row) => handleOpenEvaluation(row)} />
        )}
        {data && (
          <Pagination currentPage={page} totalPages={Math.ceil(data.count / pageSize)} pageSize={pageSize}
            totalItems={data.count} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default EvaluationsList;

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { GeneralProcurementNotice } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  GlobeIcon,
  MailIcon,
  DocumentTextIcon,
  ExternalLinkIcon,
  DownloadIcon,
  RefreshIcon,
  OfficeBuildingIcon,
  UserCircleIcon,
  BellIcon,
  PencilIcon,
  XIcon,
  PrinterIcon,
  CashIcon,
  ShieldCheckIcon,
  CalendarIcon,
} from '@heroicons/react/outline';

const PUBLICATION_TARGETS = [
  {
    key: 'zammsa_website',
    label: 'ZAMMSA Website',
    description: 'Auto-published immediately upon clicking Publish',
    icon: GlobeIcon,
  },
  {
    key: 'egp_portal',
    label: 'ZPPA e-GP Portal',
    description: 'API call triggered automatically',
    icon: OfficeBuildingIcon,
  },
  {
    key: 'registered_supplier_email',
    label: 'Registered Supplier Email Notifications',
    description: '47 registered suppliers in relevant categories will receive email notification',
    icon: MailIcon,
  },
  {
    key: 'govt_gazette',
    label: 'Government Gazette',
    description: 'System generates Gazette-formatted file for upload (submitted manually to Government Printer)',
    icon: DocumentTextIcon,
  },
];

const GPNDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gpn, setGpn] = useState<GeneralProcurementNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [publicationSuccess, setPublicationSuccess] = useState<{
    proofs: Record<string, { url?: string; timestamp: string; reference?: string; delivered?: number; failed?: number; status: string }>;
    zppaDeadline?: string;
    daysRemaining?: number;
  } | null>(null);

  const [formContent, setFormContent] = useState<Record<string, any>>({});

  const loadGPN = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await procurementPlanningApi.gpn.detail(id);
      setGpn(data);
      setFormData(data.content || {});
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load GPN');
      setGpn(null);
    }
    setLoading(false);
  };

  const setFormData = (content: Record<string, any>) => {
    if (!content) return;
    setFormContent({
      gpn_reference: content.gpn_reference || '',
      issuing_authority: content.issuing_authority || 'ZAMMSA — Zambia Medicines and Medical Supplies Agency',
      contact_name: content.contact_name || 'Director of Procurement',
      contact_email: content.contact_email || 'procurement@zammsa.gov.zm',
      contact_phone: content.contact_phone || '+260 211 123456',
      contact_address: content.contact_address || 'Plot 1, Government Road, Lusaka',
      notice_heading: content.notice_heading || '',
      notice_body: content.notice_body || '',
      ...content,
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormContent((prev: Record<string, any>) => ({ ...prev, [field]: value }));
  };

  const toggleTarget = (key: string) => {
    setFormContent(prev => {
      const targets = [...(prev.publication_targets || [])];
      const index = targets.indexOf(key);
      if (index >= 0) {
        targets.splice(index, 1);
      } else {
        targets.push(key);
      }
      return { ...prev, publication_targets: targets };
    });
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const contentUpdate: Record<string, any> = {
        gpn_reference: formContent.gpn_reference,
        issuing_authority: formContent.issuing_authority,
        contact_name: formContent.contact_name,
        contact_email: formContent.contact_email,
        contact_phone: formContent.contact_phone,
        contact_address: formContent.contact_address,
        notice_heading: formContent.notice_heading,
        notice_body: formContent.notice_body,
      };

      await procurementPlanningApi.gpn.update(id!, { content: contentUpdate });
      toast.success('Draft saved');
      setGpn(prev => prev ? { ...prev, content: { ...(prev?.content || {}), ...contentUpdate } } : null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save draft');
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!formContent.contact_name || !formContent.contact_email) {
      toast.error('Please fill in required contact information');
      return;
    }

    setPublishing(true);
    try {
      await saveDraft();

      const targets = formContent.publication_targets || ['zammsa_website', 'egp_portal', 'registered_supplier_email'];

      const emailStats = { count: 47, failed: 0 };

      const res = await procurementPlanningApi.gpn.publish(id!, targets, [], {}, emailStats);
      toast.success(res.message);

      const updatedGPN = await procurementPlanningApi.gpn.detail(id!);

      let zppaDeadline: string | undefined;
      let daysRemaining: number | undefined;
      if (updatedGPN.content?.zppa_deadline) {
        const deadline = new Date(updatedGPN.content.zppa_deadline);
        zppaDeadline = deadline.toLocaleDateString('en-ZM', { year: 'numeric', month: 'short', day: 'numeric' });
        const timeDiff = deadline.getTime() - Date.now();
        daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      }

      setGpn(updatedGPN);
      setFormData(updatedGPN.content || {});
      setPublicationSuccess({
        proofs: res.publication_proofs || {},
        zppaDeadline,
        daysRemaining: daysRemaining !== null && daysRemaining !== undefined && daysRemaining >= 0 ? daysRemaining : undefined,
      });

      setTimeout(() => { setPublicationSuccess(null); }, 30000);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to publish GPN');
    }
    setPublishing(false);
  };

  const generatePreview = async () => {
    setPreviewLoading(true);
    try {
      toast('PDF preview generation would be implemented here');
    } catch {
      toast.error('Failed to generate preview');
    }
    setPreviewLoading(false);
  };

  useEffect(() => { loadGPN(); }, [id]);

  if (loading) return <LoadingSpinner size="lg" className="py-24" />;
  if (!gpn) return <div className="text-center py-24 text-gray-500 font-bold tracking-widest">GPN not found</div>;

  const lineItems = gpn.content?.line_items || [];
  const totalValue = lineItems.reduce((sum: number, item: any) => sum + (item.estimated_value || 0), 0);

  const zpcApprovedAt = gpn.content?.zpc_approved_at;
  const zpcApprovalDate = zpcApprovedAt
    ? new Date(zpcApprovedAt).toLocaleDateString('en-ZM', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'TBD';

  const canEdit = ['procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'].includes(user?.role || '');
  const isPublished = gpn.publication_status === 'published';

  if (isPublished && publicationSuccess) {
    return (
      <div className="pb-12 max-w-7xl mx-auto">
        <PageHeader
          title="General Procurement Notice"
          description={`${gpn.content?.department || '-'} — FY ${gpn.content?.fiscal_year || '-'}`}
          breadcrumbs={[
            { label: 'GPNs', path: '/procurement-planning/gpns' },
            { label: 'View GPN' }
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Link to="/procurement-planning/gpns" className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-all">
                <ArrowLeftIcon className="w-5 h-5" />
              </Link>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />
                Published
              </span>
            </div>
          }
        />

        {/* Success Banner */}
        <div className="bg-green-50 border border-green-200 rounded-3xl p-8 mb-8">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircleIcon className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-green-900 uppercase tracking-widest mb-1">General Procurement Notice Published</h2>
              <p className="text-sm text-green-700">
                <span className="font-bold">{formContent.gpn_reference || gpn.content?.gpn_reference || 'GPN-XXXX-XXX-XXX'}</span> has been published to all selected channels.
              </p>
            </div>
          </div>
        </div>

        {/* Publication Proofs */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 mb-8">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5" />
            Publication Proofs
          </h2>
          <div className="space-y-4">
            {Object.keys(publicationSuccess.proofs || {}).map((channel) => {
              const proof = publicationSuccess.proofs![channel];
              const channelConfig = PUBLICATION_TARGETS.find(t => t.key === channel) || { label: channel, description: '', icon: DocumentTextIcon };
              const ChannelIcon = channelConfig.icon;

              return (
                <div key={channel} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:border-teal-200 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      channel === 'govt_gazette' && !proof.url ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'
                    }`}>
                      {channel === 'govt_gazette' && !proof.url ? (
                        <ClockIcon className="w-6 h-6" />
                      ) : (
                        <CheckCircleIcon className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-900">{channelConfig.label}</p>
                        {proof.status === 'published' && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">Published</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{channelConfig.description}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" />
                          {new Date(proof.timestamp).toLocaleString('en-ZM', {
                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        {proof.reference && (
                          <span className="flex items-center gap-1">
                            <DocumentTextIcon className="w-3.5 h-3.5" />
                            Ref: {proof.reference}
                          </span>
                        )}
                        {proof.delivered !== undefined && (
                          <span className="flex items-center gap-1">
                            <MailIcon className="w-3.5 h-3.5" />
                            {proof.delivered} delivered {proof.failed ? `| ${proof.failed} failed` : ''}
                          </span>
                        )}
                      </div>

                      {proof.url && (
                        <div className="mt-3">
                          <a href={proof.url} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:text-teal-800">
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                            {proof.url}
                          </a>
                        </div>
                      )}

                      {channel === 'govt_gazette' && !proof.url && (
                        <div className="mt-3">
                          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                            <DownloadIcon className="w-3.5 h-3.5" />
                            Download Gazette File
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ZPPA Deadline Tracking */}
        {publicationSuccess.zppaDeadline && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <ExclamationCircleIcon className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900 mb-3">ZPPA Submission Tracking</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-4 bg-white/60 rounded-xl border border-amber-100">
                    <p className="text-xs text-amber-700 uppercase tracking-widest font-bold mb-1">Submission Deadline</p>
                    <p className="font-bold text-gray-900">{publicationSuccess.zppaDeadline}</p>
                  </div>
                  <div className="p-4 bg-white/60 rounded-xl border border-amber-100">
                    <p className="text-xs text-amber-700 uppercase tracking-widest font-bold mb-1">Days Remaining</p>
                    <p className={`font-bold ${
                      publicationSuccess.daysRemaining! <= 3
                        ? 'text-red-600'
                        : publicationSuccess.daysRemaining! <= 7
                        ? 'text-amber-600'
                        : 'text-green-600'
                    }`}>
                      {publicationSuccess.daysRemaining!} days
                    </p>
                  </div>
                </div>
                <p className="text-xs text-amber-700 mt-3">Reminder: Update ZPPA submission reference after submission</p>
                <div className="mt-4">
                  <button onClick={() => navigate(`/procurement-planning/${gpn.app}`)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-amber-700 bg-white border border-amber-300 rounded-xl hover:bg-amber-50 transition-colors">
                    <RefreshIcon className="w-3.5 h-3.5" />
                    Update ZPPA Submission
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <div className="flex flex-wrap gap-3">
            <button onClick={generatePreview} disabled={previewLoading}
                    className="inline-flex items-center gap-2 px-5 py-3 border border-teal-300 text-teal-700 rounded-xl text-sm font-bold hover:bg-teal-50 disabled:opacity-50 transition-colors">
              <DocumentTextIcon className="w-4 h-4" />
              {previewLoading ? 'Generating...' : 'Preview GPN PDF'}
            </button>
            <button onClick={() => navigate('/procurement-planning/gpns')}
                    className="px-5 py-3 text-sm font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Back to GPN List
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Published read-only view (on reload, without success data)
  if (isPublished && !publicationSuccess) {
    return (
      <div className="pb-12 max-w-7xl mx-auto">
        <PageHeader
          title={`${gpn.content?.department || 'Department'} — FY ${gpn.content?.fiscal_year || '2026/2027'}`}
          description={`Reference: ${formContent.gpn_reference || 'GPN-XXXX-XXX-XXX'}`}
          breadcrumbs={[
            { label: 'GPNs', path: '/procurement-planning/gpns' },
            { label: 'View GPN' }
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Link to="/procurement-planning/gpns" className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-all">
                <ArrowLeftIcon className="w-5 h-5" />
              </Link>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />
                Published
              </span>
            </div>
          }
        />

        {/* Banner */}
        <div className="bg-green-50 border border-green-200 rounded-3xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-black text-green-900 uppercase tracking-widest">Published GPN</h2>
              <p className="text-sm text-green-700 mt-1">This General Procurement Notice has been published. Content is locked.</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            label="Total Estimated Value"
            value={`K ${totalValue.toLocaleString()}`}
            icon={<CashIcon className="w-6 h-6" />}
            color="green"
            description="Planned procurements total"
          />
          <StatCard
            label="Line Items"
            value={lineItems.length}
            icon={<DocumentTextIcon className="w-6 h-6" />}
            color="blue"
            description="Planned procurements"
          />
          <StatCard
            label="Published"
            value={gpn.published_at ? new Date(gpn.published_at).toLocaleDateString('en-GB') : '---'}
            icon={<CalendarIcon className="w-6 h-6" />}
            color="orange"
            description="Publication date"
          />
        </div>

        {/* Read-only content */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 mb-8">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8">GPN Content</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><OfficeBuildingIcon className="w-5 h-5 text-gray-400" /></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Issuing Authority</p><p className="text-sm font-bold text-gray-900">{formContent.issuing_authority}</p></div>
              </div>
              <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Contact Information</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3"><span className="text-[10px] font-black text-gray-400 w-12">Name</span><span className="font-bold text-gray-900">{formContent.contact_name}</span></div>
                  <div className="flex gap-3"><span className="text-[10px] font-black text-gray-400 w-12">Email</span><span className="font-bold text-gray-900">{formContent.contact_email}</span></div>
                  <div className="flex gap-3"><span className="text-[10px] font-black text-gray-400 w-12">Phone</span><span className="font-bold text-gray-900">{formContent.contact_phone}</span></div>
                  <div className="flex gap-3"><span className="text-[10px] font-black text-gray-400 w-12">Address</span><span className="font-bold text-gray-900">{formContent.contact_address}</span></div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><DocumentTextIcon className="w-5 h-5 text-gray-400" /></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notice Heading</p><p className="text-sm font-bold text-gray-900">{formContent.notice_heading}</p></div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 mt-1"><DocumentTextIcon className="w-5 h-5 text-gray-400" /></div>
                <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notice Body</p><p className="text-sm text-gray-700 bg-gray-50/50 rounded-2xl p-5 border border-gray-100 whitespace-pre-wrap leading-relaxed">{formContent.notice_body}</p></div>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Planned Procurements</p>
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-50">
                  <thead className="bg-gray-50/30">
                    <tr>
                      <th className="px-5 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                      <th className="px-5 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value (K)</th>
                      <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Method</th>
                      <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Est. Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lineItems.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 text-sm font-bold text-gray-800">{item.description}</td>
                        <td className="px-5 py-4 text-sm text-right font-bold text-gray-900">{Number(item.estimated_value).toLocaleString()}</td>
                        <td className="px-5 py-4 text-sm text-center"><span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-gray-100 text-gray-600">{item.procurement_type_display || item.procurement_type || '-'}</span></td>
                        <td className="px-5 py-4 text-sm text-center text-gray-500">{item.planned_issue_date ? new Date(item.planned_issue_date).toLocaleDateString('en-ZM', { month: 'short', year: 'numeric' }) : '-'}</td>
                      </tr>
                    ))}
                    {lineItems.length === 0 && (<tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400 italic text-sm">No planned procurements</td></tr>)}
                  </tbody>
                  {lineItems.length > 0 && (
                    <tfoot className="bg-gray-50/50 font-black">
                      <tr><td className="px-5 py-4 text-sm text-gray-500">Total</td><td className="px-5 py-4 text-sm text-right text-gray-900">{totalValue.toLocaleString()}</td><td colSpan={2}></td></tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <div className="flex flex-wrap gap-3">
            <button onClick={generatePreview} disabled={previewLoading} className="inline-flex items-center gap-2 px-5 py-3 border border-teal-300 text-teal-700 rounded-xl text-sm font-bold hover:bg-teal-50 disabled:opacity-50 transition-colors">
              <DocumentTextIcon className="w-4 h-4" />
              {previewLoading ? 'Generating...' : 'Preview GPN PDF'}
            </button>
            <button onClick={() => navigate('/procurement-planning/gpns')} className="px-5 py-3 text-sm font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Back to GPN List</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12 max-w-7xl mx-auto">
      <PageHeader
        title={`${gpn.content?.department || 'Department'} — FY ${gpn.content?.fiscal_year || '2026/2027'}`}
        description={`Reference: ${formContent.gpn_reference || 'GPN-XXXX-XXX-XXX'}`}
        breadcrumbs={[
          { label: 'GPNs', path: '/procurement-planning/gpns' },
          { label: 'View GPN' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && !isPublished && (
              <button onClick={saveDraft} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-xs font-bold text-gray-500 hover:text-blue-600 transition-all uppercase tracking-widest">
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
            )}
            <StatusBadge status={gpn.publication_status || 'draft'} className="py-2 px-4 shadow-sm" />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              label="Total Estimated Value"
              value={`K ${totalValue.toLocaleString()}`}
              icon={<CashIcon className="w-6 h-6" />}
              color="green"
              description="Planned procurements total"
            />
            <StatCard
              label="Line Items"
              value={lineItems.length}
              icon={<DocumentTextIcon className="w-6 h-6" />}
              color="blue"
              description="Planned procurements"
            />
            <StatCard
              label="ZPC Approval"
              value={zpcApprovalDate}
              icon={<ShieldCheckIcon className="w-6 h-6" />}
              color="orange"
              description={`APP approved on this date`}
            />
          </div>

          {/* GPN Content */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8">GPN Content</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-8">
                {/* Issuing Authority */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><OfficeBuildingIcon className="w-5 h-5 text-gray-400" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Issuing Authority</p>
                    {!canEdit ? (
                      <p className="text-sm font-bold text-gray-900">{formContent.issuing_authority}</p>
                    ) : (
                      <input value={formContent.issuing_authority || ''} onChange={(e) => handleInputChange('issuing_authority', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                    )}
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <UserCircleIcon className="w-4 h-4" />
                    Contact Information
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-12 shrink-0">Name</span>
                      {!canEdit ? (
                        <p className="text-sm font-bold text-gray-900">{formContent.contact_name}</p>
                      ) : (
                        <input value={formContent.contact_name || ''} onChange={(e) => handleInputChange('contact_name', e.target.value)}
                          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-12 shrink-0">Email</span>
                      {!canEdit ? (
                        <p className="text-sm font-bold text-gray-900">{formContent.contact_email}</p>
                      ) : (
                        <input value={formContent.contact_email || ''} onChange={(e) => handleInputChange('contact_email', e.target.value)}
                          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-12 shrink-0">Phone</span>
                      {!canEdit ? (
                        <p className="text-sm font-bold text-gray-900">{formContent.contact_phone}</p>
                      ) : (
                        <input value={formContent.contact_phone || ''} onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-12 shrink-0">Address</span>
                      {!canEdit ? (
                        <p className="text-sm font-bold text-gray-900">{formContent.contact_address}</p>
                      ) : (
                        <input value={formContent.contact_address || ''} onChange={(e) => handleInputChange('contact_address', e.target.value)}
                          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Notice Heading */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><DocumentTextIcon className="w-5 h-5 text-gray-400" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notice Heading</p>
                    {!canEdit ? (
                      <p className="text-sm font-bold text-gray-900">{formContent.notice_heading}</p>
                    ) : (
                      <input value={formContent.notice_heading || ''} onChange={(e) => handleInputChange('notice_heading', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all" />
                    )}
                  </div>
                </div>

                {/* Notice Body */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 mt-1"><DocumentTextIcon className="w-5 h-5 text-gray-400" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notice Body</p>
                    {!canEdit ? (
                      <div className="text-sm text-gray-700 bg-gray-50/50 rounded-2xl p-5 border border-gray-100 whitespace-pre-wrap leading-relaxed">
                        {formContent.notice_body}
                      </div>
                    ) : (
                      <textarea value={formContent.notice_body || ''} onChange={(e) => handleInputChange('notice_body', e.target.value)}
                        rows={6}
                        className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-4 focus:ring-zammsa-green/5 transition-all resize-none" />
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Line Items */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Planned Procurements</p>
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-50">
                    <thead className="bg-gray-50/30">
                      <tr>
                        <th className="px-5 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                        <th className="px-5 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value (K)</th>
                        <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Method</th>
                        <th className="px-5 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Est. Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lineItems.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-4 text-sm font-bold text-gray-800">{item.description}</td>
                          <td className="px-5 py-4 text-sm text-right font-bold text-gray-900">
                            {Number(item.estimated_value).toLocaleString()}
                          </td>
                          <td className="px-5 py-4 text-sm text-center">
                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-gray-100 text-gray-600">
                              {item.procurement_type_display || item.procurement_type || '-'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-center text-gray-500">
                            {item.planned_issue_date
                              ? new Date(item.planned_issue_date).toLocaleDateString('en-ZM', { month: 'short', year: 'numeric' })
                              : '-'
                            }
                          </td>
                        </tr>
                      ))}
                      {lineItems.length === 0 && (
                        <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400 italic text-sm">No planned procurements</td></tr>
                      )}
                    </tbody>
                    {lineItems.length > 0 && (
                      <tfoot className="bg-gray-50/50 font-black">
                        <tr>
                          <td className="px-5 py-4 text-sm text-gray-500">Total</td>
                          <td className="px-5 py-4 text-sm text-right text-gray-900">{totalValue.toLocaleString()}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Publication Channels */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <GlobeIcon className="w-4 h-4" />
              Channels
            </h2>
            <div className="space-y-4">
              {PUBLICATION_TARGETS.map((channel) => {
                const ChannelIcon = channel.icon;
                const isChecked = (formContent.publication_targets || []).includes(channel.key);
                return (
                  <div key={channel.key}
                    onClick={() => canEdit && !isPublished && toggleTarget(channel.key)}
                    className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                      isChecked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100 hover:border-gray-200'
                    } ${!canEdit || isPublished ? 'cursor-default' : ''}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isChecked ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-400'
                    }`}>
                      <ChannelIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-bold uppercase tracking-widest ${isChecked ? 'text-emerald-900' : 'text-gray-700'}`}>
                          {channel.label}
                        </p>
                        {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{channel.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ZPPA Tracking */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4" />
              ZPPA Tracking
            </h2>
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ZPC Approval</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{zpcApprovalDate}</p>
                </div>
                <CalendarIcon className="w-5 h-5 text-gray-300" />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ZPPA Deadline</p>
                  {gpn.content?.zppa_deadline ? (
                    <div>
                      <p className="text-sm font-bold text-gray-900 mt-1">
                        {new Date(gpn.content.zppa_deadline).toLocaleDateString('en-ZM', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                      {(() => {
                        const daysRemaining = Math.ceil((new Date(gpn.content.zppa_deadline).getTime() - Date.now()) / (1000 * 3600 * 24));
                        return (
                          <p className={`text-[10px] font-bold mt-0.5 ${
                            daysRemaining <= 3 ? 'text-red-600' : daysRemaining <= 7 ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {daysRemaining} days remaining
                          </p>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic mt-1">Not set</p>
                  )}
                </div>
                <ExclamationCircleIcon className="w-5 h-5 text-amber-400" />
              </div>

              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    ZPPA Submitted?
                    <span className={`ml-2 font-bold ${gpn.content?.zppa_submitted ? 'text-green-600' : 'text-gray-700'}`}>
                      {gpn.content?.zppa_submitted ? 'Yes' : 'No'}
                    </span>
                  </p>
                  {gpn.content?.zppa_submitted && gpn.content?.zppa_submission_ref && (
                    <span className="text-[10px] font-bold text-gray-400">Ref: {gpn.content.zppa_submission_ref}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Actions</h2>
            <div className="space-y-3">
              <button onClick={generatePreview} disabled={previewLoading || isPublished}
                      className="w-full py-4 border border-teal-200 text-teal-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-teal-50 disabled:opacity-50 transition-all">
                <DocumentTextIcon className="w-4 h-4 inline mr-2" />
                {previewLoading ? 'Generating...' : 'Preview PDF'}
              </button>

              {!isPublished && (
                <button onClick={handlePublish} disabled={publishing || !canEdit}
                        className="w-full py-4 bg-zammsa-green text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-zammsa-green/20 hover:bg-zammsa-green-dark disabled:opacity-50 transition-all">
                  {publishing ? 'Publishing...' : 'Publish GPN'}
                </button>
              )}

              <button onClick={() => navigate(`/procurement-planning/${gpn.app}`)}
                      className="w-full py-3 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-all">
                View APP Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPNDetail;

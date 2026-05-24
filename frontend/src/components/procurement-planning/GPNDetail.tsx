import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { GeneralProcurementNotice } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
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

  // Form state for editable fields
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

  const handleTextareaChange = (field: string, value: string) => {
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

      const res = await procurementPlanningApi.gpn.update(id!, { content: contentUpdate });
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
      
      // Simulate email stats (in real app, this would come from backend)
      const emailStats = {
        count: 47,
        failed: 0,
      };

      const res = await procurementPlanningApi.gpn.publish(id!, targets, [], {}, emailStats);
      toast.success(res.message);
      
      const updatedGPN = await procurementPlanningApi.gpn.detail(id!);
      
      // Calculate ZPPA deadline info
      let zppaDeadline: string | undefined;
      let daysRemaining: number | undefined;
      if (updatedGPN.content?.zppa_deadline) {
        const deadline = new Date(updatedGPN.content.zppa_deadline);
        zppaDeadline = deadline.toLocaleDateString('en-ZM', { year: 'numeric', month: 'short', day: 'numeric' });
        const timeDiff = deadline.getTime() - Date.now();
        daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      }
      
      setPublicationSuccess({
        proofs: res.publication_proofs || {},
        zppaDeadline,
        daysRemaining: daysRemaining !== null && daysRemaining !== undefined && daysRemaining >= 0 ? daysRemaining : undefined,
      });
      
      setTimeout(() => {
        setPublicationSuccess(null);
      }, 30000);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to publish GPN');
    }
    setPublishing(false);
  };

  const generatePreview = async () => {
    setPreviewLoading(true);
    try {
      toast('PDF preview generation would be implemented here');
    } catch (err: any) {
      toast.error('Failed to generate preview');
    }
    setPreviewLoading(false);
  };

  useEffect(() => { loadGPN(); }, [id]);

  if (loading) return <div className="p-12"><LoadingSpinner size="lg" /></div>;
  if (!gpn) return <div className="p-12 text-center text-gray-500">GPN not found</div>;

  const lineItems = gpn.content?.line_items || [];
  const totalValue = lineItems.reduce((sum: number, item: any) => sum + (item.estimated_value || 0), 0);
  
  const zpcApprovedAt = gpn.content?.zpc_approved_at;
  const zpcApprovalDate = zpcApprovedAt ? new Date(zpcApprovedAt).toLocaleDateString('en-ZM', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }) : 'TBD';

  const canEdit = ['procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'].includes(user?.role || '');
  const isPublished = gpn.publication_status === 'published';

  // Publication Success State
  if (isPublished && publicationSuccess) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">General Procurement Notice</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                Published
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {gpn.content?.department || '-'} &mdash; FY {gpn.content?.fiscal_year || '-'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/procurement-planning/${gpn.app}`} className="text-sm text-teal-600 hover:text-teal-800 flex items-center gap-1">
              View APP <ArrowLeftIcon className="w-4 h-4 rotate-180" />
            </Link>
            <button onClick={() => navigate('/procurement-planning/gpns')} className="text-sm text-gray-500 hover:text-gray-700">
              &larr; Back to List
            </button>
          </div>
        </div>

        {/* Success Banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-green-800">GENERAL PROCUREMENT NOTICE PUBLISHED</h2>
              <p className="text-sm text-green-700 mt-1">
                <span className="font-medium">{gpn.content?.gpn_reference || 'GPN-XXXX-XXX-XXX'}</span> has been published to all selected channels.
              </p>
            </div>
          </div>
        </div>

        {/* Publication Proofs */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-gray-400" />
            Publication Proofs
          </h2>
          <div className="space-y-4">
            {Object.keys(publicationSuccess.proofs || {}).map((channel) => {
              const proof = publicationSuccess.proofs![channel];
              const channelConfig = PUBLICATION_TARGETS.find(t => t.key === channel) || { label: channel, description: '', icon: DocumentTextIcon };
              const ChannelIcon = channelConfig.icon;
              
              return (
                <div key={channel} className="border border-gray-200 rounded-lg p-4 hover:border-teal-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {channel === 'govt_gazette' && !proof.url ? (
                        <ClockIcon className="w-5 h-5 text-yellow-500" />
                      ) : (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{channelConfig.label}</p>
                        {proof.status === 'published' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            Published
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{channelConfig.description}</p>
                      
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" />
                          Published: {new Date(proof.timestamp).toLocaleString('en-ZM', { 
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
                             className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 hover:underline">
                            <ExternalLinkIcon className="w-4 h-4" />
                            {proof.url}
                          </a>
                        </div>
                      )}
                      
                      {channel === 'govt_gazette' && !proof.url && (
                        <div className="mt-3">
                          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                            <DownloadIcon className="w-4 h-4" />
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
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <ExclamationCircleIcon className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800">ZPPA Submission Tracking</h3>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-yellow-700">Submission Deadline:</span>
                    <span className="ml-2 font-medium text-gray-900">{publicationSuccess.zppaDeadline}</span>
                  </div>
                  <div>
                    <span className="text-yellow-700">Days Remaining:</span>
                    <span className={`ml-2 font-medium ${
                      publicationSuccess.daysRemaining! <= 3 
                        ? 'text-red-600' 
                        : publicationSuccess.daysRemaining! <= 7 
                        ? 'text-yellow-600' 
                        : 'text-green-600'
                    }`}>
                      {publicationSuccess.daysRemaining!} days
                    </span>
                  </div>
                </div>
                <p className="text-xs text-yellow-600 mt-2">
                  Reminder: Update ZPPA submission reference after submission
                </p>
                <div className="mt-3">
                  <button onClick={() => navigate(`/procurement-planning/${gpn.app}`)} 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-yellow-400 text-yellow-700 rounded-md hover:bg-yellow-100">
                    <RefreshIcon className="w-4 h-4" />
                    Update ZPPA Submission
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button onClick={generatePreview} disabled={previewLoading} 
                    className="inline-flex items-center gap-2 px-4 py-2 border border-teal-300 text-teal-700 rounded-lg text-sm hover:bg-teal-50 disabled:opacity-50">
              <DocumentTextIcon className="w-4 h-4" />
              {previewLoading ? 'Generating...' : 'Preview GPN PDF'}
            </button>
            <button onClick={() => navigate('/procurement-planning/gpns')} 
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              Back to GPN List
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Draft/Edit State
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/procurement-planning/${gpn.app}`)} 
                    className="text-sm text-teal-600 hover:text-teal-800 flex items-center gap-1">
              <ArrowLeftIcon className="w-4 h-4" />
              APP-{gpn.content?.department_code || 'XXX'}-{gpn.content?.fiscal_year || 'XXXX'}
            </button>
          </div>
          <div className="mt-2">
            <p className="font-semibold text-gray-900">{gpn.content?.department || 'Department Name'}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <UserCircleIcon className="w-3.5 h-3.5" />
              {user?.full_name || 'User'}
              <span className="mx-1">•</span>
              <BellIcon className="w-3.5 h-3.5" />
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            <span className="text-xs font-medium text-gray-600">Draft</span>
          </div>
        </div>
      </div>

      {/* Title Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">GENERAL PROCUREMENT NOTICE</h1>
          <div className="text-right text-sm text-gray-600 space-y-1">
            <div className="font-medium">{gpn.content?.gpn_reference || 'GPN-XXXX-XXX-XXX'}</div>
            <div>{gpn.content?.department || 'Laboratory Department'} — FY {gpn.content?.fiscal_year || '2026/2027'}</div>
            <div className="flex items-center justify-end gap-1.5 text-green-600">
              <CheckCircleIcon className="w-4 h-4" />
              <span>APP Approved by ZPC on {zpcApprovalDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* GPN Content Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <DocumentTextIcon className="w-5 h-5 text-gray-400" />
          GPN Content
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Contact Info and Notice */}
          <div className="space-y-6">
            {/* Issuing Authority */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Issuing Authority</p>
              <p className="text-sm font-medium text-gray-900">{formContent.issuing_authority}</p>
            </div>
            
            {/* Contact Information */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Contact Information</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-500 w-16 flex-shrink-0">Name:</span>
                  {!canEdit ? (
                    <p className="text-sm text-gray-900">{formContent.contact_name}</p>
                  ) : (
                    <input
                      value={formContent.contact_name || ''}
                      onChange={(e) => handleInputChange('contact_name', e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Enter contact name"
                    />
                  )}
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-500 w-16 flex-shrink-0">Email:</span>
                  {!canEdit ? (
                    <p className="text-sm text-gray-900">{formContent.contact_email}</p>
                  ) : (
                    <input
                      value={formContent.contact_email || ''}
                      onChange={(e) => handleInputChange('contact_email', e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Enter email address"
                    />
                  )}
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-500 w-16 flex-shrink-0">Phone:</span>
                  {!canEdit ? (
                    <p className="text-sm text-gray-900">{formContent.contact_phone}</p>
                  ) : (
                    <input
                      value={formContent.contact_phone || ''}
                      onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Enter phone number"
                    />
                  )}
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-500 w-16 flex-shrink-0">Address:</span>
                  {!canEdit ? (
                    <p className="text-sm text-gray-900">{formContent.contact_address}</p>
                  ) : (
                    <input
                      value={formContent.contact_address || ''}
                      onChange={(e) => handleInputChange('contact_address', e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Enter address"
                    />
                  )}
                </div>
              </div>
            </div>
            
            {/* Notice Heading */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Notice Heading</p>
              {!canEdit ? (
                <p className="text-sm text-gray-900">{formContent.notice_heading}</p>
              ) : (
                <input
                  value={formContent.notice_heading || ''}
                  onChange={(e) => handleInputChange('notice_heading', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter notice heading"
                />
              )}
            </div>
            
            {/* Notice Body */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Notice Body</p>
              {!canEdit ? (
                <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded p-3 border border-gray-200">
                  {formContent.notice_body}
                </div>
              ) : (
                <textarea
                  value={formContent.notice_body || ''}
                  onChange={(e) => handleTextareaChange('notice_body', e.target.value)}
                  rows={6}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  placeholder="Enter notice body text..."
                />
              )}
            </div>
          </div>
          
          {/* Right Column - Planned Procurements Table */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Planned Procurements Table</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value (K)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lineItems.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {Number(item.estimated_value).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {item.procurement_type_display || item.procurement_type || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-500">
                        {item.planned_issue_date 
                          ? new Date(item.planned_issue_date).toLocaleDateString('en-ZM', { month: 'short', year: 'numeric' }) 
                          : '-'
                        }
                      </td>
                    </tr>
                  ))}
                  {lineItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No planned procurements
                      </td>
                    </tr>
                  )}
                </tbody>
                {lineItems.length > 0 && (
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">Total</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                        {totalValue.toLocaleString()}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Publication Channels Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <GlobeIcon className="w-5 h-5 text-gray-400" />
          Publication Channels
        </h2>
        <div className="space-y-4">
          {PUBLICATION_TARGETS.map((channel) => {
            const ChannelIcon = channel.icon;
            const isChecked = (formContent.publication_targets || []).includes(channel.key);
            return (
              <div key={channel.key} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-teal-300 transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleTarget(channel.key)}
                    disabled={isPublished}
                    className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ChannelIcon className="w-5 h-5 text-gray-400" />
                    <p className="font-medium text-gray-900">{channel.label}</p>
                    {isChecked && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 ml-7">{channel.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ZPPA Submission Tracking Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <ExclamationCircleIcon className="w-5 h-5 text-gray-400" />
          ZPPA Submission Tracking
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">ZPC Approval Date</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{zpcApprovalDate}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">ZPPA Submission Deadline</p>
              {gpn.content?.zppa_deadline ? (
                <div>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {new Date(gpn.content.zppa_deadline).toLocaleDateString('en-ZM', { 
                      year: 'numeric', month: 'short', day: 'numeric' 
                    })}
                  </p>
                  {(() => {
                    const daysRemaining = Math.ceil((new Date(gpn.content.zppa_deadline).getTime() - Date.now()) / (1000 * 3600 * 24));
                    return (
                      <p className={`text-xs mt-1 font-medium ${
                        daysRemaining <= 3 ? 'text-red-600' : daysRemaining <= 7 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {daysRemaining} days remaining
                      </p>
                    );
                  })()}
                </div>
              ) : (
                <p className="mt-1 text-sm text-gray-400 italic">Not set</p>
              )}
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  ZPPA Submitted?
                  <span className={`ml-2 font-medium ${gpn.content?.zppa_submitted ? 'text-green-600' : 'text-gray-900'}`}>
                    {gpn.content?.zppa_submitted ? 'Yes' : 'No'}
                  </span>
                  {(gpn.content?.zppa_submitted && gpn.content?.zppa_submission_ref) && (
                    <span className="ml-2 text-xs text-gray-500">
                      Ref: {gpn.content.zppa_submission_ref}
                    </span>
                  )}
                </p>
              </div>
              {gpn.content?.zppa_submitted && (
                <button onClick={() => navigate(`/procurement-planning/${gpn.app}`)}
                        className="text-sm text-teal-600 hover:text-teal-800 flex items-center gap-1">
                  Update <ArrowLeftIcon className="w-4 h-4 rotate-180" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={generatePreview} disabled={previewLoading || isPublished} 
                  className="inline-flex items-center gap-2 px-4 py-2 border border-teal-300 text-teal-700 rounded-lg text-sm hover:bg-teal-50 disabled:opacity-50">
            <DocumentTextIcon className="w-4 h-4" />
            {previewLoading ? 'Generating...' : 'Preview GPN PDF'}
          </button>
          
          <button onClick={saveDraft} disabled={saving || isPublished} 
                  className="inline-flex items-center gap-2 px-4 py-2 border border-yellow-400 text-yellow-700 rounded-lg text-sm hover:bg-yellow-50 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          
          {!isPublished && (
            <button onClick={handlePublish} disabled={publishing || !canEdit} 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
              {publishing ? (
                <>
                  <LoadingSpinner size="sm" className="text-white" />
                  Publishing...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-4 h-4" />
                  Publish GPN
                </>
              )}
            </button>
          )}
          
          {!isPublished && (
            <button onClick={() => navigate(`/procurement-planning/${gpn.app}`)} 
                    className="inline-flex items-center gap-1 px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              View APP Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GPNDetail;
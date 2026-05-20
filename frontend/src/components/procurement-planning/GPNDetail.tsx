import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { GeneralProcurementNotice } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { BellIcon, CheckCircleIcon, ExclamationIcon } from '@heroicons/react/outline';

const PUBLICATION_TARGETS = [
  { key: 'zammsa_website', label: 'ZAMMSA Website', description: 'Auto-published immediately upon clicking Publish' },
  { key: 'egp_portal', label: 'e-GP Portal (ZPPA)', description: 'API call triggered automatically' },
  { key: 'registered_supplier_email', label: 'Registered Supplier Email Notifications', description: '47 registered suppliers in relevant categories will receive email notification' },
  { key: 'govt_gazette', label: 'Government Gazette', description: 'System generates Gazette-formatted file for upload (submitted manually to Government Printer)' },
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
    proofs: Record<string, { url: string; timestamp: string; delivered?: number; failed?: number }>;
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
      issuing_authority: content.issuing_authority || 'ZAMMSA \u2014 Zambia Medicines and Medical Supplies Agency',
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
      // Prepare content for update
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

      // Only update if we have actual changes or it's a new GPN
      const res = await procurementPlanningApi.gpn.update(id!, { content: contentUpdate });
      toast.success('Draft saved');
      setGpn(prev => prev ? { ...prev, content: { ...(prev?.content || {}), ...contentUpdate } } : null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save draft');
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    // Validate required fields
    if (!formContent.contact_name || !formContent.contact_email) {
      toast.error('Please fill in required contact information');
      return;
    }

    setPublishing(true);
    try {
      // First save the content
      await saveDraft();
      
      // Get selected publication targets
      const targets = formContent.publication_targets || ['zammsa_website'];
      const proofUrls: string[] = []; // Will be filled by backend after publishing
      
      // Publish the GPN
      const res = await procurementPlanningApi.gpn.publish(id!, targets, proofUrls);
      toast.success(res.message);
      
      // Fetch updated GPN to get publication proofs
      const updatedGPN = await procurementPlanningApi.gpn.detail(id!);
      
      // Calculate ZPPA deadline info
      let zppaDeadline: string | undefined;
      let daysRemaining: number | undefined;
      if (updatedGPN.content?.zppa_deadline) {
        const deadline = new Date(updatedGPN.content.zppa_deadline);
        zppaDeadline = deadline.toLocaleDateString();
        const timeDiff = deadline.getTime() - Date.now();
        daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      }
      
      // Set success state
      setPublicationSuccess({
        proofs: updatedGPN.content?.publication_proofs || {},
        zppaDeadline,
        daysRemaining: daysRemaining !== null && daysRemaining !== undefined && daysRemaining >= 0 ? daysRemaining : undefined,
      });
      
      // Clear success state after 30 seconds
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
      // In a real app, this would generate a PDF preview
      // For now, we'll just show a toast
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
  
  // Get ZPC approval date from GPN content
  const zpcApprovedAt = gpn.content?.zpc_approved_at;
  const zpcApprovalDate = zpcApprovedAt ? new Date(zpcApprovedAt).toLocaleDateString('en-ZM', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }) : 'TBD';

  // Determine if user can edit (procurement officer or similar roles)
  const canEdit = ['procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'].includes(user?.role || '');
  const isPublished = gpn.publication_status === 'published';

  if (isPublished && publicationSuccess) {
    // Publication Success State
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">General Procurement Notice</h1>
              <StatusBadge status="published" />
            </div>
            <p className="text-sm text-gray-500">
              {gpn.content?.department || '-'} &mdash; FY {gpn.content?.fiscal_year || '-'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/procurement-planning/${gpn.app}`} className="text-sm text-gray-500 hover:text-gray-700">
              View APP &rarr;
            </Link>
            <button onClick={() => navigate('/procurement-planning/gpns')} className="text-sm text-gray-500 hover:text-gray-700">
              &larr; Back to List
            </button>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">GENERAL PROCUREMENT NOTICE PUBLISHED</p>
              <p className="text-sm text-green-700">
                {gpn.content?.gpn_reference || 'GPN-XXXX-XXX-XXX'} has been published to all selected channels.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Publication Proofs</h2>
          <div className="space-y-4">
            {Object.keys(publicationSuccess.proofs || {}).map((channel) => {
              const proof = publicationSuccess.proofs![channel];
              const channelConfig = PUBLICATION_TARGETS.find(t => t.key === channel) || 
                { label: channel, description: '' };
              
              return (
                <div key={channel} className="border rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">{channelConfig.label}</p>
                      {channelConfig.description && <p className="text-sm text-gray-500">{channelConfig.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-600">Published:</p>
                        <p className="text-xs font-medium">{new Date(proof.timestamp || Date.now()).toLocaleString()}</p>
                      </div>
                      {proof.url && (
                        <div className="mt-2">
                          <a href={proof.url} target="_blank" rel="noopener noreferrer" 
                             className="text-sm text-zammsa-green hover:underline block truncate max-w-xs">
                            {proof.url}
                          </a>
                        </div>
                      )}
                      {proof.delivered !== undefined && proof.failed !== undefined && (
                        <p className="text-xs text-gray-600 mt-1">
                          {proof.delivered} delivered | {proof.failed} failed
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {publicationSuccess.zppaDeadline && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <ExclamationIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">ZPPA Submission Tracking</p>
                <p className="text-sm text-gray-500">Submission deadline: {publicationSuccess.zppaDeadline}</p>
                {publicationSuccess.daysRemaining !== undefined && (
                  <p className={`text-sm font-medium ${publicationSuccess.daysRemaining! <= 3 ? 'text-red-600' : publicationSuccess.daysRemaining! <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {publicationSuccess.daysRemaining!} days remaining
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Reminder: Update ZPPA submission reference after submission
                </p>
                <button onClick={() => navigate(`/procurement-planning/${gpn.app}`)} 
                        className="px-3 py-1.5 text-xs border border-indigo-300 text-indigo-600 rounded hover:bg-indigo-50">
                  Update ZPPA Submission
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={generatePreview} disabled={previewLoading} 
                    className="px-4 py-2 border border-teal-300 text-teal-600 rounded-lg text-sm hover:bg-teal-50">
              {previewLoading ? 'Generating...' : 'Preview GPN PDF'}
            </button>
            <button onClick={() => navigate('/procurement-planning/gpns')} 
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Back to GPN List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/procurement-planning/${gpn.app}`)} 
                    className="text-sm text-gray-500 hover:text-underline">
              &larr; APP-{gpn.content?.department_code || 'XXX'}-{gpn.content?.fiscal_year || 'XXXX'}-{gpn.content?.gpn_reference?.split('-').pop() || '001'}
            </button>
            <div>
              <p className="font-semibold text-gray-900">{gpn.content?.department || 'Department Name'}</p>
              <p className="text-xs text-gray-400">
                {user?.full_name || 'User'} <span className="inline-flex items-center gap-1">
                  <BellIcon className="w-4 h-4 text-gray-500" />
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs bg-gray-100 rounded-full text-gray-600">
              Draft
            </span>
          </div>
        </div>
      </div>

      {/* Title Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">GENERAL PROCUREMENT NOTICE</h1>
          <div className="text-sm text-gray-600 space-y-1">
            <div>APP-{gpn.content?.department_code || 'XXX'}-{gpn.content?.fiscal_year || 'XXXX'}-{gpn.content?.gpn_reference?.split('-').pop() || '001'}</div>
            <div>{gpn.content?.department || 'Laboratory Department'} — FY {gpn.content?.fiscal_year || '2026/2027'}</div>
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-green-500" />
              <span>APP Approved by ZPC on {zpcApprovalDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* GPN Content Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">GPN Content</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Contact Info and Notice */}
          <div className="space-y-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <p className="font-medium text-gray-900 mb-2">Issuing Authority</p>
              <p className="text-sm font-medium">{formContent.issuing_authority}</p>
            </div>
            
            <div className="space-y-4">
              <p className="font-medium text-gray-900 mb-2">Contact Information</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <p className="text-xs text-gray-500 w-20">Name:</p>
                  {!canEdit ? (
                    <p className="text-sm">{formContent.contact_name}</p>
                  ) : (
                    <input
                      value={formContent.contact_name || ''}
                      onChange={(e) => handleInputChange('contact_name', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-zammsa-green"
                      placeholder="Enter contact name"
                    />
                  )}
                </div>
                <div className="flex items-start gap-3">
                  <p className="text-xs text-gray-500 w-20">Email:</p>
                  {!canEdit ? (
                    <p className="text-sm">{formContent.contact_email}</p>
                  ) : (
                    <input
                      value={formContent.contact_email || ''}
                      onChange={(e) => handleInputChange('contact_email', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-zammsa-green"
                      placeholder="Enter email address"
                    />
                  )}
                </div>
                <div className="flex items-start gap-3">
                  <p className="text-xs text-gray-500 w-20">Phone:</p>
                  {!canEdit ? (
                    <p className="text-sm">{formContent.contact_phone}</p>
                  ) : (
                    <input
                      value={formContent.contact_phone || ''}
                      onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-zammsa-green"
                      placeholder="Enter phone number"
                    />
                  )}
                </div>
                <div className="flex items-start gap-3">
                  <p className="text-xs text-gray-500 w-20">Address:</p>
                  {!canEdit ? (
                    <p className="text-sm">{formContent.contact_address}</p>
                  ) : (
                    <input
                      value={formContent.contact_address || ''}
                      onChange={(e) => handleInputChange('contact_address', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-zammsa-green"
                      placeholder="Enter address"
                    />
                  )}
                </div>
              </div>
            </div>
            
            {/* Notice Heading */}
            <div className="space-y-4">
              <p className="font-medium text-gray-900 mb-2">Notice Heading</p>
              {!canEdit ? (
                <p className="text-sm">{formContent.notice_heading}</p>
              ) : (
                <input
                  value={formContent.notice_heading || ''}
                  onChange={(e) => handleInputChange('notice_heading', e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-zammsa-green"
                  placeholder="Enter notice heading"
                />
              )}
            </div>
            
            {/* Notice Body */}
            <div className="space-y-4">
              <p className="font-medium text-gray-900 mb-2">Notice Body</p>
              {!canEdit ? (
                <p className="text-sm whitespace-pre-wrap">{formContent.notice_body}</p>
              ) : (
                <textarea
                  value={formContent.notice_body || ''}
                  onChange={(e) => handleTextareaChange('notice_body', e.target.value)}
                  rows={8}
                  className="border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-zammsa-green resize-none"
                  placeholder="Enter notice body text..."
                />
              )}
            </div>
          </div>
          
          {/* Right Column - Planned Procurements Table */}
          <div className="border rounded-lg p-4">
            <p className="font-medium text-gray-900 mb-3">PLANNED PROCUREMENTS TABLE</p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Value (K)</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Method</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Est. Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lineItems.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-left text-sm">{item.description}</td>
                      <td className="px-3 py-2 text-center text-sm font-medium">{Number(item.estimated_value).toLocaleString()}</td>
                      <td className="px-3 py-2 text-center text-sm">{item.procurement_type_display || item.procurement_type || '-'}</td>
                      <td className="px-3 py-2 text-center text-sm">{item.planned_issue_date ? new Date(item.planned_issue_date).toLocaleDateString('en-ZM', { month: 'short', year: 'numeric' }) : '-'}</td>
                    </tr>
                  ))}
                  {lineItems.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No planned procurements</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Publication Channels Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Publication Channels</h2>
        <div className="space-y-4">
          {PUBLICATION_TARGETS.map((channel) => (
            <div key={channel.key} className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={(formContent.publication_targets || []).includes(channel.key)}
                  onChange={() => toggleTarget(channel.key)}
                  disabled={isPublished}
                  className="rounded border-gray-300 text-zammsa-green"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{channel.label}</p>
                <p className="text-sm text-gray-500">{channel.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ZPPA Submission Tracking Section */}
      {(!isPublished || publicationSuccess) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">ZPPA Submission Tracking</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">ZPC Approval Date:</p>
                <p className="font-medium text-gray-900">{zpcApprovalDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">ZPPA Submission Deadline:</p>
                {gpn.content?.zppa_deadline ? (
                  <p className="font-medium text-gray-900">
                    {new Date(gpn.content.zppa_deadline).toLocaleDateString('en-ZM')}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic">Not set</p>
                )}
              </div>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500">
                ZPPA Submitted? 
                <span className="ml-2 font-medium">
                  {gpn.content?.zppa_submitted ? 'Yes' : 'No'}
                </span>
                {(gpn.content?.zppa_submitted && gpn.content?.zppa_submission_ref) && (
                  <span className="ml-2 text-xs text-gray-600">Ref: {gpn.content.zppa_submission_ref}</span>
                )}
              </p>
              <div className="mt-2">
                <p className="text-xs text-gray-500">
                  (Update after submission via the "Update ZPPA Submission" button in success state)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={generatePreview} disabled={previewLoading || isPublished} 
                  className="px-4 py-2 border border-teal-300 text-teal-600 rounded-lg text-sm hover:bg-teal-50 disabled:opacity-50">
            {previewLoading ? 'Generating...' : 'Preview GPN PDF'}
          </button>
          
          <button onClick={saveDraft} disabled={saving || isPublished} 
                  className="px-4 py-2 border border-yellow-400 text-yellow-600 rounded-lg text-sm hover:bg-yellow-50 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          
          {!isPublished && (
            <button onClick={handlePublish} disabled={publishing || !canEdit} 
                    className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark disabled:opacity-50">
              {publishing ? 'Publishing...' : '🚀 Publish GPN'}
            </button>
          )}
          
          {isPublished && publicationSuccess && (
            <button onClick={() => navigate('/procurement-planning/gpns')} 
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Back to GPN List
            </button>
          )}
          
          {!isPublished && (
            <button onClick={() => navigate(`/procurement-planning/${gpn.app}`)} 
                    className="px-4 py-2 text-sm text-gray-500 hover:text-underline">
              View APP Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GPNDetail;

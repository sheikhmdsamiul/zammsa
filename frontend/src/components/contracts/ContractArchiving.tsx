import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  ArchiveIcon, CheckCircleIcon, ClockIcon,
  ShieldCheckIcon, LockClosedIcon, ExclamationIcon,
} from '@heroicons/react/outline';

const documentCategories = [
  {
    name: 'Planning Documents',
    items: ['APP-2026-LAB-001', 'GPN-2026-LAB-001', 'CPP-2026-LAB-07'],
  },
  {
    name: 'Requisition',
    items: ['REQ-2026-LAB-041 (all versions + approvals)', 'Specification documents (2 files)', 'Budget encumbrance records'],
  },
  {
    name: 'Solicitation',
    items: ['SOL-2026-LAB-07 (final published PDF)', 'Addendum No.1', 'Clarification Q&A log', 'Publication proofs (3 channels)'],
  },
  {
    name: 'Bidding',
    items: ['All 6 bid submissions (sealed records)', '1 late bid (auto-rejected — record kept)', 'Bid opening minutes (digitally signed)', 'All bid security documents'],
  },
  {
    name: 'Evaluation',
    items: ['COI declarations (4 members)', 'Individual technical scores (4 members × 5 bids)', 'Preliminary examination records', 'Consolidated scores and rankings', 'Financial evaluation with preference calculations', 'Post-qualification verification records', 'BER (Bid Evaluation Report — signed PDF)', 'ZPC BER approval minutes'],
  },
  {
    name: 'Contract',
    items: ['Contract Award Notice (published)', 'Standstill period log (no appeals)', 'Executed contract (both signatures, PKI verified)', 'Performance security document', 'Contract Amendment AMD-01 (time extension)'],
  },
  {
    name: 'Execution & Payment',
    items: ['GRN-2026-CMS-3041 (main delivery)', 'GRN-2026-CMS-3055 (2 remaining CD4 kits)', 'Invoice INV-LRL-2026-078 + INV-LRL-2026-082', '3-way match records and discrepancy log', 'Payment files PAY-2026-LAB-0892 + 0893', 'Bank confirmations (webhooks received)', 'Liquidated damages record: K5,775', 'Retention payment record: K57,750', 'Performance security release letter'],
  },
  {
    name: 'Closure',
    items: ['Supplier performance evaluation: 87.25/100', 'Contract closure checklist (all 11 items signed off)'],
  },
  {
    name: 'Audit Logs',
    items: ['Complete audit trail', 'Login records for all users involved', 'All email notifications sent/received', 'All API calls (ERP, WMS, ZRA, PACRA, CEEC, Bank, ZPPA)'],
  },
];

const ContractArchiving: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(false);

  const archiveMutation = useMutation({
    mutationFn: () => contractsApi.archive(id!),
    onSuccess: () => {
      setArchived(true);
      toast.success('Contract archived successfully');
    },
    onError: () => toast.error('Failed to archive contract'),
  });

  if (archived) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <ArchiveIcon className="w-16 h-16 text-zammsa-green mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Archive Created Successfully</h2>
          <div className="max-w-md mx-auto bg-gray-50 rounded-xl p-6 text-left mb-8 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Archive File</span><span className="font-medium">ZAMMSA-CON-2026-LAB-11-ARCHIVE.zip.enc</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Encryption</span><span className="font-medium">AES-256</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Documents</span><span className="font-medium">54 files</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Compressed Size</span><span className="font-medium">124MB</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Checksum (SHA256)</span><span className="font-medium text-xs font-mono">a3f8b2c9...</span></div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between"><span className="text-gray-500">Retention Period</span><span className="font-medium">7 years</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Expiry Date</span><span className="font-medium">05 Dec 2033</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Legal Hold</span><span className="font-medium">None</span></div>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/contracts')} className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold">View Contracts</button>
            <button onClick={() => navigate('/contracts')} className="px-6 py-3 bg-white border border-gray-300 rounded-xl font-bold">View Archive Summary</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Automated Archiving</h1>
            <StatusBadge status="active" />
          </div>
          <p className="text-sm text-gray-500 mt-1">CON-2026-LAB-11 | Triggered: 05 Dec 2026 | System Automated Job</p>
        </div>
        {!archiving && !archived && (
          <button onClick={() => { setArchiving(true); archiveMutation.mutate(); }} disabled={archiveMutation.isPending}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold flex items-center gap-2">
            <ArchiveIcon className="w-5 h-5" />
            {archiveMutation.isPending ? 'Archiving...' : 'Archive Contract'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {documentCategories.map((cat) => (
          <div key={cat.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheckIcon className="w-5 h-5 text-zammsa-green" />
              <h2 className="text-lg font-semibold text-gray-900">{cat.name}</h2>
              <span className="text-xs text-gray-400 ml-auto">{cat.items.length} files</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {cat.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <LockClosedIcon className="w-6 h-6 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Active Database Updated</p>
            <ul className="text-sm text-gray-600 mt-2 space-y-1">
              <li>✅ Original records marked as "Archived" (metadata only)</li>
              <li>✅ Full content removed from active DB (in archive only)</li>
              <li>✅ Archive event logged in permanent audit trail</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <ClockIcon className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Retention Schedule</p>
            <p className="text-sm text-amber-800 mt-1">Retention Period: 7 years | Expiry: 05 Dec 2033</p>
            <p className="text-sm text-amber-700 mt-1">90-day alert will be sent before expiry to records.manager@zammsa.gov.zm</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractArchiving;

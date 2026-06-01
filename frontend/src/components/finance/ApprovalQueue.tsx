import React, { useState, useEffect } from 'react';
import { financeApi } from '../../api/finance';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

interface QueueItem {
  id: string;
  invoiceNumber: string;
  contractNumber: string;
  supplierName: string;
  amount: number;
  status: string;
  submittedAt: string | null;
  approvalRoute: string | null;
}

const ApprovalQueue: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQueue = async () => {
      try {
        const response = await financeApi.listInvoices({ status: 'pending_approval' });
        const records = (response.results || []).map((inv: any) => ({
          id: inv.invoice_id || inv.id,
          invoiceNumber: inv.invoice_number || 'N/A',
          contractNumber: inv.contract_number || 'Unknown',
          supplierName: inv.supplier_name || 'Unknown',
          amount: inv.amount || 0,
          status: inv.status || 'pending_approval',
          submittedAt: inv.submitted_at,
          approvalRoute: inv.approval_route || 'finance_officer',
        }));
        setQueue(records);
      } catch (error) {
        console.error('Error loading approval queue:', error);
        toast.error('Failed to load approval queue');
      } finally {
        setLoading(false);
      }
    };
    
    loadQueue();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await financeApi.approveInvoice(id);
      toast.success('Invoice approved');
      setQueue(prev => prev.filter(item => item.id !== id));
    } catch {
      toast.error('Failed to approve invoice');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await financeApi.rejectInvoice(id, reason);
      toast.success('Invoice rejected');
      setQueue(prev => prev.filter(item => item.id !== id));
    } catch {
      toast.error('Failed to reject invoice');
    }
  };

  if (loading) return <LoadingSpinner className="py-12" />;

  if (!queue.length) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No pending approvals</h2>
        <p className="mt-2 text-gray-500">All invoices have been approved.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Approval Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve invoices pending payment approval
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold">
            {queue.length} Pending
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Invoice</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Contract</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Supplier</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Amount</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Submitted</th>
                <th className="px-6 py-3 text-center font-bold text-gray-500 text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {queue.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{item.invoiceNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{item.contractNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{item.supplierName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'ZMW' }).format(item.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('en-GB') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="inline-flex items-center gap-1 px-4 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 border border-emerald-200"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReject(item.id)}
                        className="inline-flex items-center gap-1 px-4 py-1.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg hover:bg-rose-100 border border-rose-200"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApprovalQueue;

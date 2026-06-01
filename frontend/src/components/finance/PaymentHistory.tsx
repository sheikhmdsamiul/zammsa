import React, { useState, useEffect } from 'react';
import { financeApi } from '../../api/finance';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

interface PaymentRecord {
  id: string;
  paymentId: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: string;
  status: string;
  processedAt: string | null;
  reference: string;
  vendor: string;
}

const PaymentHistory: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const response = await financeApi.listPayments({});
        const records = (response.results || []).map((p: any) => ({
          id: p.payment_id || p.id,
          paymentId: p.payment_id || p.id,
          invoiceNumber: p.invoice?.invoice_number || 'N/A',
          amount: p.amount || 0,
          paymentMethod: p.payment_method || 'electronic',
          status: p.status || 'pending',
          processedAt: p.processed_at,
          reference: p.reference || 'N/A',
          vendor: p.vendor || 'Unknown',
        }));
        setPayments(records);
      } catch (error) {
        console.error('Error loading payments:', error);
        toast.error('Failed to load payment history');
      } finally {
        setLoading(false);
      }
    };
    
    loadPayments();
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-50 text-emerald-700';
      case 'sent': return 'bg-blue-50 text-blue-700';
      case 'processing': return 'bg-amber-50 text-amber-700';
      case 'failed': return 'bg-rose-50 text-rose-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  if (loading) return <LoadingSpinner className="py-12" />;

  if (!payments.length) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No payment records yet</h2>
        <p className="mt-2 text-gray-500">Payments will appear here after invoices are approved.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track all payments processed to vendors
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold">
            {payments.reduce((s, p) => s + p.amount, 0).toLocaleString()} ZMW Total
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Invoice</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Vendor</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Amount</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Method</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Reference</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Date</th>
                <th className="px-6 py-3 text-center font-bold text-gray-500 text-[10px] uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{p.invoiceNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{p.vendor}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'ZMW' }).format(p.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700 capitalize">{p.paymentMethod}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-mono text-xs">{p.reference}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {p.processedAt ? new Date(p.processedAt).toLocaleDateString('en-GB') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusColor(p.status)}`}>
                      {p.status}
                    </span>
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

export default PaymentHistory;

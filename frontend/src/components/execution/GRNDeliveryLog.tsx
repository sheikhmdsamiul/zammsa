import React, { useState, useEffect } from 'react';
import { financeApi } from '../../api/finance';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

interface GRNRecord {
  id: string;
  grnNumber: string;
  contractNumber: string;
  poNumber: string;
  itemDescription: string;
  quantityReceived: number;
  unitPrice: number;
  totalAmount: number;
  receivedDate: string;
  receivedBy: string;
}

const GRNDeliveryLog: React.FC = () => {
  const [grns, setGrns] = useState<GRNRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGrns = async () => {
      try {
        const response = await financeApi.listGrns({});
        const records = (response.results || []).map((g: any) => ({
          id: g.grn_id || g.id,
          grnNumber: g.grn_number || 'N/A',
          contractNumber: g.contract?.contract_number || 'Unknown',
          poNumber: g.po_number || 'N/A',
          itemDescription: g.item_description || 'Unknown',
          quantityReceived: g.quantity_received || 0,
          unitPrice: g.unit_price || 0,
          totalAmount: g.total_amount || 0,
          receivedDate: g.received_date,
          receivedBy: g.received_by || 'System',
        }));
        setGrns(records);
      } catch (error) {
        console.error('Error loading GRNs:', error);
        toast.error('Failed to load goods receipt notes');
      } finally {
        setLoading(false);
      }
    };
    
    loadGrns();
  }, []);

  if (loading) return <LoadingSpinner className="py-12" />;

  if (!grns.length) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">No GRNs recorded</h2>
        <p className="mt-2 text-gray-500">Goods receipt notes will appear here after delivery verification.</p>
      </div>
    );
  }

  const totalAmount = grns.reduce((sum, g) => sum + g.totalAmount, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GRN & Delivery Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track goods received and manage delivery confirmation
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            Total GRNs: {grns.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            Total Value: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'ZMW' }).format(totalAmount)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{grns.length}</p>
          <p className="text-xs text-gray-500">Total GRNs</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'ZMW' }).format(totalAmount)}
          </p>
          <p className="text-xs text-gray-500">Total Value Received</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat().format(Math.round(grns.reduce((sum, g) => sum + g.quantityReceived, 0) / grns.length || 0))}
          </p>
          <p className="text-xs text-gray-500">Avg Quantity per GRN</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">GRN #</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Contract</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">PO #</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Item</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Received</th>
                <th className="px-6 py-3 text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">Quantity</th>
                <th className="px-6 py-3 text-right font-bold text-gray-500 text-[10px] uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grns.map((grn) => (
                <tr key={grn.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{grn.grnNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{grn.contractNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{grn.poNumber}</td>
                  <td className="px-6 py-4 text-gray-700 truncate max-w-xs">{grn.itemDescription}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {new Date(grn.receivedDate).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">{Math.round(grn.quantityReceived)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'ZMW' }).format(grn.totalAmount)}
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

export default GRNDeliveryLog;

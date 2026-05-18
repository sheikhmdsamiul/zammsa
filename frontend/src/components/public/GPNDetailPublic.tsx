import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { LoadingSpinner } from '../common/LoadingSpinner';

const GPNDetailPublic: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: gpn, isLoading } = useQuery({
    queryKey: ['public-gpn', id],
    queryFn: () => publicApi.getGPN(id!),
  });

  if (isLoading) return <div className="py-12"><LoadingSpinner /></div>;
  if (!gpn) return <div className="text-center py-20 text-gray-400">GPN not found.</div>;

  const lineItems = gpn.line_items || [];
  const totalValue = lineItems.reduce((sum: number, item: any) => sum + (item.estimated_value || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link to="/gpns" className="text-sm text-zammsa-green hover:underline">&larr; Back to GPNs</Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">General Procurement Notice</h1>
        <p className="text-gray-500 mt-1">{gpn.department} &mdash; FY {gpn.fiscal_year}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Department</p>
          <p className="text-sm font-medium">{gpn.department}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Fiscal Year</p>
          <p className="text-sm font-medium">{gpn.fiscal_year}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">Total Estimated Value</p>
          <p className="text-xl font-bold">ZMW {Number(totalValue).toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Line Items ({lineItems.length})</h2>
          <span className="text-sm text-gray-500">Total: ZMW {Number(totalValue).toLocaleString()}</span>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Value (ZMW)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Method</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Issue Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Award Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {lineItems.map((item: any, i: number) => (
              <tr key={i}>
                <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">{Number(item.estimated_value).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.recommended_method?.replace(/_/g, ' ') || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.planned_issue_date || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.planned_award_date || '-'}</td>
              </tr>
            ))}
            {lineItems.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No line items</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400">
        Published: {new Date(gpn.published_at).toLocaleString()}
      </div>
    </div>
  );
};

export default GPNDetailPublic;

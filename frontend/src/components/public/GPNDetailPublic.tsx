import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { DocumentTextIcon, PrinterIcon, ArrowLeftIcon } from '@heroicons/react/outline';

const METHOD_LABELS_SHORT: Record<string, string> = {
  open_tender: 'ONB',
  international: 'INT',
  limited: 'LIM',
  simplified: 'SIM',
  direct: 'Direct',
};

const GPNDetailPublic: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [showPDFPreview, setShowPDFPreview] = useState(false);

  const { data: gpn, isLoading } = useQuery({
    queryKey: ['public-gpn', id],
    queryFn: () => publicApi.getGPN(id!),
  });

  if (isLoading) return <div className="py-12"><LoadingSpinner /></div>;
  if (!gpn) return <div className="text-center py-20 text-gray-400">GPN not found.</div>;

  const lineItems = gpn.line_items || [];
  const totalValue = lineItems.reduce((sum: number, item: any) => sum + (item.estimated_value || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link to="/gpns" className="text-sm text-zammsa-green hover:underline flex items-center gap-1">
          <ArrowLeftIcon className="w-4 h-4" />
          Back to GPNs
        </Link>
        <div className="flex items-start justify-between mt-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">General Procurement Notice</h1>
            <p className="text-gray-500 mt-1">{gpn.department} &mdash; FY {gpn.fiscal_year}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={() => setShowPDFPreview(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-teal-600 text-teal-600 rounded-lg text-sm hover:bg-teal-50"
            >
              <DocumentTextIcon className="w-4 h-4" />
              View PDF
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark"
            >
              <PrinterIcon className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
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

      <div className="text-xs text-gray-400 print:hidden">
        Published: {new Date(gpn.published_at).toLocaleString()}
      </div>

      {/* PDF Preview Modal */}
      {showPDFPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">GPN PDF Preview</h3>
              <button onClick={() => setShowPDFPreview(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="border border-gray-300 rounded-lg p-8 bg-white shadow-sm">
                {/* Header */}
                <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
                  <h2 className="text-2xl font-bold text-gray-900">GENERAL PROCUREMENT NOTICE</h2>
                  <p className="text-lg text-gray-700 mt-2">
                    GENERAL PROCUREMENT NOTICE &mdash; {gpn.department} ANNUAL PROCUREMENT PLAN {gpn.fiscal_year}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Reference: GPN-{gpn.fiscal_year?.replace('/', '-')}-{gpn.department?.substring(0, 3).toUpperCase() || 'XXX'}</p>
                </div>

                {/* Issuing Authority */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-2">Issuing Authority</h4>
                  <p className="text-sm text-gray-700">ZAMMSA &mdash; Zambia Medicines and Medical Supplies Agency</p>
                </div>

                {/* Notice */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-2">Notice</h4>
                  <p className="text-sm text-gray-700">
                    The Zambia Medicines and Medical Supplies Agency (ZAMMSA) intends to procure the following goods and services 
                    during the financial year {gpn.fiscal_year} and invites eligible suppliers to register their interest.
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    Eligible suppliers are encouraged to register on the ZAMMSA Supplier Portal at: 
                    https://portal.zammsa.gov.zm/suppliers
                  </p>
                </div>

                {/* Contact Information */}
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <p><strong>Name:</strong> Director of Procurement</p>
                    <p><strong>Email:</strong> procurement@zammsa.gov.zm</p>
                    <p><strong>Phone:</strong> +260 211 123456</p>
                    <p><strong>Address:</strong> Plot 1, Government Road, Lusaka</p>
                  </div>
                </div>

                {/* Planned Procurements Table */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Planned Procurements</h4>
                  <table className="min-w-full border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">Description</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-medium">Estimated Value (ZMW)</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-medium">Method</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-medium">Est. Issue Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="border border-gray-300 px-3 py-2">{item.description}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right font-medium">
                            {Number(item.estimated_value).toLocaleString()}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {METHOD_LABELS_SHORT[item.recommended_method || ''] || item.recommended_method?.replace(/_/g, ' ') || '-'}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {item.planned_issue_date || '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td className="border border-gray-300 px-3 py-2" colSpan={1}>Total</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {Number(totalValue).toLocaleString()}
                        </td>
                        <td colSpan={2} className="border border-gray-300 px-3 py-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t border-gray-300">
                  <p>Issued by: ZAMMSA &mdash; Zambia Medicines and Medical Supplies Agency</p>
                  <p>Generated on: {new Date().toLocaleString('en-ZM')}</p>
                  <p className="mt-1">For more information, visit: https://portal.zammsa.gov.zm</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button 
                onClick={() => setShowPDFPreview(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 inline-flex items-center gap-2"
              >
                <PrinterIcon className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GPNDetailPublic;
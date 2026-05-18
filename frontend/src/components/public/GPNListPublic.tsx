import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import publicApi from '../../api/public';
import { LoadingSpinner } from '../common/LoadingSpinner';

const GPNListPublic: React.FC = () => {
  const [page, setPage] = useState(1);
  const [departmentFilter, setDepartmentFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public-gpns', departmentFilter],
    queryFn: () => publicApi.listGPNs({}),
  });

  const gpns = data?.results || [];
  const filtered = departmentFilter
    ? gpns.filter((g: any) => g.department.toLowerCase().includes(departmentFilter.toLowerCase()))
    : gpns;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">General Procurement Notices</h1>
        <p className="text-gray-500 mt-2">Published annual procurement plans</p>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={departmentFilter}
          onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
          placeholder="Filter by department..."
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="py-12"><LoadingSpinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No GPNs published yet.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((gpn: any) => (
            <Link
              key={gpn.gpn_id}
              to={`/gpns/${gpn.gpn_id}`}
              className="block bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Published</span>
                    <span className="text-xs text-gray-400">FY {gpn.fiscal_year}</span>
                  </div>
                  <h3 className="font-medium text-gray-900">{gpn.department}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {gpn.line_items_count} line items &middot; Total: ZMW {Number(gpn.total_estimated_value).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{new Date(gpn.published_at).toLocaleDateString()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default GPNListPublic;

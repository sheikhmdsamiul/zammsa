import React from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useRedux';
import { ClipboardListIcon, OfficeBuildingIcon, TrendingUpIcon } from '@heroicons/react/outline';
import { useQuery } from '@tanstack/react-query';
import { fetchVendorApplications, fetchVendors } from '../../api/admin';

const SupplierRelationsDashboard: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const { data: pendingApplications, isLoading: pendingLoading } = useQuery({
    queryKey: ['sr-dashboard-pending-applications'],
    queryFn: () => fetchVendorApplications({ status: 'submitted', page: 1, limit: 1 }),
  });
  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ['sr-dashboard-active-suppliers'],
    queryFn: () => fetchVendors({ status: 'active', page: 1, limit: 1 }),
  });
  const { data: approvedApplications, isLoading: approvedLoading } = useQuery({
    queryKey: ['sr-dashboard-approved-applications'],
    queryFn: () => fetchVendorApplications({ status: 'approved', page: 1, limit: 1 }),
  });

  const pendingCount = pendingApplications?.total ?? 0;
  const supplierCount = suppliers?.total ?? 0;
  const approvedCount = approvedApplications?.total ?? 0;

  const pendingDisplay = pendingLoading ? '...' : pendingCount.toLocaleString();
  const supplierDisplay = suppliersLoading ? '...' : supplierCount.toLocaleString();
  const approvedDisplay = approvedLoading ? '...' : approvedCount.toLocaleString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Supplier Relations Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome back, {user?.full_name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/supplier-relations/vendor-applications" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <p className="text-3xl font-bold text-zammsa-green">{pendingDisplay}</p>
          <p className="text-sm text-gray-500 mt-1">Pending Applications</p>
        </Link>
        <Link to="/supplier-relations/vendors" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <p className="text-3xl font-bold text-blue-600">{supplierDisplay}</p>
          <p className="text-sm text-gray-500 mt-1">Registered Suppliers</p>
        </Link>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-3xl font-bold text-zammsa-green">{approvedDisplay}</p>
          <p className="text-sm text-gray-500 mt-1">Approved Applications</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/supplier-relations/vendor-applications" className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700">
            <ClipboardListIcon className="h-5 w-5 text-zammsa-green" /> Review Vendor Applications
          </Link>
          <Link to="/supplier-relations/vendors" className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700">
            <OfficeBuildingIcon className="h-5 w-5 text-zammsa-green" /> Manage Suppliers
          </Link>
          <Link to="/supplier-relations/reports" className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700">
            <TrendingUpIcon className="h-5 w-5 text-zammsa-green" /> View Reports
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SupplierRelationsDashboard;

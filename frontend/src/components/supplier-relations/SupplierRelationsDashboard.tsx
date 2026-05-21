import React from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useRedux';
import { ClipboardListIcon, OfficeBuildingIcon, TrendingUpIcon, UserAddIcon, ShieldCheckIcon } from '@heroicons/react/outline';
import { useQuery } from '@tanstack/react-query';
import { fetchVendorApplications, fetchVendors } from '../../api/admin';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';

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

  return (
    <div className="pb-12">
      <PageHeader 
        title="Partner Relations"
        description={`Welcome back, ${user?.full_name}. Overseeing supplier registrations and compliance.`}
        actions={
          <Link to="/supplier-relations/vendor-applications" className="flex items-center gap-2 px-4 py-2 bg-zammsa-green text-white rounded-xl shadow-lg shadow-zammsa-green/20 text-xs font-bold uppercase tracking-widest hover:bg-zammsa-green-dark transition-all">
            <UserAddIcon className="w-4 h-4" />
            <span>New Applications</span>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard 
          label="Pending Review"
          value={pendingLoading ? '...' : pendingCount.toLocaleString()}
          icon={<ClipboardListIcon className="w-6 h-6" />}
          color="orange"
          description="Applications awaiting verification"
        />
        <StatCard 
          label="Active Suppliers"
          value={suppliersLoading ? '...' : supplierCount.toLocaleString()}
          icon={<OfficeBuildingIcon className="w-6 h-6" />}
          color="blue"
          description="Registered and verified partners"
        />
        <StatCard 
          label="Approved (YTD)"
          value={approvedLoading ? '...' : approvedCount.toLocaleString()}
          icon={<ShieldCheckIcon className="w-6 h-6" />}
          color="green"
          description="Successful registrations this year"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Quick Operations</h2>
          <TrendingUpIcon className="w-5 h-5 text-gray-200" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/supplier-relations/vendor-applications" className="group flex items-center gap-4 p-5 rounded-2xl bg-gray-50/50 border border-transparent hover:border-zammsa-green/30 hover:bg-white hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-zammsa-green group-hover:scale-110 transition-transform">
               <ClipboardListIcon className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm font-bold text-gray-800">Application Review</p>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Verify new vendors</p>
            </div>
          </Link>
          
          <Link to="/supplier-relations/vendors" className="group flex items-center gap-4 p-5 rounded-2xl bg-gray-50/50 border border-transparent hover:border-blue-300 hover:bg-white hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
               <OfficeBuildingIcon className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm font-bold text-gray-800">Partner Directory</p>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manage master data</p>
            </div>
          </Link>

          <Link to="/supplier-relations/reports" className="group flex items-center gap-4 p-5 rounded-2xl bg-gray-50/50 border border-transparent hover:border-purple-300 hover:bg-white hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
               <TrendingUpIcon className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm font-bold text-gray-800">Compliance Stats</p>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Growth & analytics</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SupplierRelationsDashboard;

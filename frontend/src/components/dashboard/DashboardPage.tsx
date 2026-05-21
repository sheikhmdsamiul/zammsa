import React from 'react';
import { useAppSelector } from '../../hooks/useRedux';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { ClipboardListIcon, CheckCircleIcon, DocumentIcon } from '@heroicons/react/outline';

const DashboardPage: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);

  return (
    <div className="pb-12">
      <PageHeader 
        title="Main Dashboard"
        description={`Welcome to the ZAMMSA Procurement Management System, ${user?.full_name}.`}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard 
          label="Total Procurements"
          value="--"
          icon={<DocumentIcon className="w-6 h-6" />}
          color="blue"
        />
        <StatCard 
          label="Pending Approvals"
          value="--"
          icon={<ClipboardListIcon className="w-6 h-6" />}
          color="orange"
        />
        <StatCard 
          label="Active Contracts"
          value="--"
          icon={<CheckCircleIcon className="w-6 h-6" />}
          color="green"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
         <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
               <ClipboardListIcon className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">No active data to display</h3>
            <p className="text-sm font-medium text-gray-500 leading-relaxed">
               Depending on your role, once procurement items are assigned or created, they will appear here in your overview.
            </p>
         </div>
      </div>
    </div>
  );
};

export default DashboardPage;

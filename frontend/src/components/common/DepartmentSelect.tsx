import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDepartments } from '../../api/admin';

interface Props {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

const DepartmentSelect: React.FC<Props> = ({ value, onChange, required, placeholder, className }) => {
  const { data: departments, isLoading, isError, error } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  if (isError) {
    console.error('Error loading departments:', error);
  }

  console.log('Departments data:', departments);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={className || 'w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green'}
    >
      <option value="">{placeholder || 'Select Department'}</option>
      {isLoading && <option disabled>Loading...</option>}
      {!isLoading && departments && departments.length === 0 && <option disabled>No departments available</option>}
      {!isLoading && departments?.length && departments?.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name} ({d.code})
        </option>
      ))}
    </select>
  );
};

export default DepartmentSelect;

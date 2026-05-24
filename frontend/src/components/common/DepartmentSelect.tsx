import React, { useMemo } from 'react';
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

  const selectedId = useMemo(() => {
    if (!departments || !value) return '';
    const byId = departments.find(d => d.id === value);
    if (byId) return value;
    const byName = departments.find(d => d.name === value);
    return byName?.id || '';
  }, [departments, value]);

  return (
    <select
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={className || 'w-full border-gray-300 rounded-lg px-3 py-2 focus:ring-zammsa-green focus:border-zammsa-green'}
    >
      <option value="">{placeholder || 'Select Department'}</option>
      {isLoading && <option disabled>Loading...</option>}
      {!isLoading && departments && departments.length === 0 && <option disabled>No departments available</option>}
      {!isLoading && departments?.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name} ({d.code})
        </option>
      ))}
    </select>
  );
};

export default DepartmentSelect;

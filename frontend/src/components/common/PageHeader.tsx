import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; path?: string }[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  breadcrumbs
}) => {
  return (
    <div className="mb-8">
      {breadcrumbs && (
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            {breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center">
                {i > 0 && <span className="mx-2 text-gray-400">/</span>}
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {crumb.label}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1.5 text-gray-500 font-medium">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

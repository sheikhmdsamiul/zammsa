import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

const ProtectedRoute: React.FC<Props> = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const normalizedRole = user?.role === 'zppa_reporter' ? 'zppa_reporting_officer' : user?.role;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(normalizedRole || '')) {
    const roleHomeByRole: Record<string, string> = {
      [ROLES.SUPPLIER_USER]: '/vendor/dashboard',
      [ROLES.SUPPLIER_RELATIONSHIP_MANAGER]: '/supplier-relations',
      [ROLES.SYSTEM_ADMIN]: '/admin',
      [ROLES.PUBLIC_PORTAL_VIEWER]: '/',
    };

    const fallbackPath = roleHomeByRole[normalizedRole || ''] || '/dashboard';

    // Hard-stop redirect loops. If user is already at their role home and still unauthorized,
    // send them to login instead of bouncing between routes.
    if (location.pathname === fallbackPath) {
      return <Navigate to="/login" replace />;
    }

    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

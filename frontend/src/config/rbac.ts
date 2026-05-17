export const ROLES = {
  SYSTEM_ADMIN: 'system_admin',
  DIRECTOR_PROCUREMENT: 'director_procurement',
  DIRECTOR_GENERAL: 'director_general',
  ZPC_MEMBER: 'zpc_member',
  PROCUREMENT_OFFICER: 'procurement_officer',
  PROCUREMENT_MANAGER: 'procurement_manager',
  FINANCE_OFFICER: 'finance_officer',
  BUDGET_CONTROLLER: 'budget_controller',
  DEPARTMENT_HEAD: 'department_head',
  USER_DEPT_STAFF: 'user_dept_staff',
  EVALUATION_COMMITTEE_MEMBER: 'evaluation_committee_member',
  EVALUATION_COMMITTEE_CHAIR: 'evaluation_committee_chair',
  CONTRACT_MANAGER: 'contract_manager',
  SUPPLIER_RELATIONSHIP_MANAGER: 'supplier_relationship_manager',
  SUPPLIER_USER: 'supplier_user',
  AUDITOR: 'auditor',
  ZPPA_REPORTING_OFFICER: 'zppa_reporting_officer',
  INTEGRATION_MANAGER: 'integration_manager',
  PUBLIC_PORTAL_VIEWER: 'public_portal_viewer',
} as const;

export const INTERNAL_PORTAL_ROLES = [
  ROLES.DIRECTOR_PROCUREMENT,
  ROLES.DIRECTOR_GENERAL,
  ROLES.ZPC_MEMBER,
  ROLES.PROCUREMENT_OFFICER,
  ROLES.PROCUREMENT_MANAGER,
  ROLES.FINANCE_OFFICER,
  ROLES.BUDGET_CONTROLLER,
  ROLES.DEPARTMENT_HEAD,
  ROLES.USER_DEPT_STAFF,
  ROLES.EVALUATION_COMMITTEE_MEMBER,
  ROLES.EVALUATION_COMMITTEE_CHAIR,
  ROLES.CONTRACT_MANAGER,
  ROLES.SUPPLIER_RELATIONSHIP_MANAGER,
  ROLES.AUDITOR,
  ROLES.ZPPA_REPORTING_OFFICER,
  ROLES.INTEGRATION_MANAGER,
] as const;

export const SUPPLIER_PORTAL_ROLES = [ROLES.SUPPLIER_USER] as const;
export const ADMIN_PANEL_ROLES = [ROLES.SYSTEM_ADMIN] as const;
export const AUDITOR_PANEL_ROLES = [ROLES.AUDITOR] as const;
export const PUBLIC_PORTAL_ROLES = [ROLES.PUBLIC_PORTAL_VIEWER] as const;

// Backward compatibility for existing imports/usages.
export const VENDOR_PORTAL_ROLES = SUPPLIER_PORTAL_ROLES;

export type RoleName =
  | typeof INTERNAL_PORTAL_ROLES[number]
  | typeof SUPPLIER_PORTAL_ROLES[number]
  | typeof ADMIN_PANEL_ROLES[number]
  | typeof AUDITOR_PANEL_ROLES[number]
  | typeof PUBLIC_PORTAL_ROLES[number];

export const hasAnyRole = (role: string | undefined, allowed: readonly string[]) =>
  !!role && allowed.includes(role);

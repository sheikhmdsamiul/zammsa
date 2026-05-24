import apiClient from './client';
import type {
  AdminDashboardData, Role, User, VendorApplication, SystemHealthData,
  AuditLogEntry, GovernanceSetting, ChangeRequest, IntegrationConfig,
  SystemSetting, Department, FiscalYear, BackupRecord, ScheduledReport,
  Commodity,
} from '../types';

const BASE = 'admin';

const mapPageParams = (params?: Record<string, any>) => {
  if (!params) return params;
  const mapped: Record<string, any> = { ...params };
  if (mapped.limit !== undefined) { mapped.page_size = mapped.limit; delete mapped.limit; }
  return mapped;
};

const paginated = <T>(r: any): { data: T[]; total: number } => ({
  data: r.data.results || r.data.data || r.data,
  total: r.data.count ?? r.data.total ?? (Array.isArray(r.data) ? r.data.length : 0),
});

export const fetchAdminDashboard = (): Promise<AdminDashboardData> =>
  apiClient.get(`${BASE}/dashboard/`).then((r) => r.data);

export const fetchUsers = (params: { search?: string; role?: string; status?: string; department?: string; page?: number; limit?: number }): Promise<{ data: User[]; total: number }> =>
  apiClient.get(`${BASE}/users/`, { params: mapPageParams(params) }).then(paginated<User>);

export const createUser = (data: Partial<User>): Promise<User> =>
  apiClient.post(`${BASE}/users/create/`, data).then((r) => r.data);

export const updateUser = (id: string, data: Partial<User>): Promise<User> =>
  apiClient.put(`${BASE}/users/${id}/`, data).then((r) => r.data);

export const resetUserPassword = (id: string): Promise<void> =>
  apiClient.post(`${BASE}/users/${id}/reset-password/`, {}).then((r) => r.data);

export const toggleUserStatus = (id: string): Promise<User> =>
  apiClient.post(`${BASE}/users/${id}/toggle-status/`, {}).then((r) => r.data);

export const fetchUserAuditHistory = (id: string): Promise<any[]> =>
  apiClient.get(`${BASE}/users/${id}/audit-history/`).then((r) => r.data);

export const fetchRoles = (): Promise<Role[]> =>
  apiClient.get(`${BASE}/roles/`).then((r) => r.data);

export const createRole = (data: Partial<Role>): Promise<Role> =>
  apiClient.post(`${BASE}/roles/create/`, data).then((r) => r.data);

export const updateRole = (id: string, data: Partial<Role>): Promise<Role> =>
  apiClient.put(`${BASE}/roles/${id}/`, data).then((r) => r.data);

export const deleteRole = (id: string): Promise<void> =>
  apiClient.delete(`${BASE}/roles/${id}/delete/`).then((r) => r.data);

export const updateRolePermissions = (id: string, permissions: Record<string, string[]>): Promise<Role> =>
  apiClient.put(`${BASE}/roles/${id}/permissions/`, { permissions }).then((r) => r.data);

export const fetchVendorApplications = (params: { search?: string; status?: string; page?: number; limit?: number }): Promise<{ data: VendorApplication[]; total: number }> =>
  apiClient.get('/suppliers/applications/', { params: mapPageParams(params) }).then(paginated<VendorApplication>);

export const fetchVendorApplicationDetail = (id: string): Promise<VendorApplication> =>
  apiClient.get(`/suppliers/applications/${id}/`).then((r) => r.data);

export const approveVendorApplication = (id: string): Promise<void> =>
  apiClient.post(`/suppliers/applications/${id}/review/`, { decision: 'approved' }).then((r) => r.data);

export const rejectVendorApplication = (id: string, reason: string): Promise<void> =>
  apiClient.post(`/suppliers/applications/${id}/review/`, { decision: 'rejected', rejection_reason: reason }).then((r) => r.data);

export const requestMoreInfo = (_id: string, _message: string): Promise<void> =>
  Promise.reject(new Error('Request more info not implemented on server'));

export const fetchVendors = (params: { search?: string; status?: string; ceec_category?: string; risk_level?: string; page?: number; limit?: number }): Promise<{ data: any[]; total: number }> =>
  apiClient.get('/suppliers/', { params: mapPageParams(params) }).then(paginated);

export const updateVendor = (id: string, data: any): Promise<any> =>
  apiClient.patch(`/suppliers/${id}/`, data).then((r) => r.data);

export const suspendVendor = (id: string, _reason: string): Promise<void> =>
  apiClient.delete(`/suppliers/${id}/`).then((r) => r.data);

export const fetchSystemHealth = (): Promise<SystemHealthData> =>
  apiClient.get(`${BASE}/system-health/`).then((r) => r.data);

export const runDiagnostics = (): Promise<any> =>
  apiClient.post(`${BASE}/system-health/diagnostics/`, {}).then((r) => r.data);

export const fetchAuditLogs = (params: { search?: string; action?: string; user?: string; module?: string; ip?: string; start_date?: string; end_date?: string; page?: number; limit?: number }): Promise<{ data: AuditLogEntry[]; total: number }> =>
  apiClient.get(`${BASE}/audit-logs/`, { params: mapPageParams(params) }).then(paginated<AuditLogEntry>);

export const fetchGovernanceSettings = (params?: { category?: string }): Promise<{ data: GovernanceSetting[]; total: number }> =>
  apiClient.get(`${BASE}/governance-settings/`, { params }).then((r) => {
    const body = r.data;
    return { data: body.results || body.data || body, total: body.count ?? body.total ?? (Array.isArray(body) ? body.length : 0) };
  });

export const requestChange = (data: { setting_id: string; new_value: string; reason: string }): Promise<ChangeRequest> =>
  apiClient.post(`${BASE}/governance-settings/request-change/`, data).then((r) => r.data);

export const approveChange = (id: string): Promise<void> =>
  apiClient.post(`${BASE}/change-requests/${id}/approve/`, {}).then((r) => r.data);

export const rejectChange = (id: string, reason: string): Promise<void> =>
  apiClient.post(`${BASE}/change-requests/${id}/reject/`, { reason }).then((r) => r.data);

export const fetchChangeRequests = (params?: { status?: string }): Promise<{ data: ChangeRequest[]; total: number }> =>
  apiClient.get(`${BASE}/change-requests/`, { params }).then((r) => {
    const body = r.data;
    return { data: body.results || body.data || body, total: body.count ?? body.total ?? (Array.isArray(body) ? body.length : 0) };
  });

export const fetchIntegrations = (): Promise<IntegrationConfig[]> =>
  apiClient.get(`${BASE}/integrations/`).then((r) => r.data);

export const testIntegration = (id: string): Promise<{ success: boolean; message: string }> =>
  apiClient.post(`${BASE}/integrations/${id}/test/`, {}).then((r) => r.data);

export const updateIntegration = (id: string, data: Partial<IntegrationConfig>): Promise<IntegrationConfig> =>
  apiClient.put(`${BASE}/integrations/${id}/`, data).then((r) => r.data);

export const generateApiKey = (id: string): Promise<{ api_key: string }> =>
  apiClient.post(`${BASE}/integrations/${id}/generate-key/`, {}).then((r) => r.data);

export const retryTransaction = (id: string): Promise<void> =>
  apiClient.post(`${BASE}/integrations/${id}/retry/`, {}).then((r) => r.data);

export const fetchSystemSettings = (category?: string): Promise<SystemSetting[]> =>
  apiClient.get(`${BASE}/system-settings/`, { params: { category } }).then((r) => r.data);

export const updateSystemSetting = (key: string, value: string): Promise<void> =>
  apiClient.put(`${BASE}/system-settings/${key}/`, { value }).then((r) => r.data);

export const uploadLogo = (file: File): Promise<{ url: string }> =>
  apiClient.post(`${BASE}/system-settings/logo/`, { file }).then((r) => r.data);

export const testEmail = (config: any): Promise<void> =>
  apiClient.post(`${BASE}/system-settings/test-email/`, config).then((r) => r.data);

export const fetchDepartments = (): Promise<Department[]> =>
  apiClient.get(`${BASE}/departments/`, { params: { page_size: 200 } }).then((r) => r.data?.results ?? r.data);

export const createDepartment = (data: Partial<Department>): Promise<Department> =>
  apiClient.post(`${BASE}/departments/create/`, data).then((r) => r.data);

export const updateDepartment = (id: string, data: Partial<Department>): Promise<Department> =>
  apiClient.put(`${BASE}/departments/${id}/`, data).then((r) => r.data);

export const deleteDepartment = (id: string): Promise<void> =>
  apiClient.delete(`${BASE}/departments/${id}/delete/`).then((r) => r.data);

export const reorderDepartments = (ids: string[]): Promise<void> =>
  apiClient.post(`${BASE}/departments/reorder/`, { ids }).then((r) => r.data);

export const fetchFiscalYears = (): Promise<FiscalYear[]> =>
  apiClient.get(`${BASE}/fiscal-years/`).then((r) => r.data);

export const createFiscalYear = (data: Partial<FiscalYear>): Promise<FiscalYear> =>
  apiClient.post(`${BASE}/fiscal-years/create/`, data).then((r) => r.data);

export const setCurrentFiscalYear = (id: string): Promise<void> =>
  apiClient.post(`${BASE}/fiscal-years/${id}/set-current/`, {}).then((r) => r.data);

export const closeFiscalYear = (id: string): Promise<void> =>
  apiClient.post(`${BASE}/fiscal-years/${id}/close/`, {}).then((r) => r.data);

export const fetchScheduledReports = (): Promise<ScheduledReport[]> =>
  apiClient.get(`${BASE}/reports/scheduled/`).then((r) => r.data);

export const generateReport = (type: string, params: any): Promise<{ url: string }> =>
  apiClient.post(`${BASE}/reports/generate/`, { type, ...params }).then((r) => r.data);

export const generateRecurringReport = (id: string, params: any): Promise<ScheduledReport> =>
  apiClient.post(`${BASE}/reports/scheduled/${id}/generate-now/`, params).then((r) => r.data);

export const fetchBackups = (): Promise<BackupRecord[]> =>
  apiClient.get(`${BASE}/backups/`).then((r) => r.data);

export const createBackup = (type: string): Promise<BackupRecord> =>
  apiClient.post(`${BASE}/backups/create/`, { type }).then((r) => r.data);

export const restoreBackup = (id: string): Promise<void> =>
  apiClient.post(`${BASE}/backups/${id}/restore/`, {}).then((r) => r.data);

export const updateBackupSchedule = (config: any): Promise<void> =>
  apiClient.put(`${BASE}/backups/schedule/`, config).then((r) => r.data);

export const fetchCommodities = (): Promise<Commodity[]> =>
  apiClient.get(`${BASE}/commodities/`).then((r) => r.data);

export const createCommodity = (data: Partial<Commodity>): Promise<void> =>
  apiClient.post(`${BASE}/commodities/create/`, data).then((r) => r.data);

export const updateCommodity = (id: string, data: Partial<Commodity>): Promise<void> =>
  apiClient.put(`${BASE}/commodities/${id}/`, data).then((r) => r.data);

export const deleteCommodity = (id: string): Promise<void> =>
  apiClient.delete(`${BASE}/commodities/${id}/delete/`).then((r) => r.data);

export const fetchBudgetAllocations = (): Promise<any[]> =>
  apiClient.get(`${BASE}/budget-allocations/`).then((r) => r.data);

export const createBudgetAllocation = (data: { entity_code: string; fiscal_year: string; allocated_amount: number }): Promise<any> =>
  apiClient.post(`${BASE}/budget-allocations/`, data).then((r) => r.data);

export const updateBudgetAllocation = (id: string, data: { allocated_amount: number }): Promise<any> =>
  apiClient.put(`${BASE}/budget-allocations/${id}/`, data).then((r) => r.data);

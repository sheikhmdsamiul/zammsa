import api from './client';
import { PaginatedResponse, UserNotification } from '../types';

export const notificationsApi = {
  list: (params?: {
    read?: boolean;
    page?: number;
    page_size?: number;
    notification_type?: string;
    priority?: string;
    search?: string;
  }) =>
    api.get<PaginatedResponse<UserNotification> & { unread_count: number }>('/system-config/notifications/', { params }).then((r) => r.data),

  summary: () =>
    api.get<{
      unread_count: number;
      total_count: number;
      urgent_count: number;
      failed_delivery_count: number;
      pending_delivery_count: number;
    }>('/system-config/notifications/summary/').then((r) => r.data),

  markRead: (id: string) =>
    api.post<UserNotification>(`/system-config/notifications/${id}/mark-read/`).then((r) => r.data),

  markAllRead: () =>
    api.post<{ message: string; updated: number }>('/system-config/notifications/mark-all-read/').then((r) => r.data),
};

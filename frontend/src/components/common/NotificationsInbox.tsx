import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  MailIcon,
  SearchIcon,
} from '@heroicons/react/outline';
import { notificationsApi } from '../../api/notifications';
import { UserNotification } from '../../types';

const priorityClasses: Record<string, string> = {
  urgent: 'bg-rose-50 text-rose-700 border-rose-100',
  high: 'bg-amber-50 text-amber-700 border-amber-100',
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  low: 'bg-slate-50 text-slate-600 border-slate-100',
};

const statusClasses: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  failed: 'bg-rose-50 text-rose-700 border-rose-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  skipped: 'bg-slate-50 text-slate-600 border-slate-100',
  not_required: 'bg-slate-50 text-slate-500 border-slate-100',
};

function formatDate(value?: string | null) {
  if (!value) return 'Not sent';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DeliveryPill({ label, status }: { label: string; status?: string }) {
  if (!status || status === 'not_required') return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${statusClasses[status] || statusClasses.not_required}`}>
      {label}: {status.replace(/_/g, ' ')}
    </span>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
  onDelete,
  marking,
  deleting,
}: {
  notification: UserNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  marking: boolean;
  deleting: boolean;
}) {
  const hasDeliveryIssue = notification.email_status === 'failed' || notification.sms_status === 'failed';
  const content = (
    <div className="flex items-start gap-4 min-w-0">
      <div className={`mt-1 h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${notification.read ? 'bg-slate-100 text-slate-500' : 'bg-zammsa-green/10 text-zammsa-green'}`}>
        <BellIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">{notification.title}</h3>
          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${priorityClasses[notification.priority] || priorityClasses.normal}`}>
            {notification.priority}
          </span>
          {!notification.read && (
            <span className="px-2 py-0.5 rounded border border-zammsa-green/10 bg-zammsa-green/10 text-[10px] font-bold uppercase text-zammsa-green">
              unread
            </span>
          )}
          {hasDeliveryIssue && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-rose-100 bg-rose-50 text-[10px] font-bold uppercase text-rose-700">
              <ExclamationCircleIcon className="h-3 w-3" />
              delivery failed
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span>{formatDate(notification.created_at)}</span>
          {notification.source_module && <span className="font-semibold uppercase tracking-wide">{notification.source_module.replace(/_/g, ' ')}</span>}
          {(notification.delivery_channels || []).map((channel) => (
            <span key={channel} className="px-2 py-0.5 rounded border border-slate-100 bg-slate-50 font-bold uppercase">
              {channel.replace(/_/g, ' ')}
            </span>
          ))}
          <DeliveryPill label="Email" status={notification.email_status} />
          <DeliveryPill label="SMS" status={notification.sms_status} />
        </div>
        {(notification.email_last_error || notification.sms_last_error) && (
          <div className="mt-3 rounded border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {notification.email_last_error || notification.sms_last_error}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`border-b border-slate-100 px-4 py-4 ${notification.read ? 'bg-white' : 'bg-emerald-50/20'}`}>
      <div className="flex items-start gap-4">
        {notification.action_url ? (
          <Link to={notification.action_url} className="min-w-0 flex-1 hover:opacity-90">
            {content}
          </Link>
        ) : (
          <div className="min-w-0 flex-1">{content}</div>
        )}
        {!notification.read && (
          <button
            type="button"
            onClick={() => onMarkRead(notification.id)}
            disabled={marking}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:text-zammsa-green hover:border-zammsa-green/30 disabled:opacity-50"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Read
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(notification.id)}
          disabled={deleting}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:text-rose-500 hover:border-rose-200 disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

const NotificationsInbox: React.FC = () => {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [read, setRead] = useState<'all' | 'unread' | 'read'>('all');
  const [type, setType] = useState('all');
  const [priority, setPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  const params = useMemo(() => ({
    page,
    page_size: 15,
    read: read === 'all' ? undefined : read === 'read',
    notification_type: type === 'all' ? undefined : type,
    priority: priority === 'all' ? undefined : priority,
    search: submittedSearch || undefined,
  }), [page, priority, read, submittedSearch, type]);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'inbox', params],
    queryFn: () => notificationsApi.list(params),
  });

  const { data: summary } = useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: () => notificationsApi.summary(),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteNotif = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const clearAll = useMutation({
    mutationFn: () => notificationsApi.clearAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.results || [];

  const resetPage = (callback: () => void) => {
    callback();
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">Workflow alerts, reminders, delivery status, and system notices.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={!summary?.unread_count || markAll.isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-zammsa-green text-sm font-bold text-white hover:bg-zammsa-green-dark disabled:bg-slate-300"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Mark all read
          </button>
          <button
            type="button"
            onClick={() => clearAll.mutate()}
            disabled={!summary?.total_count || summary?.unread_count === summary?.total_count || clearAll.isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded border border-rose-200 bg-white text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:bg-slate-100 disabled:text-slate-300 disabled:border-slate-200"
          >
            Clear read
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Unread', summary?.unread_count || 0],
          ['Total', summary?.total_count || 0],
          ['Urgent', summary?.urgent_count || 0],
          ['Failed delivery', summary?.failed_delivery_count || 0],
          ['Pending delivery', summary?.pending_delivery_count || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[1fr_160px_160px_160px]">
          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
              resetPage(() => setSubmittedSearch(search.trim()));
            }}
          >
            <SearchIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notifications"
              className="w-full rounded border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green"
            />
          </form>
          <select
            value={read}
            onChange={(event) => resetPage(() => setRead(event.target.value as 'all' | 'unread' | 'read'))}
            className="rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green"
          >
            <option value="all">All status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
          <select
            value={type}
            onChange={(event) => resetPage(() => setType(event.target.value))}
            className="rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green"
          >
            <option value="all">All types</option>
            <option value="workflow">Workflow</option>
            <option value="approval">Approval</option>
            <option value="deadline">Deadline</option>
            <option value="compliance">Compliance</option>
            <option value="system">System</option>
            <option value="supplier">Supplier</option>
            <option value="finance">Finance</option>
          </select>
          <select
            value={priority}
            onChange={(event) => resetPage(() => setPriority(event.target.value))}
            className="rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-zammsa-green focus:ring-1 focus:ring-zammsa-green"
          >
            <option value="all">All priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MailIcon className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No notifications found</p>
            <p className="mt-1 text-xs text-slate-500">Try adjusting the filters or search text.</p>
          </div>
        ) : (
          <div>
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onMarkRead={(id) => markRead.mutate(id)}
                onDelete={(id) => deleteNotif.mutate(id)}
                marking={markRead.isPending}
                deleting={deleteNotif.isPending}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            Page {data?.page || page} of {data?.total_pages || 1}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={!data?.previous}
              className="px-3 py-1.5 rounded border border-slate-200 text-xs font-bold text-slate-600 disabled:text-slate-300"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={!data?.next}
              className="px-3 py-1.5 rounded border border-slate-200 text-xs font-bold text-slate-600 disabled:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsInbox;

import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { BellIcon, CheckIcon } from '@heroicons/react/outline';
import { notificationsApi } from '../../api/notifications';

const priorityClasses: Record<string, string> = {
  urgent: 'bg-rose-50 text-rose-700 border-rose-100',
  high: 'bg-amber-50 text-amber-700 border-amber-100',
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  low: 'bg-slate-50 text-slate-600 border-slate-100',
};

function timeLabel(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString('en-GB');
}

const NotificationBell: React.FC = () => {
  const qc = useQueryClient();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => notificationsApi.list({ page_size: 8 }),
    refetchInterval: 60000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const notifications = data?.results || [];
  const unreadCount = data?.unread_count || notifications.filter((n) => !n.read).length;
  const inboxPath = location.pathname.startsWith('/admin')
    ? '/admin/notifications'
    : location.pathname.startsWith('/vendor')
      ? '/vendor/notifications'
      : location.pathname.startsWith('/supplier-relations')
        ? '/supplier-relations/notifications'
        : '/notifications';

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative p-2 text-slate-400 hover:text-zammsa-green hover:bg-slate-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[360px] max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Notifications</p>
              <p className="text-[11px] text-slate-500">{unreadCount} unread</p>
            </div>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={!unreadCount || markAll.isPending}
              className="text-xs font-semibold text-zammsa-green disabled:text-slate-300"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">No notifications yet.</div>
            ) : notifications.map((notification) => {
              const content = (
                <div className={`px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${notification.read ? '' : 'bg-emerald-50/30'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${priorityClasses[notification.priority] || priorityClasses.normal}`}>
                      {notification.priority}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 leading-snug">{notification.title}</p>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{notification.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <p className="text-[11px] text-slate-400 mr-1">{timeLabel(notification.created_at)}</p>
                        {(notification.delivery_channels || []).filter((channel) => channel !== 'in_app').map((channel) => (
                          <span key={channel} className="px-1.5 py-0.5 rounded border border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                            {channel}
                          </span>
                        ))}
                        {(notification.email_status === 'failed' || notification.sms_status === 'failed') && (
                          <span className="px-1.5 py-0.5 rounded border border-rose-100 bg-rose-50 text-[10px] font-semibold uppercase text-rose-600">
                            delivery failed
                          </span>
                        )}
                      </div>
                    </div>
                    {!notification.read && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          markRead.mutate(notification.id);
                        }}
                        className="p-1 text-slate-400 hover:text-zammsa-green rounded"
                        aria-label="Mark notification as read"
                      >
                        <CheckIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );

              return notification.action_url ? (
                <Link
                  key={notification.id}
                  to={notification.action_url}
                  onClick={() => {
                    if (!notification.read) markRead.mutate(notification.id);
                    setOpen(false);
                  }}
                  className="block"
                >
                  {content}
                </Link>
              ) : (
                <div key={notification.id}>{content}</div>
              );
            })}
          </div>
          <Link
            to={inboxPath}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-xs font-bold text-zammsa-green hover:bg-slate-50 border-t border-slate-100"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

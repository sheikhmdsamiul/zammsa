import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import publicApi from '../../api/public';

function fmtDateTime(d: string | undefined): string {
  if (!d) return '---';
  try {
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return '---';
  return `ZMW ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; pulse: boolean }> = {
  not_started: { label: 'NOT STARTED', color: 'text-slate-500', bg: 'bg-slate-100', pulse: false },
  scheduled: { label: 'SCHEDULED', color: 'text-amber-600', bg: 'bg-amber-50', pulse: false },
  in_progress: { label: 'LIVE', color: 'text-red-600', bg: 'bg-red-50', pulse: true },
  completed: { label: 'COMPLETED', color: 'text-emerald-600', bg: 'bg-emerald-50', pulse: false },
};

const PublicBidOpening: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const viewerTracked = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-bid-opening', id],
    queryFn: () => publicApi.getBidOpening(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!data || viewerTracked.current) return;
    if (data.status === 'not_started') return;
    const openingId = data.opening_id;
    if (!openingId) return;
    viewerTracked.current = true;
    api.post(`/bids/openings/${openingId}/track-viewer/`)
      .then((r) => setViewerCount(r.data.viewers_connected || 0))
      .catch(() => {});
  }, [data]);

  useEffect(() => {
    if (data?.viewers_connected != null) {
      setViewerCount(data.viewers_connected);
    }
  }, [data?.viewers_connected]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-zammsa-green border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-slate-500 font-medium">Loading bid opening...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Bid Opening Not Found</h1>
          <p className="text-sm text-slate-500 mb-6">The bid opening you are looking for does not exist or has not been initiated yet.</p>
          <Link to="/tenders" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-zammsa-green rounded-xl hover:bg-zammsa-green-dark transition-colors">
            Browse Tenders
          </Link>
        </div>
      </div>
    );
  }

  const status = data.status || 'not_started';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const totalBids = data.total_bids || 0;
  const openedCount = data.opened_count ?? data.opening_details?.filter((d: any) => d.is_opened).length ?? 0;
  const pendingCount = totalBids - openedCount;
  const progress = totalBids > 0 ? (openedCount / totalBids) * 100 : 0;
  const details: any[] = data.opening_details || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-zammsa-green rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white text-base font-bold italic">Z</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-slate-900 tracking-tight leading-none">ZAMMSA</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Procurement Portal</span>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              {status === 'in_progress' && (
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </div>
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Live</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-xs font-bold text-slate-600">{viewerCount} viewing</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Tender Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full ${config.bg} ${config.color}`}>
                    {config.pulse && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>}
                    {config.label}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{data.solicitation_number || data.solicitation || id}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">{data.solicitation_title || data.title || 'Bid Opening'}</h1>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Bids</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{totalBids}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Opened</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{openedCount}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pending</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conducted By</p>
                <p className="text-sm font-bold text-slate-700 mt-1.5 truncate">{data.conducted_by_name || '---'}</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {status !== 'not_started' && (
            <div className="px-6 pb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
                <span className="text-xs font-bold text-slate-600">{openedCount} / {totalBids} bids opened</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-zammsa-green to-emerald-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Not Started State */}
        {status === 'not_started' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Bid Opening Has Not Started</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              The bid opening session for this tender has not been initiated yet.
              Please check back later.
            </p>
            {data.message && (
              <p className="text-xs text-slate-400 mt-4 italic">{data.message}</p>
            )}
          </div>
        )}

        {/* Bid Opening Table */}
        {status !== 'not_started' && details.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Bid Details {status === 'in_progress' && '— Updating Live'}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-3">#</th>
                    <th className="px-6 py-3">Bidder</th>
                    <th className="px-6 py-3 text-right">Price</th>
                    <th className="px-6 py-3 text-center">Security</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((detail: any, idx: number) => {
                    const isOpened = detail.is_opened;
                    return (
                      <tr key={detail.detail_id || idx} className={`border-b border-slate-50 last:border-0 transition-colors ${isOpened ? 'bg-emerald-50/30' : ''}`}>
                        <td className="px-6 py-4 text-slate-400 font-bold">{detail.opened_sequence || idx + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isOpened ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {(detail.bidder_name || detail.bidder || 'B')[0].toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-900">{detail.bidder_name || detail.bidder || `Bidder ${idx + 1}`}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isOpened ? (
                            <span className="font-black text-slate-900">{fmtCurrency(detail.price_read || detail.bid_price)}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Sealed
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isOpened ? (
                            detail.bid_security_verified || detail.security_verified_read ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">Pending</span>
                            )
                          ) : (
                            <span className="text-xs text-slate-400">---</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isOpened ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">
                              Opened
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold">
                              Awaiting
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No bids submitted */}
        {status !== 'not_started' && details.length === 0 && totalBids === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <p className="text-sm text-slate-500">No bids were submitted for this tender.</p>
          </div>
        )}

        {/* Completed Banner */}
        {status === 'completed' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <svg className="w-10 h-10 text-emerald-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-bold text-emerald-800 mb-1">Bid Opening Completed</h3>
            <p className="text-xs text-emerald-600">
              This bid opening session has been finalized.
              {data.completed_at && <> Completed at {fmtDateTime(data.completed_at)}</>}
            </p>
          </div>
        )}

        {/* Location & Time */}
        {(data.location || data.scheduled_opening_time) && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Session Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.location && (
                <div className="p-3 bg-slate-50 rounded-xl flex items-start gap-3">
                  <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{data.location}</p>
                  </div>
                </div>
              )}
              {data.scheduled_opening_time && (
                <div className="p-3 bg-slate-50 rounded-xl flex items-start gap-3">
                  <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled Time</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{fmtDateTime(data.scheduled_opening_time)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <Link to="/tenders" className="text-xs font-bold text-zammsa-green hover:underline uppercase tracking-wider">
            ← Back to Tenders
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PublicBidOpening;

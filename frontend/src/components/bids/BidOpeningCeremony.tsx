import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bidsApi } from '../../api/bids';
import { solicitationsApi } from '../../api/solicitations';
import { usersApi } from '../../api/endpoints';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, LockOpenIcon, UsersIcon, LinkIcon, DocumentTextIcon,
  EyeIcon, ChevronRightIcon,
} from '@heroicons/react/outline';

const Vidicon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    <path d="M14 8l4-2v8l-4-2V8z" />
  </svg>
);

const BidOpeningCeremony: React.FC = () => {
  const { solId } = useParams<{ solId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openingStarted, setOpeningStarted] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [openedBids, setOpenedBids] = useState<Record<string, { opened: boolean; price?: string; objections?: string }>>({});
  const [observations, setObservations] = useState('');
  const [witness1, setWitness1] = useState('');
  const [witness2, setWitness2] = useState('');
  const [signedOfficer, setSignedOfficer] = useState(false);
  const [signedWitness1, setSignedWitness1] = useState(false);
  const [signedWitness2, setSignedWitness2] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [liveViewers, setLiveViewers] = useState(0);
  const [showMinutes, setShowMinutes] = useState(false);

  const { data: solicitation, isLoading: solLoading } = useQuery({
    queryKey: ['solicitation', solId],
    queryFn: () => solicitationsApi.get(solId!),
    enabled: !!solId,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-witnesses'],
    queryFn: () => usersApi.list({ page_size: 100 }),
  });
  const allUsers = usersData?.results || [];

  const { data: bidsData, isLoading: bidsLoading } = useQuery({
    queryKey: ['solicitation-bids', solId],
    queryFn: () => bidsApi.list({ solicitation: solId!, page_size: 100 }),
    enabled: !!solId,
  });

  const bids = bidsData?.results || [];
  const submittedBids = bids.filter((b: any) => b.status === 'submitted' || b.status === 'received');
  const lateBids = bids.filter((b: any) => b.is_late);
  const validBids = submittedBids;

  useEffect(() => {
    const findExisting = async () => {
      try {
        const openings = await bidsApi.listOpenings({ solicitation: solId, page_size: 1 });
        const existing = openings?.results?.find((o: any) => o.status === 'in_progress');
        if (existing) {
          setOpeningId(existing.opening_id || existing.id);
          setOpeningStarted(true);
          setLiveViewers(existing.viewers_connected || 0);
        }
      } catch {
      } finally {
        setCheckingExisting(false);
      }
    };
    if (solId) findExisting();
  }, [solId]);

  useEffect(() => {
    if (allUsers.length >= 2 && !witness1 && !witness2) {
      const procurement = allUsers.find((u: any) => u.role === 'procurement_officer' || u.role === 'procurement_manager');
      const legal = allUsers.find((u: any) => u.role === 'legal_officer' || u.role === 'finance_officer');
      if (procurement) setWitness1(procurement.id);
      if (legal) setWitness2(legal.id);
    }
  }, [allUsers, witness1, witness2]);

  const { data: opening, isLoading: openingLoading } = useQuery({
    queryKey: ['bid-opening', openingId],
    queryFn: () => bidsApi.getOpening(openingId!),
    enabled: !!openingId && openingStarted,
    refetchInterval: openingStarted ? 5000 : false,
  });

  useEffect(() => {
    if (opening?.viewers_connected !== undefined) {
      setLiveViewers(opening.viewers_connected);
    }
  }, [opening?.viewers_connected]);

  const startOpeningMutation = useMutation({
    mutationFn: () => bidsApi.startOpeningSession(solId!, {
      witnesses: [witness1, witness2],
      location: 'ZAMMSA Boardroom, Lusaka / Virtual',
    }),
    onSuccess: (data) => {
      setOpeningId(data.opening_id);
      setOpeningStarted(true);
      setLiveViewers(1);
      queryClient.invalidateQueries({ queryKey: ['bid-opening', data.opening_id] });
      toast.success('Bid opening session started');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || '';
      if (msg.includes('already in progress')) {
        toast.error('An opening session is already in progress');
        setCheckingExisting(true);
      } else {
        toast.error(msg || 'Failed to start opening session');
      }
    },
  });

  const openBidMutation = useMutation({
    mutationFn: ({ bidId }: { bidId: string }) =>
      bidsApi.openSingleBid(openingId!, bidId, { financial_sealed: false, objections: '' }),
    onSuccess: (_data, { bidId }) => {
      setOpenedBids(prev => ({ ...prev, [bidId]: { opened: true } }));
      queryClient.invalidateQueries({ queryKey: ['bid-opening', openingId] });
      toast.success('Bid opened');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to open bid'),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => {
      const witnessSignatures: Array<{ name: string; role: string; signed_at: string }> = [];
      if (signedOfficer) witnessSignatures.push({ name: officerName, role: 'Procurement Officer', signed_at: new Date().toISOString() });
      if (signedWitness1) witnessSignatures.push({ name: witness1Name, role: 'Witness 1', signed_at: new Date().toISOString() });
      if (signedWitness2) witnessSignatures.push({ name: witness2Name, role: 'Witness 2', signed_at: new Date().toISOString() });
      return bidsApi.finalizeOpening(openingId!, { observations, witness_signatures: witnessSignatures });
    },
    onSuccess: (data) => {
      setFinalized(true);
      setMinutesContent(data.minutes_content);
      queryClient.invalidateQueries({ queryKey: ['bid-opening', openingId] });
      queryClient.invalidateQueries({ queryKey: ['bid-openings-list'] });
      toast.success('Bid opening finalized. Minutes sent to all bidders.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to finalize bid opening');
    },
  });

  const [minutesContent, setMinutesContent] = useState('');

  const openingDetails = opening?.opening_details || [];
  const hasDetails = openingDetails.length > 0;
  const bidList = hasDetails
    ? openingDetails
    : validBids.map((b: any) => ({
        bid: b.bid_id || b.id,
        bidder_name: b.supplier_name || b.bidder_name || 'Unknown',
        bid_price: b.bid_price,
        security_amount: b.bid_security_amount || b.security_amount,
        bid_security_verified: b.security_verified,
      }));

  const allOpened = bidList.length > 0 && bidList.every((b: any) => {
    const id = b.bid || b.bid_id;
    return Boolean(openedBids[id]?.opened || b.is_opened);
  });
  const allSigned = signedOfficer && signedWitness1 && signedWitness2;
  const openedCount = Object.values(openedBids).filter(b => b.opened).length;

  const getWitnessName = (id: string) => {
    const u = allUsers.find((x: any) => x.id === id);
    return u ? u.full_name || u.email || id.slice(0, 8) : id.slice(0, 8);
  };

  const officerName = user?.full_name || user?.email || 'Procurement Officer';
  const witness1Name = getWitnessName(witness1);
  const witness2Name = getWitnessName(witness2);
  const publicLink = `${window.location.origin}/bids/public/openings/${solId}`;

  if (checkingExisting || solLoading || bidsLoading) return <LoadingSpinner className="py-12" />;

  if (!openingStarted) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ===== SECTION 2.1 — Bid Opening Initiation ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LockOpenIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500 font-mono">← {solicitation?.sol_number || solId}</span>
              <h1 className="text-xl font-bold text-gray-900">BID OPENING MANAGEMENT</h1>
            </div>
            <StatusBadge status={solicitation?.status || 'closed'} />
          </div>

          <div className="p-6 space-y-6">
            {/* Bid Summary */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4" />
                  BID SUMMARY
                </h2>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Solicitation</p>
                  <p className="font-semibold">{solicitation?.sol_number || solId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Title</p>
                  <p className="font-semibold">{solicitation?.title || '---'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Method</p>
                  <p className="font-semibold">{solicitation?.procurement_method || '---'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Closed At</p>
                  <p className="font-semibold">
                    {solicitation?.closing_date
                      ? new Date(solicitation.closing_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '---'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Bids Received</p>
                  <p className="font-semibold text-lg">{validBids.length}</p>
                </div>
                <div>
                  <p className="text-gray-500">Late Bids</p>
                  <p className={`font-semibold text-lg ${lateBids.length > 0 ? 'text-rose-600' : ''}`}>
                    {lateBids.length > 0 ? `${lateBids.length} ❌` : '0'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Valid Bids</p>
                  <p className="font-semibold text-lg">{validBids.length} (sealed)</p>
                </div>
                <div>
                  <p className="text-gray-500">Opening Time</p>
                  <p className="font-semibold">
                    {solicitation?.opening_date
                      ? new Date(solicitation.opening_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '14:30 CAT (scheduled)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Public Opening Setup */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Vidicon />
                  PUBLIC OPENING SETUP
                </h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Public Live View Link (share with attendees)</label>
                  <div className="flex items-center gap-2">
                    <input readOnly value={publicLink}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50 font-mono text-xs" />
                    <button onClick={() => { navigator.clipboard.writeText(publicLink); toast.success('Link copied'); }}
                      className="text-sm text-zammsa-green font-medium px-3 py-2 border border-zammsa-green rounded-lg hover:bg-green-50">
                      Copy Link
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(publicLink); toast.success('Link ready to share'); }}
                      className="text-sm text-zammsa-green font-medium px-3 py-2 border border-zammsa-green rounded-lg hover:bg-green-50 flex items-center gap-1">
                      <LinkIcon className="w-4 h-4" />
                      Email
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Witness 1</label>
                    <select value={witness1} onChange={(e) => setWitness1(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">Select witness...</option>
                      {allUsers.filter((u: any) => u.id !== witness2).map((u: any) => (
                        <option key={u.id} value={u.id}>{u.full_name || u.email} — {u.role?.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {witness1 ? `✅ ${getWitnessName(witness1)} selected` : '⏳ Pending'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Witness 2</label>
                    <select value={witness2} onChange={(e) => setWitness2(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">Select witness...</option>
                      {allUsers.filter((u: any) => u.id !== witness1).map((u: any) => (
                        <option key={u.id} value={u.id}>{u.full_name || u.email} — {u.role?.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {witness2 ? `✅ ${getWitnessName(witness2)} selected` : '⏳ Pending'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <UsersIcon className="w-4 h-4" />
                  <span>Viewers currently connected: <strong>{liveViewers}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => startOpeningMutation.mutate()}
                disabled={startOpeningMutation.isPending || !witness1 || !witness2 || !validBids.length}
                className="px-8 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold hover:bg-zammsa-green-dark flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                <LockOpenIcon className="w-5 h-5" />
                {startOpeningMutation.isPending ? 'Starting...' : 'Start Public Bid Opening'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ===== SECTION 2.2 — Live Bid Opening Interface ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-rose-50 to-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                <span className="text-sm font-bold text-rose-700 uppercase tracking-wider">LIVE</span>
              </div>
              <span className="text-sm text-gray-500">—</span>
              <h2 className="text-lg font-bold text-gray-900">PUBLIC BID OPENING</h2>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Vidicon /> {liveViewers} viewers
              </span>
            </div>
            <div className="text-sm text-gray-500">
              <span className="font-semibold">{solicitation?.sol_number || solId}</span>
              <span className="mx-2">|</span>
              <span>{solicitation?.title || ''}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              Procurement Officer: {officerName}
              <span className="mx-2">|</span>
              Started: {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium">
                  OPENING IN PROGRESS — Opened: {openedCount} / {bidList.length}
                </span>
              </div>
              {openedCount < bidList.length && (
                <span className="text-xs text-amber-600 font-medium">
                  Remaining: {bidList.length - openedCount}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Bids table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-700">BIDS OPENED SO FAR</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase">Supplier Name</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase">Bid Price (K)</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs uppercase">Security</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs uppercase">Status</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bidList.map((detail: any, i: number) => {
                    const id = detail.bid || detail.bid_id;
                    const opened = Boolean(openedBids[id]?.opened || detail.is_opened);
                    const price = detail.price_read || detail.bid_price;
                    return (
                      <tr key={id || i}
                        className={`transition-colors ${opened ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-500">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{detail.bidder_name}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {opened
                            ? `K ${Number(price || 0).toLocaleString()}`
                            : <span className="text-gray-400">🔒 Sealed</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(detail.bid_security_verified || detail.security_verified_read)
                            ? <CheckCircleIcon className="w-5 h-5 text-emerald-500 mx-auto" title="Verified" />
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          {opened
                            ? <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-medium">Opened</span>
                            : <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-medium">Sealed</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!opened && (
                            <button
                              onClick={() => openBidMutation.mutate({ bidId: id })}
                              disabled={openBidMutation.isPending}
                              className="px-3 py-1.5 bg-zammsa-green text-white text-xs rounded-lg hover:bg-zammsa-green-dark disabled:opacity-50 font-medium"
                            >
                              Open Bid
                            </button>
                          )}
                          {opened && (
                            <span className="text-xs text-gray-400">✓ Opened</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observations */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations / Notes</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-4 py-3 text-sm"
              placeholder="Type observations during opening (e.g., missing signatures, document issues)..."
            />
          </div>

          {/* Finalize CTA */}
          {allOpened && !finalized && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => { setShowMinutes(true); }}
                className="px-6 py-2.5 bg-zammsa-green text-white rounded-lg text-sm font-bold hover:bg-zammsa-green-dark flex items-center gap-2"
              >
                <DocumentTextIcon className="w-4 h-4" />
                Finalize Opening & Generate Minutes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== SECTION 2.3 — Bid Opening Minutes ===== */}
      {allOpened && !finalized && showMinutes && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5" />
              Bid Opening Minutes — {solicitation?.sol_number || solId}
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Preview */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <EyeIcon className="w-4 h-4" />
                  AUTO-GENERATED BID OPENING MINUTES (preview)
                </h3>
              </div>
              <div className="p-4 bg-gray-50/30">
                <div className="bg-white rounded-lg p-5 text-sm font-mono whitespace-pre-wrap border shadow-sm">
                  {`ZAMMSA — BID OPENING MINUTES
  Solicitation: ${solicitation?.sol_number || solId}
  Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
  Time: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} CAT
  Location: ZAMMSA Boardroom, Lusaka / Virtual (${liveViewers} viewers)
  Procurement Officer: ${officerName}

  BIDS RECEIVED AND OPENED:
  ${bidList.map((b: any, i: number) => {
    const id = b.bid || b.bid_id;
    const opened = openedBids[id]?.opened || b.is_opened;
    const price = b.price_read || b.bid_price;
    return `${i + 1}. ${(b.bidder_name || '').padEnd(35)}  K ${String(Number(price || 0).toLocaleString()).padStart(12)}  Security ${(b.bid_security_verified || b.security_verified_read) ? '✅' : '—'}`;
  }).join('\n')}

  OBSERVATIONS:
  ${observations || 'None recorded.'}

  LATE BIDS: ${lateBids.length > 0 ? `${lateBids.length} received at ${lateBids[0]?.submitted_at ? new Date(lateBids[0].submitted_at).toLocaleTimeString() : 'after deadline'} — automatically rejected.` : 'None.'}
  TOTAL BIDS RECEIVED: ${bids.length}
  VALID BIDS OPENED: ${Object.values(openedBids).filter(b => b.opened).length}`}
                </div>
              </div>
            </div>

            {/* Digital Signatures */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  ✍ DIGITAL SIGNATURES REQUIRED
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'Procurement Officer', name: officerName, state: signedOfficer, set: setSignedOfficer },
                  { label: 'Witness 1', name: witness1Name, state: signedWitness1, set: setSignedWitness1 },
                  { label: 'Witness 2', name: witness2Name, state: signedWitness2, set: setSignedWitness2 },
                ].map((sig) => (
                  <div key={sig.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-xs font-bold">
                        {sig.name.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{sig.label}</p>
                        <p className="text-xs text-gray-500">{sig.name}</p>
                      </div>
                    </div>
                    {sig.state ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                        <CheckCircleIcon className="w-5 h-5" />
                        Signed
                      </span>
                    ) : (
                      <button onClick={() => sig.set(true)}
                        className="px-4 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-zammsa-green-dark font-medium">
                        Apply My Signature
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Distribute */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  DISTRIBUTE MINUTES
                </h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600">
                  Minutes will be emailed to all {bids.length} bidding suppliers automatically once all signatures are collected.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                onClick={() => { setShowMinutes(false); }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm"
              >
                Preview PDF
              </button>
              <button
                onClick={() => {
                  if (!allSigned) {
                    toast.error('All signatures required before finalizing');
                    return;
                  }
                  finalizeMutation.mutate();
                }}
                disabled={finalizeMutation.isPending || !allSigned}
                className="px-6 py-2.5 bg-zammsa-green text-white rounded-lg text-sm font-bold hover:bg-zammsa-green-dark disabled:opacity-50 flex items-center gap-2"
              >
                {finalizeMutation.isPending ? 'Sending...' : 'Finalize & Send Minutes'}
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {finalized && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Bid Opening Finalized</h2>
          <p className="text-sm text-gray-500 mb-4">Minutes have been auto-generated and sent to all bidders.</p>

          {minutesContent && (
            <div className="mb-4 text-left">
              <div className="border rounded-lg p-4 bg-gray-50 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                {minutesContent}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button onClick={() => navigate('/bids/opening')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm">
              Back to Openings
            </button>
            <button onClick={() => navigate(`/evaluations/committee/formation?solicitation=${solId}`)}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 flex items-center gap-2">
              Next: Committee Formation
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BidOpeningCeremony;

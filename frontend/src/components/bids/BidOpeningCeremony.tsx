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
  CheckCircleIcon, XCircleIcon, LockOpenIcon, UsersIcon,
} from '@heroicons/react/outline';

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
  const [minutesGenerated, setMinutesGenerated] = useState(false);

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
  const lateBids = bids.filter((b: any) => b.status === 'late' || b.is_late);
  const validBids = submittedBids;

  useEffect(() => {
    const findExisting = async () => {
      try {
        const openings = await bidsApi.listOpenings({ solicitation: solId, page_size: 1 });
        const existing = openings?.results?.find((o: any) => o.status === 'in_progress');
        if (existing) {
          setOpeningId(existing.opening_id || existing.id);
          setOpeningStarted(true);
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
  });

  const { data: minutes } = useQuery({
    queryKey: ['bid-opening-minutes', openingId],
    queryFn: () => bidsApi.getMinutes(openingId!),
    enabled: !!openingId && minutesGenerated,
  });

  const startOpeningMutation = useMutation({
    mutationFn: () => bidsApi.startOpeningSession(solId!, [witness1, witness2]),
    onSuccess: (data) => {
      setOpeningId(data.opening_id);
      setOpeningStarted(true);
      queryClient.invalidateQueries({ queryKey: ['bid-opening', data.opening_id] });
      toast.success('Bid opening session started');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || '';
      if (msg.includes('already in progress')) {
        toast.error('An opening session is already in progress. Refreshing...');
        setCheckingExisting(true);
        const retry = async () => {
          try {
            const openings = await bidsApi.listOpenings({ solicitation: solId, page_size: 1 });
            const existing = openings?.results?.find((o: any) => o.status === 'in_progress');
            if (existing) {
              setOpeningId(existing.opening_id || existing.id);
              setOpeningStarted(true);
            }
          } catch {}
          setCheckingExisting(false);
        };
        retry();
      } else {
        toast.error('Failed to start opening session');
      }
    },
  });

  const openBidMutation = useMutation({
    mutationFn: ({ bidId }: { bidId: string; price: string }) =>
      bidsApi.openSingleBid(openingId!, bidId, { financial_sealed: false, objections: '' }),
    onSuccess: (_data, { bidId }) => {
      setOpenedBids(prev => ({ ...prev, [bidId]: { opened: true } }));
      queryClient.invalidateQueries({ queryKey: ['bid-opening', openingId] });
      toast.success('Bid opened successfully');
    },
    onError: () => toast.error('Failed to open bid'),
  });

  const sendMinutesMutation = useMutation({
    mutationFn: () => bidsApi.sendMinutes(openingId!),
    onSuccess: () => {
      toast.success('Minutes sent to all bidders');
    },
    onError: () => toast.error('Failed to send minutes'),
  });

  const openingDetails = opening?.opening_details || [];
  const hasDetails = openingDetails.length > 0;
  const bidList = hasDetails
    ? openingDetails
    : validBids.map((b: any) => ({
        bid: b.bid_id || b.id,
        bidder_name: b.supplier_name || b.bidder_name || 'Unknown',
        bid_price: b.bid_price,
        bid_security_verified: b.security_verified,
      }));

  const allOpened = bidList.length > 0 && bidList.every((b: any) => {
    const id = b.bid || b.bid_id;
    return Boolean(openedBids[id]?.opened || b.is_opened);
  });
  const allSigned = signedOfficer && signedWitness1 && signedWitness2;

  const getWitnessName = (id: string) => {
    const u = allUsers.find((u: any) => u.id === id);
    return u ? u.full_name || u.email || id.slice(0, 8) : id.slice(0, 8);
  };

  const officerName = user?.full_name || user?.email || 'Procurement Officer';
  const witness1Name = getWitnessName(witness1);
  const witness2Name = getWitnessName(witness2);
  const openingTime = solicitation?.opening_date
    ? new Date(solicitation.opening_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : solicitation?.closing_date
      ? new Date(solicitation.closing_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Scheduled at deadline';

  if (checkingExisting || solLoading || bidsLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Bid Opening Ceremony</h1>
            <StatusBadge status={openingStarted ? 'active' : 'draft'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {solicitation?.sol_number || `Solicitation: ${solId}`} | Public Bid Opening
          </p>
        </div>
        {!openingStarted && (
          <button
            onClick={() => startOpeningMutation.mutate()}
            disabled={startOpeningMutation.isPending || !witness1 || !witness2 || !validBids.length}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold hover:bg-zammsa-green-dark flex items-center gap-2 disabled:opacity-50"
          >
            <LockOpenIcon className="w-5 h-5" />
            {startOpeningMutation.isPending ? 'Starting...' : 'Start Public Bid Opening'}
          </button>
        )}
      </div>

      {!openingStarted ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bid Summary</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium"><StatusBadge status={solicitation?.status || 'closed'} /></dd>
              </div>
              <div>
                <dt className="text-gray-500">Bids Received</dt>
                <dd className="font-medium">{submittedBids.length}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Late Bids</dt>
                <dd className={`font-medium ${lateBids.length > 0 ? 'text-rose-600' : ''}`}>
                  {lateBids.length > 0 ? `${lateBids.length} (automatically rejected)` : 'None'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Valid Bids</dt>
                <dd className="font-medium">{validBids.length} (sealed)</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-gray-500">Opening Time</dt>
                <dd className="font-medium">{openingTime}</dd>
              </div>
              {solicitation?.title && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Title</dt>
                  <dd className="font-medium">{solicitation.title}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Public Opening Setup</h2>
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Public Live View Link</label>
                <div className="flex items-center gap-2">
                  <input readOnly value={`${window.location.origin}/bids/public/openings/${solId}`} className="flex-1 border rounded px-3 py-2 text-xs bg-gray-50" />
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/bids/public/openings/${solId}`); toast.success('Link copied'); }} className="text-zammsa-green text-xs font-medium">Copy</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Witness 1</label>
                <select value={witness1} onChange={(e) => setWitness1(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select witness...</option>
                  {allUsers.filter((u: any) => u.id !== witness2).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email} — {u.role?.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Witness 2</label>
                <select value={witness2} onChange={(e) => setWitness2(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select witness...</option>
                  {allUsers.filter((u: any) => u.id !== witness1).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email} — {u.role?.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-lg font-semibold text-gray-900">LIVE — Public Bid Opening</h2>
              </div>
              <div className="text-sm text-gray-500">
                Status: <span className="font-semibold text-emerald-600">{allOpened ? 'All bids opened' : `Opened: ${Object.values(openedBids).filter(b => b.opened).length} / ${bidList.length}`}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Supplier Name</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Bid Price (K)</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Security</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bidList.map((detail: any, i: number) => {
                    const id = detail.bid || detail.bid_id;
                    const opened = Boolean(openedBids[id]?.opened || detail.is_opened);
                    return (
                      <tr key={id || i} className={opened ? 'bg-green-50' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 font-medium">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{detail.bidder_name}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {opened
                            ? `K ${(detail.price_read || detail.bid_price || '').toLocaleString?.() || detail.price_read || detail.bid_price || ''}`
                            : '🔒 Sealed'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(detail.bid_security_verified || detail.security_verified)
                            ? <CheckCircleIcon className="w-5 h-5 text-emerald-500 mx-auto" />
                            : <XCircleIcon className="w-5 h-5 text-rose-500 mx-auto" />
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          {opened
                            ? <span className="text-emerald-600 text-xs font-bold">Opened</span>
                            : <span className="text-amber-600 text-xs font-bold">Sealed</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!opened && (
                            <button
                              onClick={() => openBidMutation.mutate({ bidId: id, price: String(detail.bid_price || '') })}
                              disabled={openBidMutation.isPending}
                              className="px-3 py-1.5 bg-zammsa-green text-white text-xs rounded-lg hover:bg-zammsa-green-dark"
                            >
                              Open Bid
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Observations / Notes</h2>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-4 py-3 text-sm"
              placeholder="Type observations during opening (e.g., missing signatures, document issues)..."
            />
          </div>

          {allOpened && (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Bid Opening Minutes</h2>
                <div className="bg-gray-50 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap">
                  {`ZAMMSA — BID OPENING MINUTES
Solicitation: ${solicitation?.sol_number || solId}
Title: ${solicitation?.title || 'N/A'}
Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
Time: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} CAT
Location: ZAMMSA Boardroom, Lusaka
Procurement Officer: ${officerName}
Witness 1: ${witness1Name}
Witness 2: ${witness2Name}

BIDS RECEIVED AND OPENED:
${bidList.map((b: any, i: number) => {
  const id = b.bid || b.bid_id;
  const opened = openedBids[id]?.opened || b.is_opened;
  const price = b.price_read || b.bid_price || '';
  return `${i + 1}. ${(b.bidder_name || '').padEnd(35)} ${opened ? `K ${String(price).padStart(10)}` : '🔒 Sealed'.padStart(14)}  Security ${(b.bid_security_verified || b.security_verified) ? '✅' : '❌'}`;
}).join('\n')}

OBSERVATIONS: ${observations || 'None recorded.'}
LATE BIDS: ${lateBids.length > 0 ? `${lateBids.length} received — automatically rejected.` : 'None.'}
TOTAL BIDS RECEIVED: ${bids.length}
VALID BIDS OPENED: ${Object.values(openedBids).filter(b => b.opened).length}`}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Digital Signatures Required</h2>
                <div className="space-y-4">
                  {[
                    { label: 'Procurement Officer', name: officerName, state: signedOfficer, set: setSignedOfficer },
                    { label: 'Witness 1', name: witness1Name, state: signedWitness1, set: setSignedWitness1 },
                    { label: 'Witness 2', name: witness2Name, state: signedWitness2, set: setSignedWitness2 },
                  ].map((sig) => (
                    <div key={sig.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{sig.label}</p>
                        <p className="text-xs text-gray-500">{sig.name}</p>
                      </div>
                      {sig.state ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                          <CheckCircleIcon className="w-5 h-5" /> Signed
                        </span>
                      ) : (
                        <button
                          onClick={() => sig.set(true)}
                          className="px-4 py-2 bg-zammsa-green text-white text-sm rounded-lg hover:bg-zammsa-green-dark"
                        >
                          Apply My Signature
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => { setMinutesGenerated(true); toast.success('Minutes generated'); }}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                >
                  Preview Minutes
                </button>
                {allSigned && (
                  <button
                    onClick={() => sendMinutesMutation.mutate()}
                    disabled={sendMinutesMutation.isPending}
                    className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50"
                  >
                    {sendMinutesMutation.isPending ? 'Sending...' : 'Finalize & Send Minutes'}
                  </button>
                )}
              </div>

              {allSigned && !sendMinutesMutation.isPending && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => navigate(`/evaluations`)}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700"
                  >
                    Proceed to Evaluation
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default BidOpeningCeremony;

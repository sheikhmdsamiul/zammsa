import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { bidsApi } from '../../api/bids';
import { solicitationsApi } from '../../api/solicitations';
import { usersApi } from '../../api/endpoints';
import { PageHeader } from '../common/PageHeader';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { LockOpenIcon, UsersIcon, LinkIcon } from '@heroicons/react/outline';

const OpeningSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedSol, setSelectedSol] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [location, setLocation] = useState('');
  const [witness1, setWitness1] = useState('');
  const [witness2, setWitness2] = useState('');
  const [publicLink, setPublicLink] = useState('');
  const [notes, setNotes] = useState('');

  const { data: solsData, isLoading: solsLoading } = useQuery({
    queryKey: ['solicitations-for-opening', 1, 100],
    queryFn: () => solicitationsApi.list({ page: 1, page_size: 100 }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-opening'],
    queryFn: () => usersApi.list({ page_size: 100 }),
  });

  const allUsers = usersData?.results || [];
  const solicitations = (solsData?.results || []).filter((s: any) => s.status === 'closed');

  const selectedSolicitation = solicitations.find((s: any) => s.id === selectedSol);

  const { data: solBids } = useQuery({
    queryKey: ['sol-bids-count', selectedSol],
    queryFn: () => bidsApi.list({ solicitation: selectedSol, page_size: 1 }),
    enabled: !!selectedSol,
  });

  const totalBidsReceived = solBids?.count || 0;

  const startOpeningMutation = useMutation({
    mutationFn: () => {
      let scheduledTime: string | undefined;
      if (openingDate && openingTime) {
        const [hm, ap] = openingTime.split(' ');
        let [h, m] = hm.split(':');
        let hour = parseInt(h);
        if (ap === 'PM' && hour < 12) hour += 12;
        if (ap === 'AM' && hour === 12) hour = 0;
        scheduledTime = new Date(`${openingDate}T${String(hour).padStart(2, '0')}:${m}`).toISOString();
      }
      return bidsApi.startOpeningSession(selectedSol, {
        witnesses: [witness1, witness2],
        scheduled_opening_time: scheduledTime,
        public_live_link: publicLink || undefined,
        observations: notes || undefined,
        location: location || undefined,
      });
    },
    onSuccess: (data) => {
      toast.success('Bid opening session started successfully');
      navigate(`/bids/opening/${selectedSol}`);
    },
    onError: (err: any) => {
      const details = err?.response?.data?.details;
      const msg = err?.response?.data?.error || 'Failed to start opening session';
      if (details) {
        toast.error(`${msg}\n${details.join('\n')}`);
      } else {
        toast.error(msg);
      }
    },
  });

  const handleStartOpening = () => {
    if (!selectedSol) { toast.error('Please select a solicitation'); return; }
    if (!openingDate || !openingTime) { toast.error('Opening date and time are required'); return; }
    startOpeningMutation.mutate();
  };

  if (solsLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Bid Opening Setup"
        description="Configure a new public bid opening session"
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-4 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-zammsa-green text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {s}
              </div>
              <span className={`text-sm font-medium ${step >= s ? 'text-gray-900' : 'text-gray-400'}`}>
                {s === 1 ? 'Select Solicitation' : s === 2 ? 'Configure Session' : 'Review & Start'}
              </span>
              {s < 3 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Select Solicitation</h2>
            <p className="text-sm text-gray-500">Choose the solicitation for which you want to open bids</p>
            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {solicitations.map((sol: any) => (
                <div key={sol.id}
                  onClick={() => setSelectedSol(sol.id)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    selectedSol === sol.id ? 'border-zammsa-green bg-green-50 ring-1 ring-zammsa-green' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{sol.title}</p>
                      <p className="text-sm text-gray-500">{sol.sol_number || sol.id.slice(0, 8)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{sol.total_bids || 0} bids received</p>
                      <p className="text-xs text-gray-400">
                        Deadline: {sol.closing_date ? new Date(sol.closing_date).toLocaleDateString() : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {!solicitations.length && (
                <p className="text-gray-400 text-sm text-center py-8">No published solicitations with bids found</p>
              )}
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={() => { if (selectedSol) setStep(2); else toast.error('Please select a solicitation'); }}
                disabled={!selectedSol}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50">
                Next — Configure Session
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Configure Opening Session</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Date *</label>
                <input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Time *</label>
                <div className="flex gap-2">
                  <select value={openingTime.split(':')[0] || ''} onChange={(e) => {
                    const h = e.target.value;
                    const m = openingTime.split(':')[1] || '00';
                    const ap = openingTime.split(' ')[1] || 'AM';
                    setOpeningTime(h && m ? `${h}:${m} ${ap}` : '');
                  }} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">HH</option>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="text-lg font-bold text-gray-400 self-center">:</span>
                  <select value={openingTime.split(':')[1]?.split(' ')[0] || ''} onChange={(e) => {
                    const m = e.target.value;
                    const h = openingTime.split(':')[0] || '12';
                    const ap = openingTime.split(' ')[1] || 'AM';
                    setOpeningTime(h && m ? `${h}:${m} ${ap}` : '');
                  }} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">MM</option>
                    {['00', '15', '30', '45'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select value={openingTime.split(' ')[1] || 'AM'} onChange={(e) => {
                    const ap = e.target.value;
                    const parts = openingTime.split(' ');
                    const hm = parts[0] || '12:00';
                    setOpeningTime(`${hm} ${ap}`);
                  }} className="w-full border rounded-lg px-3 py-2 text-sm font-bold">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <UsersIcon className="w-4 h-4" />
                Witnesses Required
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Witness 1 *</label>
                  <select value={witness1} onChange={(e) => setWitness1(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select witness...</option>
                    {allUsers.filter((u: any) => u.id !== witness2 && u.id !== user?.id).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email} — {u.role?.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Witness 2 *</label>
                  <select value={witness2} onChange={(e) => setWitness2(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select witness...</option>
                    {allUsers.filter((u: any) => u.id !== witness1 && u.id !== user?.id).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email} — {u.role?.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Public Live Stream
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Public Live View Link (optional)</label>
                <input type="url" value={publicLink} onChange={(e) => setPublicLink(e.target.value)}
                    placeholder="https://..."
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 mt-1">Share this link with the public to watch the opening live</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Instructions</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Any special instructions for the opening ceremony..." />
            </div>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(1)} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                Back
              </button>
              <button onClick={() => setStep(3)}
                disabled={!witness1 || !witness2 || !openingDate || !openingTime}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50">
                Next — Review
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Review Opening Session</h2>
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Solicitation</p>
                  <p className="font-medium">{selectedSolicitation?.title || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Solicitation #</p>
                  <p className="font-medium">{selectedSolicitation?.sol_number || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Opening Date</p>
                  <p className="font-medium">{openingDate ? new Date(openingDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Opening Time</p>
                  <p className="font-medium">{openingTime || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Location</p>
                  <p className="font-medium">{location || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Bids Received</p>
                  <p className="font-medium">{totalBidsReceived}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-2">Witnesses</p>
                <div className="flex gap-4">
                  {[witness1, witness2].map((w, i) => {
                    const u = allUsers.find((x: any) => x.id === w);
                    return (
                      <div key={i} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border">
                        <div className="w-8 h-8 bg-zammsa-green rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {u?.full_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">Witness {i + 1}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {publicLink && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-1">Public Live Link</p>
                  <p className="text-sm font-medium text-blue-600">{publicLink}</p>
                </div>
              )}
              {notes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-sm">{notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(2)} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm">
                Back
              </button>
              <button onClick={handleStartOpening} disabled={startOpeningMutation.isPending}
                className="px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold hover:bg-zammsa-green-dark flex items-center gap-2 disabled:opacity-50">
                <LockOpenIcon className="w-4 h-4" />
                {startOpeningMutation.isPending ? 'Starting...' : 'Start Bid Opening'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpeningSetup;

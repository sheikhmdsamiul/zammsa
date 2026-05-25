import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { StatusBadge } from '../common/StatusBadge';
import toast from 'react-hot-toast';
import { ExclamationIcon, CheckCircleIcon } from '@heroicons/react/outline';

const LiquidatedDamages: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [actualDeliveryDate, setActualDeliveryDate] = useState('');
  const [revisedDeliveryDate, setRevisedDeliveryDate] = useState('2026-08-15');
  const [daysLate, setDaysLate] = useState(0);
  const [ldAmount, setLdAmount] = useState(0);
  const [calculated, setCalculated] = useState(false);
  const [recorded, setRecorded] = useState(false);

  const contractValue = 1155000;
  const ldRate = 0.5;
  const ldCap = contractValue * 0.1;

  const calculateLD = () => {
    if (!actualDeliveryDate || !revisedDeliveryDate) {
      toast.error('Enter both dates');
      return;
    }
    const actual = new Date(actualDeliveryDate);
    const revised = new Date(revisedDeliveryDate);
    const diffMs = actual.getTime() - revised.getTime();
    const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    setDaysLate(diffDays);
    const weeksLate = Math.ceil(diffDays / 7);
    const calculatedLd = contractValue * (ldRate / 100) * weeksLate;
    const finalLd = Math.min(calculatedLd, ldCap);
    setLdAmount(finalLd);
    setCalculated(true);
  };

  const recordMutation = useMutation({
    mutationFn: () => contractsApi.calculateLD(id!, { days_delayed: daysLate, daily_rate: contractValue * (ldRate / 100) / 7 }),
    onSuccess: () => {
      setRecorded(true);
      toast.success(`Liquidated damages recorded: K ${ldAmount.toLocaleString()}`);
    },
    onError: () => toast.error('Failed to record'),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Liquidated Damages</h1>
            <StatusBadge status={recorded ? 'completed' : 'active'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">CON-2026-LAB-11</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">LD Calculator</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500">Contract Value</p>
            <p className="text-lg font-bold text-gray-900">K {contractValue.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500">LD Rate</p>
            <p className="text-lg font-bold text-gray-900">{ldRate}% per week</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500">LD Cap (10%)</p>
            <p className="text-lg font-bold text-gray-900">K {ldCap.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-600">Status</p>
            <p className="text-lg font-bold text-amber-700">{recorded ? 'Recorded' : calculated ? 'Calculated' : 'Not calculated'}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Revised Delivery Date</label>
              <input type="date" value={revisedDeliveryDate} onChange={(e) => setRevisedDeliveryDate(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Delivery Date</label>
              <input type="date" value={actualDeliveryDate} onChange={(e) => setActualDeliveryDate(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm" />
            </div>
          </div>

          {!calculated && (
            <button onClick={calculateLD} className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold">
              Calculate LD
            </button>
          )}

          {calculated && (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <ExclamationIcon className="w-5 h-5 text-amber-600" />
                <p className="text-sm font-medium text-gray-900">Days Late: <strong>{daysLate} days</strong> ({Math.ceil(daysLate / 7)} week(s))</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Calculation: K{contractValue.toLocaleString()} × {ldRate}% × {Math.ceil(daysLate / 7)} week(s)</p>
                  <p className="text-xs text-gray-500">Cap check: K{ldAmount.toLocaleString()} {'<'} K{ldCap.toLocaleString()} ✅ Within cap</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">LD Due</p>
                  <p className="text-xl font-bold text-rose-600">K {ldAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              {!recorded && (
                <button onClick={() => recordMutation.mutate()} disabled={recordMutation.isPending}
                  className="w-full px-4 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                  Record Liquidated Damages — K {ldAmount.toLocaleString()}
                </button>
              )}
              {recorded && (
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircleIcon className="w-5 h-5" /> LD recorded — will be deducted from next invoice
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiquidatedDamages;

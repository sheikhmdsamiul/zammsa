import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { contractsApi } from '../../api/contracts';
import { suppliersApi } from '../../api/suppliers';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

const SupplierPerformanceEval: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  const [scores, setScores] = useState({
    deliveryTimeliness: 72,
    qualityCompliance: 100,
    contractAdherence: 85,
    responsiveness: 92,
    technicalSupport: null as number | null,
  });
  const [comments, setComments] = useState('');
  const [recommendation, setRecommendation] = useState<'recommend' | 'monitor' | 'not_recommend'>('recommend');
  const [submitted, setSubmitted] = useState(false);

  const metrics = [
    { key: 'deliveryTimeliness', label: 'Delivery Timeliness', description: 'on-time deliveries / total deliveries × 100', value: '1 of 1 (late by 5 days — LD applied)' },
    { key: 'qualityCompliance', label: 'Quality Compliance', description: 'accepted goods / total goods received × 100', value: 'All items accepted after ZAMRA inspection' },
    { key: 'contractAdherence', label: 'Contract Adherence', description: 'compliance with terms — subjective 0-100', value: 'Minor shortfall (2 CD4 kits) — corrected promptly' },
    { key: 'responsiveness', label: 'Responsiveness', description: 'time to respond to queries and issues', value: 'All queries answered within 24 hours' },
    { key: 'technicalSupport', label: 'Technical Support', description: 'quality of after-delivery support', value: 'N/A for goods supply', isNA: true },
  ];

  const weights: Record<string, number> = {
    deliveryTimeliness: 0.25,
    qualityCompliance: 0.25,
    contractAdherence: 0.20,
    responsiveness: 0.15,
    technicalSupport: 0.15,
  };
  const validScores = Object.entries(scores)
    .filter(([_, v]) => v !== null) as [string, number][];
  const totalWeight = validScores.reduce((sum, [key]) => sum + weights[key], 0);
  const overallScore = totalWeight > 0
    ? Math.round(validScores.reduce((sum, [key, v]) => sum + v * weights[key], 0) / totalWeight)
    : 0;

  const submitMutation = useMutation({
    mutationFn: () => suppliersApi.evaluatePerformance(contract!.vendor, {
      metrics: scores,
      overall_score: overallScore,
      improvement_notes: comments,
      contract_id: id,
    }),
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Performance evaluation submitted');
    },
    onError: () => toast.error('Failed to submit'),
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto py-12 bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${overallScore >= 80 ? 'bg-emerald-100' : overallScore >= 60 ? 'bg-amber-100' : 'bg-rose-100'}`}>
          <span className={`text-2xl font-bold ${overallScore >= 80 ? 'text-emerald-600' : overallScore >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{overallScore}</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Performance Evaluation Submitted</h2>
        <p className="text-gray-500 mb-6">Overall Score: {overallScore}/100 — {overallScore >= 80 ? '🟢 GOOD' : overallScore >= 60 ? '🟡 AVERAGE' : '🔴 POOR'}</p>
        <button onClick={() => navigate(`/contracts/${id}/closure`)} className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold">Proceed to Closure</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Supplier Performance Evaluation</h1>
            <StatusBadge status="active" />
          </div>
          <p className="text-sm text-gray-500 mt-1">{contract?.vendor_name} | {contract?.contract_number}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Performance Metrics</h2>
        <div className="space-y-6">
          {metrics.map((m) => (
            <div key={m.key} className="p-5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.value}</p>
                </div>
                {m.isNA ? (
                  <span className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full font-medium">N/A</span>
                ) : (
                  <div className="text-right">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={(scores as any)[m.key] || ''}
                      onChange={(e) => setScores(prev => ({ ...prev, [m.key]: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                      className="w-20 text-right border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold"
                    />
                    <p className="text-xs text-gray-400 mt-1">/ 100</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-zammsa-green/5 border border-zammsa-green/20 rounded-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Overall Score</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-zammsa-green">{overallScore}</span>
              <span className="text-sm text-gray-500">/ 100</span>
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
                overallScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                overallScore >= 60 ? 'bg-amber-100 text-amber-700' :
                'bg-rose-100 text-rose-700'
              }`}>
                {overallScore >= 80 ? 'GOOD' : overallScore >= 60 ? 'AVERAGE' : 'POOR'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Comments</h2>
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3}
          className="w-full border rounded-lg px-4 py-3 text-sm"
          placeholder="Enter performance comments..." />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendation for Future</h2>
        <div className="space-y-3">
          {[
            { value: 'recommend', label: 'Recommend for future procurements' },
            { value: 'monitor', label: 'Acceptable — monitor closely' },
            { value: 'not_recommend', label: 'Do not recommend' },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
              <input type="radio" name="recommendation" value={opt.value}
                checked={recommendation === opt.value}
                onChange={() => setRecommendation(opt.value as any)}
                className="text-zammsa-green" />
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !contract}
          className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50">
          {submitMutation.isPending ? 'Submitting...' : 'Submit Performance Evaluation'}
        </button>
      </div>
    </div>
  );
};

export default SupplierPerformanceEval;

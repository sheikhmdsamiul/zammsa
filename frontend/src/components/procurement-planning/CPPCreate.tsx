import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementPlanningApi } from '../../api/procurement_planning';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const CPPCreate: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    requisition: '',
    procurement_strategy: '',
    milestones: [] as { name: string; date: string }[],
    risk_assessment: { risks: [] as { description: string; mitigation: string; severity: string }[] },
    resource_requirements: { staff: '', equipment: '', budget: '' },
  });

  const [newMilestone, setNewMilestone] = useState({ name: '', date: '' });
  const [newRisk, setNewRisk] = useState({ description: '', mitigation: '', severity: 'medium' });

  const addMilestone = () => {
    if (!newMilestone.name || !newMilestone.date) return;
    setForm(prev => ({ ...prev, milestones: [...prev.milestones, { ...newMilestone }] }));
    setNewMilestone({ name: '', date: '' });
  };

  const removeMilestone = (i: number) => {
    setForm(prev => ({ ...prev, milestones: prev.milestones.filter((_, idx) => idx !== i) }));
  };

  const addRisk = () => {
    if (!newRisk.description) return;
    setForm(prev => ({
      ...prev,
      risk_assessment: { risks: [...prev.risk_assessment.risks, { ...newRisk }] },
    }));
    setNewRisk({ description: '', mitigation: '', severity: 'medium' });
  };

  const removeRisk = (i: number) => {
    setForm(prev => ({
      ...prev,
      risk_assessment: { risks: prev.risk_assessment.risks.filter((_, idx) => idx !== i) },
    }));
  };

  const handleSubmit = async () => {
    if (!form.requisition) { toast.error('Requisition is required'); return; }
    setLoading(true);
    try {
      const milestones = form.milestones.map(m => ({
        milestone_name: m.name,
        planned_date: m.date,
      }));
      await procurementPlanningApi.contractPlans.create({
        requisition: form.requisition,
        procurement_strategy: form.procurement_strategy,
        milestones,
        risk_assessment: form.risk_assessment,
        resource_requirements: form.resource_requirements,
        status: 'draft',
      });
      toast.success('CPP created');
      navigate('/procurement-planning/cpp');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create CPP');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Contract Procurement Plan</h1>
          <p className="text-sm text-gray-500">Define procurement strategy, milestones, and risks</p>
        </div>
        <button onClick={() => navigate('/procurement-planning/cpp')} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to List</button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Requisition ID *</label>
          <input
            type="text"
            value={form.requisition}
            onChange={(e) => setForm({ ...form, requisition: e.target.value })}
            placeholder="UUID of the requisition"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Procurement Strategy</label>
          <input
            type="text"
            value={form.procurement_strategy}
            onChange={(e) => setForm({ ...form, procurement_strategy: e.target.value })}
            placeholder="e.g., Open Tendering, Restricted..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resource Requirements</label>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={form.resource_requirements.staff}
              onChange={(e) => setForm({ ...form, resource_requirements: { ...form.resource_requirements, staff: e.target.value } })}
              placeholder="Staff needed"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={form.resource_requirements.equipment}
              onChange={(e) => setForm({ ...form, resource_requirements: { ...form.resource_requirements, equipment: e.target.value } })}
              placeholder="Equipment needed"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={form.resource_requirements.budget}
              onChange={(e) => setForm({ ...form, resource_requirements: { ...form.resource_requirements, budget: e.target.value } })}
              placeholder="Budget"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Milestones ({form.milestones.length})</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newMilestone.name}
            onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
            placeholder="Milestone name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={newMilestone.date}
            onChange={(e) => setNewMilestone({ ...newMilestone, date: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={addMilestone} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm">Add</button>
        </div>
        {form.milestones.length > 0 && (
          <div className="space-y-2">
            {form.milestones.map((m, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <span>{m.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{m.date}</span>
                  <button onClick={() => removeMilestone(i)} className="text-red-600 hover:text-red-800">&times;</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Risk Assessment ({form.risk_assessment.risks.length})</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newRisk.description}
            onChange={(e) => setNewRisk({ ...newRisk, description: e.target.value })}
            placeholder="Risk description"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={newRisk.severity}
            onChange={(e) => setNewRisk({ ...newRisk, severity: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            type="text"
            value={newRisk.mitigation}
            onChange={(e) => setNewRisk({ ...newRisk, mitigation: e.target.value })}
            placeholder="Mitigation"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={addRisk} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm">Add</button>
        </div>
        {form.risk_assessment.risks.length > 0 && (
          <div className="space-y-2">
            {form.risk_assessment.risks.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <div>
                  <span className="font-medium">{r.description}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${r.severity === 'high' ? 'bg-red-100 text-red-800' : r.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                    {r.severity}
                  </span>
                  {r.mitigation && <span className="ml-2 text-gray-500">— {r.mitigation}</span>}
                </div>
                <button onClick={() => removeRisk(i)} className="text-red-600 hover:text-red-800">&times;</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/procurement-planning/cpp')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
        <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark disabled:opacity-50">
          {loading ? 'Creating...' : 'Create CPP'}
        </button>
      </div>
    </div>
  );
};

export default CPPCreate;

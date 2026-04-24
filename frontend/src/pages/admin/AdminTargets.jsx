import { useState, useEffect } from 'react';
import { Plus, Target, Award, X, CheckCircle, Trash2 } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { getTargets, getEmployees, createTarget, updateTargetProgress, payTargetBonus, deleteTarget } from '../../services/api';
import { toast } from 'react-toastify';
import adminNavItems from './adminNavItems';

const TARGET_TYPES = [
  { value: 'sales', label: 'Sales (Rs.)' },
  { value: 'deliveries', label: 'Deliveries' },
  { value: 'items_sold', label: 'Items Sold' },
  { value: 'attendance', label: 'Attendance (days)' },
];

const AdminTargets = () => {
  const [targets, setTargets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState({
    employeeId: '', targetType: 'sales', targetValue: '', bonusAmount: '', notes: '',
  });

  const fetchData = async () => {
    try {
      const [tRes, eRes] = await Promise.all([
        getTargets({ month: filterMonth, year: filterYear }),
        getEmployees(),
      ]);
      const sortedTargets = tRes.data.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return 0;
      });
      setTargets(sortedTargets);
      setEmployees(eRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterMonth, filterYear]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createTarget({
        ...form,
        targetValue: Number(form.targetValue),
        bonusAmount: Number(form.bonusAmount) || 0,
        month: filterMonth,
        year: filterYear,
      });
      toast.success('Target created');
      setShowModal(false);
      setForm({ employeeId: '', targetType: 'sales', targetValue: '', bonusAmount: '', notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create');
    }
  };

  const handleUpdateProgress = async (id, currentValue) => {
    const newVal = prompt('Enter new achieved value:', currentValue);
    if (newVal === null) return;
    try {
      await updateTargetProgress(id, { achievedValue: Number(newVal) });
      toast.success('Progress updated');
      fetchData();
    } catch (err) { toast.error('Failed to update'); }
  };

  const handlePayBonus = async (id) => {
    if (!window.confirm('Mark bonus as paid?')) return;
    try {
      await payTargetBonus(id);
      toast.success('Bonus marked as paid');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this target?')) return;
    try {
      await deleteTarget(id);
      toast.success('Target deleted');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete target'); }
  };

  if (loading) {
    return (
      <DashboardLayout navItems={adminNavItems} title="Admin Panel">
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-green border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const completedCount = targets.filter(t => t.status === 'completed').length;
  const totalBonus = targets.filter(t => t.status === 'completed').reduce((s, t) => s + (t.bonusAmount || 0), 0);

  return (
    <DashboardLayout navItems={adminNavItems} title="Admin Panel">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-dark-navy">🎯 Employee Targets</h1>
            <p className="text-muted-text text-sm mt-1">{targets.length} targets • {completedCount} completed • Rs. {totalBonus.toLocaleString()} bonus</p>
          </div>
          <div className="flex gap-2 items-center">
            <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="border border-card-border rounded-xl py-2 px-3 text-sm bg-white">
              {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}
              className="border border-card-border rounded-xl py-2 px-3 text-sm bg-white">
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-primary-green text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-600 shadow-lg shadow-emerald-200 text-sm">
              <Plus size={18} /> Assign Target
            </button>
          </div>
        </div>

        {/* Targets Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {targets.map(t => {
            const progress = t.targetValue > 0 ? Math.min(100, Math.round((t.achievedValue / t.targetValue) * 100)) : 0;
            const isCompleted = t.status === 'completed';
            return (
              <div key={t._id} className={`bg-white rounded-2xl border p-5 shadow-sm ${isCompleted ? 'border-emerald-200' : 'border-card-border'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-dark-navy">{t.employeeId?.name || 'Employee'}</p>
                    <p className="text-xs text-muted-text">{t.employeeId?.role}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    isCompleted ? 'bg-emerald-100 text-emerald-700' : t.status === 'missed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {isCompleted ? '✅ Done' : t.status === 'missed' ? '❌ Missed' : '🔄 Active'}
                  </span>
                  <button onClick={() => handleDelete(t._id)} className="ml-2 text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>

                <p className="text-sm text-muted-text mb-1 capitalize">{t.targetType.replace('_', ' ')}</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-2xl font-bold text-dark-navy">{t.achievedValue}</span>
                  <span className="text-muted-text text-sm mb-0.5">/ {t.targetValue}</span>
                </div>
                {t.notes && <p className="text-xs text-gray-500 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">{t.notes}</p>}

                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-text">{progress}%</span>
                  <div className="flex gap-1">
                    {!isCompleted && (
                      <button onClick={() => handleUpdateProgress(t._id, t.achievedValue)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100 font-medium">Update</button>
                    )}
                    {isCompleted && t.bonusAmount > 0 && !t.bonusPaid && (
                      <button onClick={() => handlePayBonus(t._id)} className="text-xs bg-amber-50 text-amber-600 px-3 py-1 rounded-lg hover:bg-amber-100 font-medium flex items-center gap-1">
                        <Award size={12} /> Pay Rs.{t.bonusAmount}
                      </button>
                    )}
                    {t.bonusPaid && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={12} /> Paid</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {targets.length === 0 && <div className="text-center py-12 text-muted-text">No targets for this period</div>}
      </div>

      {/* Create Target Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-dark-navy">Assign Target</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Employee *</label>
                <select required value={form.employeeId} onChange={(e) => setForm({...form, employeeId: e.target.value})}
                  className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm">
                  <option value="">Select employee</option>
                  {employees.map(e => <option key={e._id} value={e._id}>{e.name} ({e.role})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-navy mb-1">Target Type *</label>
                  <select value={form.targetType} onChange={(e) => setForm({...form, targetType: e.target.value})}
                    className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm">
                    {TARGET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-navy mb-1">Target Value *</label>
                  <input type="number" required min="1" value={form.targetValue} onChange={(e) => setForm({...form, targetValue: e.target.value})}
                    className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Bonus Amount (Rs.)</label>
                <input type="number" min="0" value={form.bonusAmount} onChange={(e) => setForm({...form, bonusAmount: e.target.value})}
                  placeholder="0" className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Description / Notes (optional)</label>
                <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})}
                  placeholder="Additional details about this target..." className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm resize-none" rows="2" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-primary-green text-white py-2.5 rounded-xl font-semibold hover:bg-emerald-600 text-sm">Create Target</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-card-border py-2.5 rounded-xl text-muted-text hover:bg-gray-50 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminTargets;


import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Search, FileDown } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import {
  getExpenses, getExpenseSummary, createExpense, updateExpense, deleteExpense,
  getAdditionalIncomes, addAdditionalIncome, updateAdditionalIncome, deleteAdditionalIncome,
} from '../../services/api';
import { toast } from 'react-toastify';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { adminNavGroups as navItems } from './adminNavItems';

const CATEGORIES = ['Employee Payments', 'Utilities', 'Water Bill', 'Electricity', 'Overtime', 'Rent', 'Salaries', 'Marketing', 'Transport', 'Supplies', 'Maintenance', 'Insurance', 'Internet & Phone', 'Equipment', 'Packaging', 'Cleaning', 'Security', 'Miscellaneous', 'Custom', 'Other'];

const INCOME_SOURCES = ['Sales', 'Interest', 'Rent Income', 'Commission', 'Refund', 'Insurance Claim', 'Asset Sale', 'Sponsorship', 'Other Income', 'Custom', 'Other'];
const emptyExpenseForm = { title: '', category: 'Utilities', customCategory: '', amount: '', date: new Date().toISOString().split('T')[0], status: 'Pending', notes: '' };
const emptyIncomeForm = { title: '', source: 'Other', customSource: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' };

const AdminExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expenses');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyExpenseForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [incomeSourceFilter, setIncomeSourceFilter] = useState('all');

  const fetchData = async () => {
    try {
      const [expRes, sumRes, incRes] = await Promise.all([getExpenses(), getExpenseSummary(), getAdditionalIncomes()]);
      setExpenses(expRes.data);
      setSummary(sumRes.data);
      setIncomes(incRes.data || []);
    } catch (err) {
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(activeTab === 'expenses' ? emptyExpenseForm : emptyIncomeForm);
    setShowModal(true);
  };
  const openEdit = (exp) => {
    setEditingId(exp._id);
    if (activeTab === 'expenses') {
      setForm({ title: exp.title, category: exp.category, amount: exp.amount, date: exp.date?.split('T')[0] || '', status: exp.status, notes: exp.notes || '' });
    } else {
      setForm({ title: exp.title, source: exp.source || 'Other', amount: exp.amount, date: exp.date?.split('T')[0] || '', notes: exp.notes || '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (activeTab === 'expenses') {
        if (editingId) {
          await updateExpense(editingId, payload);
          toast.success('Expense updated');
        } else {
          await createExpense(payload);
          toast.success('Expense added');
        }
      } else {
        if (editingId) {
          await updateAdditionalIncome(editingId, payload);
          toast.success('Income updated');
        } else {
          await addAdditionalIncome(payload);
          toast.success('Income added');
        }
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete this ${activeTab === 'expenses' ? 'expense' : 'income'}?`)) return;
    try {
      if (activeTab === 'expenses') {
        await deleteExpense(id);
        toast.success('Expense deleted');
      } else {
        await deleteAdditionalIncome(id);
        toast.success('Income deleted');
      }
      fetchData();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const filtered = expenses.filter(e => {
    const matchSearch = e.title?.toLowerCase().includes(search.toLowerCase()) || e.notes?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || e.category === catFilter;
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });
  const filteredIncomes = incomes.filter((i) => {
    const matchSearch = i.title?.toLowerCase().includes(search.toLowerCase()) || i.notes?.toLowerCase().includes(search.toLowerCase());
    const matchSource = incomeSourceFilter === 'all' || i.source === incomeSourceFilter;
    return matchSearch && matchSource;
  });

  const expenseExportColumns = [
    { label: 'Title', accessor: 'title' },
    { label: 'Category', accessor: 'category' },
    { label: 'Amount (Rs.)', accessor: (r) => r.amount?.toFixed(2) },
    { label: 'Date', accessor: (r) => new Date(r.date).toLocaleDateString() },
    { label: 'Status', accessor: 'status' },
    { label: 'Notes', accessor: 'notes' },
  ];
  const incomeExportColumns = [
    { label: 'Title', accessor: 'title' },
    { label: 'Source', accessor: 'source' },
    { label: 'Amount (Rs.)', accessor: (r) => r.amount?.toFixed(2) },
    { label: 'Date', accessor: (r) => new Date(r.date).toLocaleDateString() },
    { label: 'Notes', accessor: 'notes' },
  ];

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} title="Admin Panel">
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-green border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={navItems} title="Admin Panel">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-dark-navy">💰 Expense Management</h1>
            <p className="text-muted-text text-sm mt-1">{expenses.length} expenses tracked</p>
          </div>
          <div className="flex gap-2">
            <div className="relative group">
              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                <FileDown size={16} /> Export ▾
              </button>
              <div className="hidden group-hover:block absolute right-0 mt-1 bg-white rounded-xl shadow-xl border border-card-border z-20 min-w-[140px]">
                <button onClick={() => exportToCSV(activeTab === 'expenses' ? filtered : filteredIncomes, activeTab === 'expenses' ? expenseExportColumns : incomeExportColumns, activeTab)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-t-xl">📄 CSV</button>
                <button onClick={() => exportToExcel(activeTab === 'expenses' ? filtered : filteredIncomes, activeTab === 'expenses' ? expenseExportColumns : incomeExportColumns, activeTab)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50">📊 Excel</button>
                <button onClick={() => exportToPDF(activeTab === 'expenses' ? filtered : filteredIncomes, activeTab === 'expenses' ? expenseExportColumns : incomeExportColumns, activeTab === 'expenses' ? 'Expense Report' : 'Income Report')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 rounded-b-xl">📋 PDF</button>
              </div>
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 bg-primary-green text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all text-sm">
              <Plus size={18} /> Add {activeTab === 'expenses' ? 'Expense' : 'Income'}
            </button>
          </div>
        </div>
        <div className="flex gap-2 mb-5">
          {['expenses', 'incomes'].map((t) => (
            <button
              key={t}
              onClick={() => {
                setActiveTab(t);
                setEditingId(null);
                setShowModal(false);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                activeTab === t ? 'bg-primary-green text-white' : 'bg-white border border-card-border text-muted-text hover:bg-gray-50'
              }`}
            >
              {t === 'expenses' ? 'Expenses' : 'Incomes'}
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        {summary && activeTab === 'expenses' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
              <p className="text-xs text-muted-text">Total Expenses</p>
              <p className="text-2xl font-bold text-dark-navy mt-1">Rs. {summary.totalExpenses?.toLocaleString()}</p>
              <p className="text-xs text-muted-text mt-1">{summary.totalCount} records</p>
            </div>
            <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
              <p className="text-xs text-muted-text">Paid</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">Rs. {summary.paidExpenses?.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
              <p className="text-xs text-muted-text">Pending</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">Rs. {summary.pendingExpenses?.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
              <p className="text-xs text-muted-text">Top Category</p>
              <p className="text-lg font-bold text-dark-navy mt-1">
                {summary.byCategory ? Object.entries(summary.byCategory).sort((a, b) => b[1].total - a[1].total)[0]?.[0] || 'N/A' : 'N/A'}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder={`Search ${activeTab}...`} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-card-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
          </div>
          {activeTab === 'expenses' ? (
            <>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
                className="border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green bg-white">
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green bg-white">
                <option value="all">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </>
          ) : (
            <select value={incomeSourceFilter} onChange={(e) => setIncomeSourceFilter(e.target.value)}
              className="border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green bg-white">
              <option value="all">All Sources</option>
              {INCOME_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-2xl border border-card-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-3 font-medium text-muted-text">Title</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-text">{activeTab === 'expenses' ? 'Category' : 'Source'}</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-text">Amount</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-text">Date</th>
                  {activeTab === 'expenses' && <th className="text-left px-6 py-3 font-medium text-muted-text">Status</th>}
                  <th className="text-right px-6 py-3 font-medium text-muted-text">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {(activeTab === 'expenses' ? filtered : filteredIncomes).map((exp) => (
                  <tr key={exp._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-dark-navy">{exp.title}</p>
                      {exp.notes && <p className="text-xs text-muted-text mt-0.5 truncate max-w-[200px]">{exp.notes}</p>}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">{activeTab === 'expenses' ? exp.category : exp.source}</span>
                    </td>
                    <td className={`px-6 py-3.5 font-semibold ${activeTab === 'expenses' ? 'text-dark-navy' : 'text-emerald-600'}`}>Rs. {exp.amount?.toLocaleString()}</td>
                    <td className="px-6 py-3.5 text-muted-text">{new Date(exp.date).toLocaleDateString()}</td>
                    {activeTab === 'expenses' && (
                      <td className="px-6 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${exp.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {exp.status}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(exp)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"><Edit2 size={15} /></button>
                        <button onClick={() => handleDelete(exp._id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(activeTab === 'expenses' ? filtered : filteredIncomes).length === 0 && (
              <div className="text-center py-12 text-muted-text text-sm">No {activeTab} found</div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-dark-navy">{editingId ? `Edit ${activeTab === 'expenses' ? 'Expense' : 'Income'}` : `Add ${activeTab === 'expenses' ? 'Expense' : 'Income'}`}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Title *</label>
                <input required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})}
                  placeholder="e.g. Monthly electricity bill" className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {activeTab === 'expenses' ? (
                  <div>
                    <label className="block text-sm font-medium text-dark-navy mb-1">Category *</label>
                    <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}
                      className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-dark-navy mb-1">Source *</label>
                    <select value={form.source} onChange={(e) => setForm({...form, source: e.target.value})}
                      className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green">
                      {INCOME_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-dark-navy mb-1">Amount (Rs.) *</label>
                  <input type="number" required min="0" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})}
                    placeholder="0.00" className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-navy mb-1">Date *</label>
                  <input type="date" required value={form.date} onChange={(e) => setForm({...form, date: e.target.value})}
                    className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                </div>
                {activeTab === 'expenses' && (
                  <div>
                    <label className="block text-sm font-medium text-dark-navy mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}
                      className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green">
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} rows={2}
                  placeholder="Optional notes..." className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-primary-green text-white py-2.5 rounded-xl font-semibold hover:bg-emerald-600 transition-all disabled:opacity-50 text-sm">
                  {saving ? 'Saving...' : editingId ? 'Update' : `Add ${activeTab === 'expenses' ? 'Expense' : 'Income'}`}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-card-border py-2.5 rounded-xl font-semibold text-muted-text hover:bg-gray-50 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminExpenses;

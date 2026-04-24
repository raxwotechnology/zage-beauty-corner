import { useState, useEffect } from 'react';
import { Clock, Plus, DollarSign, User, CheckCircle, Trash2, X, Download, Search, ChevronRight, ArrowLeft } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import adminNavItems from './adminNavItems';
import { getOvertimeSummary, getOvertimeRecords, createOvertimeRecord, markOvertimePaid, rejectOvertimeRecord, deleteOvertimeRecord, getEmployeeOTReport } from '../../services/api';
import API from '../../services/api';
import { toast } from 'react-toastify';

const AdminOvertime = () => {
  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employeeId: '', date: new Date().toISOString().split('T')[0], hours: '', ratePerHour: '', description: '' });
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [empReport, setEmpReport] = useState(null);
  const [empReportLoading, setEmpReportLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateRange.startDate) params.startDate = dateRange.startDate;
      if (dateRange.endDate) params.endDate = dateRange.endDate;
      const [sumRes, recRes] = await Promise.all([
        getOvertimeSummary(params),
        getOvertimeRecords(params),
      ]);
      setSummary(sumRes.data);
      setRecords(recRes.data);
    } catch (err) {
      toast.error('Failed to load OT data');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await API.get('/admin/users');
      setEmployees((data || []).filter(u => ['cashier', 'manager', 'deliveryGuy', 'stockEmployee'].includes(u.role)));
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchData(); fetchEmployees(); }, []);
  useEffect(() => { fetchData(); }, [dateRange.startDate, dateRange.endDate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createOvertimeRecord({
        ...form,
        hours: Number(form.hours),
        ratePerHour: Number(form.ratePerHour),
      });
      toast.success('OT record created');
      setShowModal(false);
      setForm({ employeeId: '', date: new Date().toISOString().split('T')[0], hours: '', ratePerHour: '', description: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create OT record');
    }
  };

  const handlePay = async (id) => {
    try {
      await markOvertimePaid(id);
      toast.success('Marked as paid');
      fetchData();
      if (selectedEmployee) viewEmployeeReport(selectedEmployee);
    } catch (err) { toast.error('Failed to mark as paid'); }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Reject this OT request?')) return;
    try {
      await rejectOvertimeRecord(id);
      toast.success('OT request rejected');
      fetchData();
      if (selectedEmployee) viewEmployeeReport(selectedEmployee);
    } catch (err) { toast.error('Failed to reject OT'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this OT record?')) return;
    try {
      await deleteOvertimeRecord(id);
      toast.success('Deleted');
      fetchData();
      if (selectedEmployee) viewEmployeeReport(selectedEmployee);
    } catch (err) { toast.error('Failed to delete'); }
  };

  const viewEmployeeReport = async (empId) => {
    setSelectedEmployee(empId);
    setEmpReportLoading(true);
    try {
      const params = {};
      if (dateRange.startDate) params.startDate = dateRange.startDate;
      if (dateRange.endDate) params.endDate = dateRange.endDate;
      const { data } = await getEmployeeOTReport(empId, params);
      setEmpReport(data);
    } catch (err) {
      toast.error('Failed to load report');
    } finally {
      setEmpReportLoading(false);
    }
  };

  const exportCSV = () => {
    const rows = [['Employee', 'Date', 'Hours', 'Rate/Hr', 'Amount', 'Status', 'Description']];
    records.forEach(r => {
      rows.push([
        r.employeeId?.name || 'Unknown',
        new Date(r.date).toLocaleDateString(),
        r.hours, r.ratePerHour, r.totalAmount,
        r.status, r.description || '',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ot_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('OT report exported!');
  };

  const totalOT = summary.reduce((s, r) => s + r.totalAmount, 0);
  const totalPaid = summary.reduce((s, r) => s + r.paidAmount, 0);
  const totalPending = summary.reduce((s, r) => s + r.pendingAmount, 0);
  const totalHours = summary.reduce((s, r) => s + r.totalHours, 0);

  const filteredRecords = records.filter(r =>
    r.employeeId?.name?.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout navItems={adminNavItems} title="Admin Panel">
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={adminNavItems} title="Admin Panel">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-dark-navy">⏰ Overtime Pay Management</h1>
            <p className="text-muted-text text-sm mt-1">Track and pay employee overtime</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <input type="date" value={dateRange.startDate} onChange={e => setDateRange(r => ({ ...r, startDate: e.target.value }))} className="border border-card-border rounded-xl py-2 px-3 text-sm bg-white" />
            <input type="date" value={dateRange.endDate} onChange={e => setDateRange(r => ({ ...r, endDate: e.target.value }))} className="border border-card-border rounded-xl py-2 px-3 text-sm bg-white" />
            <button onClick={exportCSV} className="flex items-center gap-2 border border-card-border text-dark-navy px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50">
              <Download size={16} /> Export
            </button>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-rose-600 shadow-lg shadow-rose-200">
              <Plus size={16} /> Add OT
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-fuchsia-500 flex items-center justify-center mb-2">
              <Clock size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-dark-navy">{totalHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-text mt-1">Total OT Hours</p>
          </div>
          <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mb-2">
              <DollarSign size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-dark-navy">Rs. {totalOT.toLocaleString()}</p>
            <p className="text-xs text-muted-text mt-1">Total OT Amount</p>
          </div>
          <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-2">
              <CheckCircle size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-green-600">Rs. {totalPaid.toLocaleString()}</p>
            <p className="text-xs text-muted-text mt-1">Paid</p>
          </div>
          <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-2">
              <DollarSign size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-amber-600">Rs. {totalPending.toLocaleString()}</p>
            <p className="text-xs text-muted-text mt-1">Pending</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'summary', label: 'Employee Summary' },
            { key: 'records', label: 'All Records' },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelectedEmployee(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t.key ? 'bg-rose-500 text-white' : 'bg-white border border-card-border text-muted-text hover:bg-rose-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Employee Report View */}
        {selectedEmployee && empReport && (
          <div className="bg-white rounded-2xl border border-card-border p-6 shadow-sm mb-6">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => { setSelectedEmployee(null); setEmpReport(null); }} className="p-2 rounded-xl hover:bg-gray-100">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-lg font-bold text-dark-navy">{empReport.employee?.name}'s OT Report</h2>
                <p className="text-xs text-muted-text">{empReport.employee?.email} · {empReport.employee?.role}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-rose-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-rose-600">{empReport.summary.totalHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-text">Total Hours</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-blue-600">Rs. {empReport.summary.totalAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-text">Total Amount</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-green-600">Rs. {empReport.summary.paidAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-text">Paid</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-amber-600">Rs. {empReport.summary.pendingAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-text">Pending</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left py-2 px-3 text-muted-text text-xs uppercase font-semibold">Date</th>
                    <th className="text-right py-2 px-3 text-muted-text text-xs uppercase font-semibold">Hours</th>
                    <th className="text-right py-2 px-3 text-muted-text text-xs uppercase font-semibold">Rate/Hr</th>
                    <th className="text-right py-2 px-3 text-muted-text text-xs uppercase font-semibold">Amount</th>
                    <th className="text-center py-2 px-3 text-muted-text text-xs uppercase font-semibold">Status</th>
                    <th className="text-right py-2 px-3 text-muted-text text-xs uppercase font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(empReport.records || []).map(r => (
                    <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-medium">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right">{r.hours}h</td>
                      <td className="py-2.5 px-3 text-right">Rs. {r.ratePerHour}</td>
                      <td className="py-2.5 px-3 text-right font-bold">Rs. {r.totalAmount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.status === 'paid' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          {r.status === 'pending' && (
                            <>
                              <button onClick={() => handlePay(r._id)} className="px-2 py-1 rounded-lg bg-green-50 text-green-600 text-xs font-semibold hover:bg-green-100">Pay</button>
                              <button onClick={() => handleReject(r._id)} className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100">Reject</button>
                            </>
                          )}
                          <button onClick={() => handleDelete(r._id)} className="p-1 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary Tab */}
        {tab === 'summary' && !selectedEmployee && (
          <div className="bg-white rounded-2xl border border-card-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-card-border">
              <h2 className="font-semibold text-dark-navy">Employee OT Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border bg-gray-50/50">
                    <th className="text-left py-3 px-4 text-muted-text text-xs uppercase font-semibold">Employee</th>
                    <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Total Hours</th>
                    <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Total OT</th>
                    <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Paid</th>
                    <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Pending</th>
                    <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Records</th>
                    <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 text-xs font-bold">
                            {s.employee?.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-dark-navy text-sm">{s.employee?.name}</p>
                            <p className="text-xs text-muted-text capitalize">{s.employee?.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{s.totalHours.toFixed(1)}h</td>
                      <td className="py-3 px-4 text-right font-bold text-dark-navy">Rs. {s.totalAmount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-green-600 font-semibold">Rs. {s.paidAmount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-amber-600 font-semibold">Rs. {s.pendingAmount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{s.recordCount}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => viewEmployeeReport(s.employeeId)} className="text-rose-500 hover:text-rose-700 flex items-center gap-1 ml-auto text-xs font-semibold">
                          View <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {summary.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-muted-text">No OT records found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Records Tab */}
        {tab === 'records' && (
          <div>
            <div className="relative mb-4">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input placeholder="Search by employee name..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-96 border border-card-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
            <div className="bg-white rounded-2xl border border-card-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border bg-gray-50/50">
                      <th className="text-left py-3 px-4 text-muted-text text-xs uppercase font-semibold">Employee</th>
                      <th className="text-left py-3 px-4 text-muted-text text-xs uppercase font-semibold">Date</th>
                      <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Hours</th>
                      <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Rate</th>
                      <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Amount</th>
                      <th className="text-center py-3 px-4 text-muted-text text-xs uppercase font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-muted-text text-xs uppercase font-semibold">Note</th>
                      <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(r => (
                      <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-semibold text-dark-navy">{r.employeeId?.name || 'Unknown'}</td>
                        <td className="py-3 px-4 text-muted-text">{new Date(r.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right">{r.hours}h</td>
                        <td className="py-3 px-4 text-right">Rs. {r.ratePerHour}</td>
                        <td className="py-3 px-4 text-right font-bold">Rs. {r.totalAmount.toLocaleString()}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${r.status === 'paid' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-text max-w-[150px] truncate">{r.description || '—'}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1">
                            {r.status === 'pending' && (
                              <>
                                <button onClick={() => handlePay(r._id)} className="px-2.5 py-1 rounded-lg bg-green-50 text-green-600 text-xs font-semibold hover:bg-green-100">Pay</button>
                                <button onClick={() => handleReject(r._id)} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100">Reject</button>
                              </>
                            )}
                            <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRecords.length === 0 && (
                      <tr><td colSpan={8} className="py-12 text-center text-muted-text">No OT records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create OT Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-dark-navy">Add Overtime Record</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Employee *</label>
                <select required value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm bg-white">
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Date *</label>
                <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-navy mb-1">OT Hours *</label>
                  <input type="number" step="0.5" min="0.5" required value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} placeholder="e.g. 2.5" className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-navy mb-1">Rate Per Hour (Rs.) *</label>
                  <input type="number" min="1" required value={form.ratePerHour} onChange={e => setForm({ ...form, ratePerHour: e.target.value })} placeholder="e.g. 250" className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm" />
                </div>
              </div>
              {form.hours && form.ratePerHour && (
                <div className="bg-rose-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-text">Total OT Pay</p>
                  <p className="text-xl font-bold text-rose-600">Rs. {(Number(form.hours) * Number(form.ratePerHour)).toLocaleString()}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Weekend shift, Holiday work" className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-rose-500 text-white py-2.5 rounded-xl font-semibold hover:bg-rose-600 text-sm">Create OT Record</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-card-border py-2.5 rounded-xl font-semibold text-muted-text hover:bg-gray-50 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminOvertime;

import { useState, useEffect } from 'react';
import { Calendar, Check, X, Clock, FileText, FileSpreadsheet } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { toast } from 'react-toastify';
import managerNavItems from './managerNavItems';
import { getEmployees, adminCreateLeave } from '../../services/api';
import API from '../../services/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const ManagerLeaves = ({ navItems = managerNavItems, title = 'Manager Dashboard' }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ employeeId: '', type: 'casual', startDate: '', endDate: '', reason: '', status: 'approved' });
  const [requesting, setRequesting] = useState(false);
  const [requestForm, setRequestForm] = useState({
    leaveType: 'annual',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => { fetchLeaves(); }, []);

  const fetchLeaves = async () => {
    try {
      const [leavesRes, empRes] = await Promise.all([
        API.get('/hr/leaves/store'),
        getEmployees(),
      ]);
      setLeaves(leavesRes.data);
      setEmployees(empRes.data);
    } catch (err) {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeave = async () => {
    if (!leaveForm.employeeId || !leaveForm.startDate || !leaveForm.endDate) return toast.error('Fill all fields');
    try {
      await adminCreateLeave(leaveForm);
      toast.success('Leave created');
      setShowLeaveModal(false);
      fetchLeaves();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleApprove = async (id) => {
    try {
      await API.put(`/hr/leaves/${id}/approve`);
      toast.success('Leave approved');
      fetchLeaves();
    } catch (err) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await API.put(`/hr/leaves/${id}/reject`, { reason });
      toast.success('Leave rejected');
      fetchLeaves();
    } catch (err) {
      toast.error('Failed to reject');
    }
  };

  const filtered = leaves.filter((l) => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (roleFilter !== 'all' && l.employeeId?.role !== roleFilter) return false;
    if (deptFilter !== 'all' && (l.employeeId?.employeeInfo?.department || 'Unassigned') !== deptFilter) return false;
    return true;
  });

  const exportExcel = () => {
    const rows = filtered.map(l => ({
      Employee: l.employeeId?.name || 'Unknown',
      Role: l.employeeId?.role || 'N/A',
      Department: l.employeeId?.employeeInfo?.department || 'Unassigned',
      Type: l.leaveType,
      'Start Date': new Date(l.startDate).toLocaleDateString(),
      'End Date': new Date(l.endDate).toLocaleDateString(),
      Days: l.totalDays,
      Status: l.status,
      Reason: l.reason || ''
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Leaves');
    XLSX.writeFile(workbook, 'leaves_report.xlsx');
    toast.success('Excel exported');
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.text('Leave Requests Report', 14, 15);
    doc.autoTable({
      head: [['Employee', 'Role', 'Department', 'Type', 'Dates', 'Days', 'Status']],
      body: filtered.map(l => [
        l.employeeId?.name || 'Unknown',
        l.employeeId?.role || 'N/A',
        l.employeeId?.employeeInfo?.department || 'Unassigned',
        l.leaveType,
        `${new Date(l.startDate).toLocaleDateString()} - ${new Date(l.endDate).toLocaleDateString()}`,
        l.totalDays,
        l.status
      ]),
      startY: 20
    });
    doc.save('leaves_report.pdf');
    toast.success('PDF exported');
  };

  const handleCreateLeaveRequest = async (e) => {
    e.preventDefault();
    if (!requestForm.startDate || !requestForm.endDate || !requestForm.reason.trim()) {
      toast.error('Please fill all leave request fields');
      return;
    }
    try {
      setRequesting(true);
      await API.post('/hr/leaves', {
        leaveType: requestForm.leaveType,
        startDate: requestForm.startDate,
        endDate: requestForm.endDate,
        reason: requestForm.reason.trim(),
      });
      toast.success('Leave request sent to admin');
      setRequestForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '' });
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} title={title}>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-green border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={navItems} title={title}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-dark-navy mb-2">📅 Leave Management</h1>
            <p className="text-muted-text text-sm">{leaves.filter((l) => l.status === 'pending').length} pending requests</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowLeaveModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
              <Calendar size={16} /> Add Leave
            </button>
            <button onClick={exportExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            <button onClick={exportPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
              <FileText size={16} /> Export PDF
            </button>
          </div>
        </div>

        {/* ... form code ... */}
        <form onSubmit={handleCreateLeaveRequest} className="bg-white rounded-2xl border border-card-border p-4 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-dark-navy mb-3">Request My Leave (to Admin)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={requestForm.leaveType}
              onChange={(e) => setRequestForm((prev) => ({ ...prev, leaveType: e.target.value }))}
              className="px-3 py-2.5 rounded-xl border border-card-border text-sm"
            >
              {['annual', 'sick', 'casual', 'maternity', 'paternity', 'unpaid'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="date"
              value={requestForm.startDate}
              onChange={(e) => setRequestForm((prev) => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-2.5 rounded-xl border border-card-border text-sm"
            />
            <input
              type="date"
              value={requestForm.endDate}
              onChange={(e) => setRequestForm((prev) => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-2.5 rounded-xl border border-card-border text-sm"
            />
            <button
              type="submit"
              disabled={requesting}
              className="px-4 py-2.5 rounded-xl bg-primary-green text-white text-sm font-semibold disabled:opacity-60"
            >
              {requesting ? 'Submitting...' : 'Submit Leave'}
            </button>
          </div>
          <textarea
            value={requestForm.reason}
            onChange={(e) => setRequestForm((prev) => ({ ...prev, reason: e.target.value }))}
            rows={2}
            placeholder="Reason"
            className="mt-3 w-full px-3 py-2.5 rounded-xl border border-card-border text-sm"
          />
        </form>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-card-border p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-amber-600">{leaves.filter(l => l.status === 'pending').length}</p>
            <p className="text-xs text-muted-text">Pending</p>
          </div>
          <div className="bg-white rounded-2xl border border-card-border p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-emerald-600">{leaves.filter(l => l.status === 'approved').length}</p>
            <p className="text-xs text-muted-text">Approved</p>
          </div>
          <div className="bg-white rounded-2xl border border-card-border p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-red-500">{leaves.filter(l => l.status === 'rejected').length}</p>
            <p className="text-xs text-muted-text">Rejected</p>
          </div>
          <div className="bg-white rounded-2xl border border-card-border p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-dark-navy">{leaves.filter(l => l.status === 'approved').reduce((s, l) => s + (l.totalDays || 0), 0)}</p>
            <p className="text-xs text-muted-text">Total Days Used</p>
          </div>
        </div>

        {/* Filter Tabs & Selects */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'approved', 'rejected'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  filter === s ? 'bg-primary-green text-white' : 'bg-gray-100 text-muted-text hover:bg-gray-200'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)} ({s === 'all' ? leaves.length : leaves.filter(l => l.status === s).length})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-card-border rounded-xl text-sm outline-none"
            >
              <option value="all">All Roles</option>
              <option value="cashier">Cashier</option>
              <option value="deliveryGuy">Delivery</option>
              <option value="stockEmployee">Stock</option>
              <option value="manager">Manager</option>
            </select>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-card-border rounded-xl text-sm outline-none"
            >
              <option value="all">All Departments</option>
              {Array.from(new Set(leaves.map(l => l.employeeId?.employeeInfo?.department || 'Unassigned'))).filter(Boolean).map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-card-border p-12 text-center text-muted-text">
            <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No leave requests found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((leave) => (
              <div key={leave._id} className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {leave.employeeId?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-dark-navy text-sm">{leave.employeeId?.name}</h3>
                      <p className="text-xs text-muted-text">{leave.employeeId?.role} • {leave.leaveType} leave</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[leave.status]}`}>
                      {leave.status}
                    </span>
                    {leave.status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(leave._id)} className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                          <Check size={16} />
                        </button>
                        <button onClick={() => handleReject(leave._id)} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                          <X size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-text">
                  <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(leave.startDate).toLocaleDateString()} — {new Date(leave.endDate).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {leave.totalDays} day{leave.totalDays > 1 ? 's' : ''}</span>
                </div>
                {leave.reason && <p className="text-xs text-muted-text mt-2 bg-gray-50 rounded-lg p-2">{leave.reason}</p>}
                {leave.rejectionReason && <p className="text-xs text-red-500 mt-2 bg-red-50 rounded-lg p-2">Rejected: {leave.rejectionReason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-card-border">
              <h2 className="text-lg font-bold text-dark-navy flex items-center gap-2"><Calendar size={20} className="text-amber-500" /> Create Leave</h2>
              <button onClick={() => setShowLeaveModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-muted-text block mb-1">Employee *</label>
                <select value={leaveForm.employeeId} onChange={(e) => setLeaveForm({...leaveForm, employeeId: e.target.value})}
                  className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">Select employee</option>
                  {employees.map(e => <option key={e._id} value={e._id}>{e.name} ({e.role})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-text block mb-1">Leave Type</label>
                  <select value={leaveForm.type} onChange={(e) => setLeaveForm({...leaveForm, type: e.target.value})}
                    className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm bg-white">
                    <option value="casual">Casual</option>
                    <option value="sick">Sick</option>
                    <option value="annual">Annual</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-text block mb-1">Status</label>
                  <select value={leaveForm.status} onChange={(e) => setLeaveForm({...leaveForm, status: e.target.value})}
                    className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm bg-white">
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-text block mb-1">Start Date *</label>
                  <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({...leaveForm, startDate: e.target.value})}
                    className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-text block mb-1">End Date *</label>
                  <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({...leaveForm, endDate: e.target.value})}
                    className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-text block mb-1">Reason</label>
                <input value={leaveForm.reason} onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
                  className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm" placeholder="Reason for leave" />
              </div>
              <button onClick={handleAddLeave} className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-semibold">
                Create Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ManagerLeaves;

import { useState, useEffect, useMemo } from 'react';
import { Download, FileText, FileSpreadsheet, Filter, Store as StoreIcon, Clock, CheckCircle, X } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { getAttendanceReport, getEmployees, getStores, adminMarkAttendance } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'react-toastify';
import adminNavItems from './adminNavItems';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const now = new Date();

const AdminAttendance = () => {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('All');
  
  const [showAttModal, setShowAttModal] = useState(false);
  const [attForm, setAttForm] = useState({ employeeId: '', date: new Date().toISOString().split('T')[0], checkInTime: '09:00', checkOutTime: '17:00', status: 'present', notes: '' });


  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { month, year };
      if (selectedStore !== 'All') params.storeId = selectedStore;
      
      const [attRes, empRes, storeRes] = await Promise.all([
        getAttendanceReport(params),
        getEmployees(),
        getStores(),
      ]);
      setRecords(attRes.data);
      setEmployees(empRes.data);
      setStores(storeRes.data || []);
    } catch (err) { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  };

  const handleMarkAtt = async () => {
    if (!attForm.employeeId) return toast.error('Select employee');
    try {
      const dateStr = attForm.date;
      await adminMarkAttendance({
        employeeId: attForm.employeeId,
        date: dateStr,
        checkInTime: `${dateStr}T${attForm.checkInTime}:00`,
        checkOutTime: `${dateStr}T${attForm.checkOutTime}:00`,
        status: attForm.status,
        notes: attForm.notes,
      });
      toast.success('Attendance marked');
      setShowAttModal(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  useEffect(() => {
    fetchData();
  }, [month, year, selectedStore]);

  const departments = useMemo(() => {
    const deps = new Set(employees.map(e => e.employeeInfo?.department).filter(Boolean));
    return ['All', ...Array.from(deps)];
  }, [employees]);

  const roles = useMemo(() => {
    const rs = new Set(employees.map(e => e.role).filter(Boolean));
    return ['All', ...Array.from(rs)];
  }, [employees]);

  // Group by employee
  const summaryData = useMemo(() => {
    const byEmployee = {};
    
    // Initialize all employees to 0 first so they appear even if no attendance
    employees.forEach(e => {
      byEmployee[e._id] = {
        name: e.name,
        role: e.role || '',
        department: e.employeeInfo?.department || '',
        present: 0, absent: 0, leave: 0, late: 0, totalHours: 0, overtime: 0
      };
    });

    records.forEach(r => {
      const id = r.employeeId?._id || r.employeeId;
      if (!byEmployee[id]) {
        byEmployee[id] = { name: r.employeeId?.name || 'Unknown', role: r.employeeId?.role || '', department: '', present: 0, absent: 0, leave: 0, late: 0, totalHours: 0, overtime: 0 };
      }
      if (r.status === 'present') { byEmployee[id].present++; byEmployee[id].totalHours += r.hoursWorked || 0; byEmployee[id].overtime += r.overtime || 0; }
      else if (r.status === 'leave') byEmployee[id].leave++;
      else if (r.status === 'absent') byEmployee[id].absent++;
      if (r.checkIn) { const h = new Date(r.checkIn).getHours(); if (h >= 9) byEmployee[id].late++; }
    });

    return Object.entries(byEmployee)
      .map(([id, d]) => ({ ...d, id }))
      .filter(e => (selectedRole === 'All' || e.role === selectedRole) && (selectedDepartment === 'All' || e.department === selectedDepartment))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [records, employees, selectedRole, selectedDepartment]);

  // Chart data
  const chartData = summaryData.map(e => ({ name: e.name.split(' ')[0], present: e.present, leave: e.leave, absent: e.absent }));

  const exportExcel = () => {
    const rows = summaryData.map(e => ({
      Employee: e.name,
      Role: e.role,
      Department: e.department,
      Present: e.present,
      Leave: e.leave,
      Absent: e.absent,
      Late: e.late,
      'Total Hours': e.totalHours.toFixed(1),
      Overtime: e.overtime.toFixed(1)
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance Report');
    XLSX.writeFile(workbook, `attendance_${month}_${year}.xlsx`);
    toast.success('Excel downloaded');
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Attendance Report - ${month}/${year}`, 14, 15);
    const head = [['Employee', 'Role', 'Department', 'Present', 'Leave', 'Absent', 'Late', 'Hours', 'Overtime']];
    const body = summaryData.map(e => [e.name, e.role, e.department, e.present, e.leave, e.absent, e.late, e.totalHours.toFixed(1), e.overtime.toFixed(1)]);
    
    doc.autoTable({
      head,
      body,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    doc.save(`attendance_${month}_${year}.pdf`);
    toast.success('PDF downloaded');
  };

  if (loading) return <DashboardLayout navItems={adminNavItems} title="Admin Dashboard"><div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-primary-green border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout navItems={adminNavItems} title="Admin Dashboard">
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div><h1 className="text-2xl font-bold text-dark-navy">📋 All Employees Attendance</h1><p className="text-muted-text text-sm mt-1">{summaryData.length} employees found for {month}/{year}</p></div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setShowAttModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"><Clock size={16} /> Mark Attendance</button>
            <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"><FileSpreadsheet size={16} /> Excel</button>
            <button onClick={exportPDF} className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"><FileText size={16} /> PDF</button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-muted-text uppercase tracking-wider mb-2">Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full border border-card-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green">
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en', { month: 'long' })}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-text uppercase tracking-wider mb-2">Year</label>
            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24 border border-card-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-text uppercase tracking-wider mb-2">Department</label>
            <select value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)} className="w-40 border border-card-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green">
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-text uppercase tracking-wider mb-2 text-primary-green">Store</label>
            <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="w-40 border border-card-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green bg-white shadow-sm font-medium">
              <option value="All">All Stores</option>
              {stores.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-text uppercase tracking-wider mb-2">Role</label>
            <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="w-40 border border-card-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green bg-white shadow-sm">
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* Attendance Chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-card-border p-6 shadow-sm mb-6">
            <h2 className="font-semibold text-dark-navy mb-4">📊 Attendance Overview</h2>
            <div className="overflow-x-auto overflow-y-hidden w-full custom-scrollbar">
              <div style={{ minWidth: `${Math.max(chartData.length * 60, 600)}px`, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="present" fill="#10b981" name="Present" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="leave" fill="#f59e0b" name="Leave" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Summary Table */}
        <div className="bg-white rounded-2xl border border-card-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-muted-text">Employee</th>
                <th className="text-center px-3 py-3 font-medium text-muted-text">Role/Dept</th>
                <th className="text-center px-3 py-3 font-medium text-emerald-600">Present</th>
                <th className="text-center px-3 py-3 font-medium text-amber-600">Leave</th>
                <th className="text-center px-3 py-3 font-medium text-red-500">Absent</th>
                <th className="text-center px-3 py-3 font-medium text-orange-500">Late</th>
                <th className="text-center px-3 py-3 font-medium text-blue-600">Hours</th>
                <th className="text-center px-3 py-3 font-medium text-purple-600">Overtime</th>
              </tr></thead>
              <tbody className="divide-y divide-card-border">
                {summaryData.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-text">No attendance records found</td></tr>
                ) : summaryData.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-dark-navy">{e.name}</td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] uppercase font-bold text-gray-500">{e.role}</span>
                        {e.department && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{e.department}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-600">{e.present}</td>
                    <td className="px-3 py-3 text-center font-bold text-amber-600">{e.leave}</td>
                    <td className="px-3 py-3 text-center font-bold text-red-500">{e.absent}</td>
                    <td className="px-3 py-3 text-center font-bold text-orange-500">{e.late}</td>
                    <td className="px-3 py-3 text-center font-bold text-blue-600">{e.totalHours.toFixed(1)}h</td>
                    <td className="px-3 py-3 text-center font-bold text-purple-600">{e.overtime.toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mark Attendance Modal */}
      {showAttModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-card-border">
              <h2 className="text-lg font-bold text-dark-navy flex items-center gap-2"><Clock size={20} className="text-blue-600" /> Mark Attendance</h2>
              <button onClick={() => setShowAttModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-muted-text block mb-1">Employee *</label>
                <select value={attForm.employeeId} onChange={(e) => setAttForm({...attForm, employeeId: e.target.value})}
                  className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">Select employee</option>
                  {employees.map(e => <option key={e._id} value={e._id}>{e.name} ({e.role})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-text block mb-1">Date</label>
                  <input type="date" value={attForm.date} onChange={(e) => setAttForm({...attForm, date: e.target.value})}
                    className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-text block mb-1">Status</label>
                  <select value={attForm.status} onChange={(e) => setAttForm({...attForm, status: e.target.value})}
                    className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm bg-white">
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="half-day">Half Day</option>
                    <option value="late">Late</option>
                    <option value="leave">Leave</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-text block mb-1">Check In</label>
                  <input type="time" value={attForm.checkInTime} onChange={(e) => setAttForm({...attForm, checkInTime: e.target.value})}
                    className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-text block mb-1">Check Out</label>
                  <input type="time" value={attForm.checkOutTime} onChange={(e) => setAttForm({...attForm, checkOutTime: e.target.value})}
                    className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-text block mb-1">Notes</label>
                <input value={attForm.notes} onChange={(e) => setAttForm({...attForm, notes: e.target.value})}
                  className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm" placeholder="Optional notes" />
              </div>
              <button onClick={handleMarkAtt} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold">
                <CheckCircle size={16} className="inline mr-2" />Mark Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminAttendance;

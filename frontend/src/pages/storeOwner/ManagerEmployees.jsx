import { useState, useEffect } from 'react';
import { Users, Search, Edit3, Save, X, UserPlus, Clock, Calendar, CheckCircle } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { getEmployees, addEmployee, updateEmployee, adminMarkAttendance, adminCreateLeave, getAttendanceReport, getStoreLeaves } from '../../services/api';
import { toast } from 'react-toastify';
import managerNavItems from './managerNavItems';
import useAuthStore from '../../store/authStore';



const roleColors = {
  cashier: 'bg-teal-100 text-teal-700',
  deliveryGuy: 'bg-blue-100 text-blue-700',
  stockEmployee: 'bg-purple-100 text-purple-700',
  manager: 'bg-amber-100 text-amber-700',
};

const emptyNewForm = {
  name: '', email: '', password: '', phone: '', role: 'cashier',
  salary: '', department: '', bankAccount: '', bankName: '', epfNo: '', etfNo: '',
};

const ManagerEmployees = ({ navItems = managerNavItems, title = 'Manager Dashboard' }) => {
  const user = useAuthStore((s) => s.user);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newForm, setNewForm] = useState(emptyNewForm);
  const [adding, setAdding] = useState(false);

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try {
      const { data } = await getEmployees({ includeManagers: true });
      setEmployees(data);
    } catch (err) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (emp) => {
    setEditing(emp._id);
    setEditForm({
      salary: emp.employeeInfo?.salary || 0,
      department: emp.employeeInfo?.department || '',
      bankAccount: emp.employeeInfo?.bankAccount || '',
      bankName: emp.employeeInfo?.bankName || '',
      epfNo: emp.employeeInfo?.epfNo || '',
      etfNo: emp.employeeInfo?.etfNo || '',
    });
  };

  const handleSave = async (id) => {
    try {
      await updateEmployee(id, editForm);
      toast.success('Employee updated');
      setEditing(null);
      fetchEmployees();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!newForm.name || !newForm.email || !newForm.password) {
      toast.error('Name, email and password are required');
      return;
    }
    setAdding(true);
    try {
      await addEmployee({
        ...newForm,
        salary: Number(newForm.salary) || 0,
      });
      toast.success('Employee registered successfully!');
      setShowAddModal(false);
      setNewForm(emptyNewForm);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add employee');
    } finally {
      setAdding(false);
    }
  };

  const filtered = employees.filter(
    (e) => e.name?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase())
  );


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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-dark-navy">👥 Employees</h1>
            <p className="text-muted-text text-sm mt-1">{employees.length} staff members</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-primary-green hover:bg-emerald-600 text-white font-medium px-5 py-2.5 rounded-xl transition-colors shadow-md text-sm">
              <UserPlus size={16} /> Add Employee
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-96 border border-card-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
          />
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-card-border">
            <Users size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-semibold text-dark-navy">No employees found</h3>
            <p className="text-muted-text text-sm mt-1">Click "Add Employee" to register your first staff member</p>
          </div>
        )}

        <div className="grid gap-4">
          {filtered.map((emp) => (
            <div key={emp._id} className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
                    {emp.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-dark-navy text-sm">{emp.name}</h3>
                    <p className="text-xs text-muted-text">{emp.email}</p>
                    {emp.phone && <p className="text-xs text-muted-text">📞 {emp.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColors[emp.role] || 'bg-gray-100 text-gray-600'}`}>
                    {emp.role === 'deliveryGuy' ? 'Delivery Rider' : emp.role === 'stockEmployee' ? 'Stock Employee' : emp.role === 'cashier' ? 'Cashier' : emp.role}
                  </span>
                  {emp.assignedStore?.name && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">🏪 {emp.assignedStore.name}</span>
                  )}
                  {editing !== emp._id ? (
                    <button onClick={() => handleEdit(emp)} className="p-2 rounded-lg hover:bg-emerald-50 text-muted-text hover:text-primary-green transition-colors">
                      <Edit3 size={16} />
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button onClick={() => handleSave(emp._id)} className="p-2 rounded-lg bg-emerald-50 text-primary-green"><Save size={16} /></button>
                      <button onClick={() => setEditing(null)} className="p-2 rounded-lg bg-red-50 text-red-500"><X size={16} /></button>
                    </div>
                  )}
                </div>
              </div>

              {editing === emp._id ? (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Salary (LKR)</label>
                    <input type="number" value={editForm.salary} onChange={(e) => setEditForm({...editForm, salary: Number(e.target.value)})}
                      className="w-full border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Department</label>
                    <input value={editForm.department} onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Bank Name</label>
                    <input value={editForm.bankName} onChange={(e) => setEditForm({...editForm, bankName: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Bank Account</label>
                    <input value={editForm.bankAccount} onChange={(e) => setEditForm({...editForm, bankAccount: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">EPF No</label>
                    <input value={editForm.epfNo} onChange={(e) => setEditForm({...editForm, epfNo: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">ETF No</label>
                    <input value={editForm.etfNo} onChange={(e) => setEditForm({...editForm, etfNo: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-text">
                  <span>💰 Rs. {(emp.employeeInfo?.salary || 0).toLocaleString()}</span>
                  <span>🏢 {emp.employeeInfo?.department || '—'}</span>
                  <span>🏦 {emp.employeeInfo?.bankName || '—'}</span>
                  <span>📋 EPF: {emp.employeeInfo?.epfNo || '—'}</span>
                </div>
              )}
            </div>
          ))}
        </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-card-border">
              <h2 className="text-lg font-bold text-dark-navy flex items-center gap-2">
                <UserPlus size={20} className="text-primary-green" /> Register New Employee
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-5 space-y-4">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-dark-navy mb-2">👤 Basic Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-text block mb-1">Full Name *</label>
                    <input required value={newForm.name} onChange={(e) => setNewForm({...newForm, name: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Email *</label>
                    <input required type="email" value={newForm.email} onChange={(e) => setNewForm({...newForm, email: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Password *</label>
                    <input required type="password" value={newForm.password} onChange={(e) => setNewForm({...newForm, password: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" placeholder="Min 6 characters" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Phone</label>
                    <input value={newForm.phone} onChange={(e) => setNewForm({...newForm, phone: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" placeholder="+94 7X XXX XXXX" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Role *</label>
                    <select value={newForm.role} onChange={(e) => setNewForm({...newForm, role: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green bg-white">
                      <option value="cashier">Cashier</option>
                      <option value="deliveryGuy">Delivery Rider</option>
                      <option value="stockEmployee">Stock Employee</option>
                      {user?.role === 'admin' && <option value="manager">Manager</option>}
                    </select>
                  </div>
                </div>
              </div>

              {/* Employment Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-dark-navy mb-2">💼 Employment Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Monthly Salary (LKR)</label>
                    <input type="number" value={newForm.salary} onChange={(e) => setNewForm({...newForm, salary: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" placeholder="45000" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Department</label>
                    <input value={newForm.department} onChange={(e) => setNewForm({...newForm, department: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" placeholder="Sales / Logistics" />
                  </div>
                </div>
              </div>

              {/* Bank & EPF/ETF */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-dark-navy mb-2">🏦 Bank & Statutory Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Bank Name</label>
                    <input value={newForm.bankName} onChange={(e) => setNewForm({...newForm, bankName: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" placeholder="Bank of Ceylon" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">Account Number</label>
                    <input value={newForm.bankAccount} onChange={(e) => setNewForm({...newForm, bankAccount: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" placeholder="XXXX XXXX XXXX" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">EPF Number</label>
                    <input value={newForm.epfNo} onChange={(e) => setNewForm({...newForm, epfNo: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" placeholder="EPF-XXXXX" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-text block mb-1">ETF Number</label>
                    <input value={newForm.etfNo} onChange={(e) => setNewForm({...newForm, etfNo: e.target.value})}
                      className="w-full border border-card-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" placeholder="ETF-XXXXX" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-muted-text hover:text-dark-navy transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={adding}
                  className="flex items-center gap-2 bg-primary-green hover:bg-emerald-600 text-white font-medium px-6 py-2.5 rounded-xl transition-colors shadow-md disabled:opacity-50">
                  <UserPlus size={16} /> {adding ? 'Registering...' : 'Register Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
};

export default ManagerEmployees;


import { useState, useEffect } from 'react';
import { Clock, DollarSign, CheckCircle } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import getEmployeeNavItems from './employeeNav';
import { getMyOvertime } from '../../services/api';
import useAuthStore from '../../store/authStore';
import { toast } from 'react-toastify';

const EmployeeOvertime = () => {
  const user = useAuthStore((s) => s.user);
  const navItems = getEmployeeNavItems(user?.role);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await getMyOvertime();
        setData(res.data);
      } catch (err) {
        toast.error('Failed to load OT records');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} title="Employee Portal">
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const records = data?.records || [];
  const summary = data?.summary || { totalHours: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0, recordCount: 0 };

  return (
    <DashboardLayout navItems={navItems} title="Employee Portal">
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-dark-navy">⏰ My Overtime</h1>
          <p className="text-muted-text text-sm mt-1">View your overtime records and payments</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-fuchsia-500 flex items-center justify-center mb-2">
              <Clock size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-dark-navy">{summary.totalHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-text mt-1">Total OT Hours</p>
          </div>
          <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mb-2">
              <DollarSign size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-dark-navy">Rs. {summary.totalAmount.toLocaleString()}</p>
            <p className="text-xs text-muted-text mt-1">Total OT Pay</p>
          </div>
          <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-2">
              <CheckCircle size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-green-600">Rs. {summary.paidAmount.toLocaleString()}</p>
            <p className="text-xs text-muted-text mt-1">Paid</p>
          </div>
          <div className="bg-white rounded-2xl border border-card-border p-5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-2">
              <DollarSign size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-amber-600">Rs. {summary.pendingAmount.toLocaleString()}</p>
            <p className="text-xs text-muted-text mt-1">Pending</p>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-2xl border border-card-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-card-border">
            <h2 className="font-semibold text-dark-navy">OT Records ({summary.recordCount})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-muted-text text-xs uppercase font-semibold">Date</th>
                  <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Hours</th>
                  <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Rate/Hr</th>
                  <th className="text-right py-3 px-4 text-muted-text text-xs uppercase font-semibold">Amount</th>
                  <th className="text-center py-3 px-4 text-muted-text text-xs uppercase font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-muted-text text-xs uppercase font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-medium">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">{r.hours}h</td>
                    <td className="py-3 px-4 text-right">Rs. {r.ratePerHour}</td>
                    <td className="py-3 px-4 text-right font-bold">Rs. {r.totalAmount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${r.status === 'paid' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status === 'paid' ? '✅ Paid' : r.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-text">{r.description || '—'}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-text">No overtime records yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmployeeOvertime;

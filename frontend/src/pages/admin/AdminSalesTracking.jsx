import { useState, useEffect } from 'react';
import { TrendingUp, Users, ShoppingCart, DollarSign, Calendar, Download, BarChart3 } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { adminNavGroups as navItems } from './adminNavItems';
import { getCashierSalesReport } from '../../services/api';
import { toast } from 'react-toastify';

const AdminSalesTracking = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getCashierSalesReport({ startDate, endDate });
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [startDate, endDate]);

  const exportCSV = () => {
    if (!data?.cashiers?.length) return;
    const rows = [['Cashier', 'Email', 'Total Sales (LKR)', 'Transactions', 'Items Sold', 'Avg Transaction (LKR)', 'Cash Sales', 'Card Sales']];
    data.cashiers.forEach((c) => {
      rows.push([c.cashier.name, c.cashier.email, c.totalSales, c.transactionCount, c.totalItems, c.avgTransaction, c.cashSales, c.cardSales]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sales_tracking_${startDate}_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const maxSales = data?.cashiers?.length ? Math.max(...data.cashiers.map((c) => c.totalSales)) : 0;

  return (
    <DashboardLayout navItems={navItems} title="Admin Panel">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 800, color: '#1f1f1f' }}>Sales Tracking</h1>
            <p style={{ margin: 0, color: '#7b6f69', fontSize: '0.85rem' }}>Cashier-wise POS performance overview</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #eaded6', fontSize: '0.82rem' }} />
            <span style={{ color: '#7b6f69' }}>to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #eaded6', fontSize: '0.82rem' }} />
            <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid #eaded6', background: 'white', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              <Download size={16} /> CSV
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {data?.totals && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total POS Sales', value: `LKR ${data.totals.totalSales.toLocaleString()}`, icon: DollarSign, color: '#d946a0', bg: '#fdf2f8' },
              { label: 'Transactions', value: data.totals.totalTransactions, icon: ShoppingCart, color: '#7c3aed', bg: '#f5f3ff' },
              { label: 'Items Sold', value: data.totals.totalItems, icon: BarChart3, color: '#059669', bg: '#d1fae5' },
              { label: 'Cashiers', value: data.cashiers?.length || 0, icon: Users, color: '#ea580c', bg: '#fff7ed' },
            ].map((c, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #eaded6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <c.icon size={18} style={{ color: c.color }} />
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#7b6f69', textTransform: 'uppercase', fontWeight: 600 }}>{c.label}</span>
                </div>
                <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#1f1f1f' }}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Visual Bar Chart */}
        {data?.cashiers?.length > 0 && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eaded6', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#1f1f1f' }}>Performance Comparison</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.cashiers.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ minWidth: '120px', fontSize: '0.82rem', fontWeight: 600, color: '#1f1f1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cashier.name}</span>
                  <div style={{ flex: 1, height: '28px', background: '#f5f0ec', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${maxSales > 0 ? (c.totalSales / maxSales * 100) : 0}%`, background: `linear-gradient(90deg, #d946a0, #c026d3)`, borderRadius: '8px', transition: 'width 0.5s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px' }}>
                      {c.totalSales / maxSales > 0.3 && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'white' }}>LKR {c.totalSales.toLocaleString()}</span>}
                    </div>
                  </div>
                  {c.totalSales / maxSales <= 0.3 && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#d946a0' }}>LKR {c.totalSales.toLocaleString()}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detail Table */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eaded6', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#7b6f69' }}>Loading...</div>
          ) : !data?.cashiers?.length ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#7b6f69' }}>No POS sales data for this period</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#fdf2f8' }}>
                    {['#', 'Cashier', 'Total Sales', 'Transactions', 'Items', 'Avg Trans.', 'Cash', 'Card', 'Last Sale'].map((h) => (
                      <th key={h} style={{ padding: '0.75rem 0.8rem', textAlign: 'left', fontWeight: 700, color: '#7b6f69', fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.cashiers.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f5f0ec' }}>
                      <td style={{ padding: '0.7rem 0.8rem', color: '#7b6f69', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: '0.7rem 0.8rem' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, color: '#1f1f1f' }}>{c.cashier.name}</p>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: '#7b6f69' }}>{c.cashier.email}</p>
                        </div>
                      </td>
                      <td style={{ padding: '0.7rem 0.8rem', fontWeight: 700, color: '#d946a0' }}>LKR {c.totalSales.toLocaleString()}</td>
                      <td style={{ padding: '0.7rem 0.8rem', color: '#1f1f1f' }}>{c.transactionCount}</td>
                      <td style={{ padding: '0.7rem 0.8rem', color: '#1f1f1f' }}>{c.totalItems}</td>
                      <td style={{ padding: '0.7rem 0.8rem', color: '#7b6f69' }}>LKR {c.avgTransaction.toLocaleString()}</td>
                      <td style={{ padding: '0.7rem 0.8rem', color: '#059669' }}>LKR {c.cashSales.toLocaleString()}</td>
                      <td style={{ padding: '0.7rem 0.8rem', color: '#7c3aed' }}>LKR {c.cardSales.toLocaleString()}</td>
                      <td style={{ padding: '0.7rem 0.8rem', fontSize: '0.78rem', color: '#7b6f69' }}>{c.lastSale ? new Date(c.lastSale).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminSalesTracking;

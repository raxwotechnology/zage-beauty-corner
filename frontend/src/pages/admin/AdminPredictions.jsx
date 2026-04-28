import { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, DollarSign, ShoppingCart, BarChart3, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { adminNavGroups as navItems } from './adminNavItems';
import { getSalesPredictions } from '../../services/api';
import { toast } from 'react-toastify';

const PERIOD_OPTIONS = [
  { key: 'daily', label: 'Daily', icon: '📅' },
  { key: 'weekly', label: 'Weekly', icon: '📆' },
  { key: 'monthly', label: 'Monthly', icon: '🗓️' },
];

const AdminPredictions = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await getSalesPredictions({ months: 12, period });
        setData(res.data);
      } catch (err) {
        toast.error('Failed to load predictions');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [period]);

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} title="Admin Panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: '#7b6f69' }}>
          <div style={{ textAlign: 'center' }}>
            <Brain size={48} style={{ color: '#d946a0', marginBottom: '1rem' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>Analyzing {period} sales data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout navItems={navItems} title="Admin Panel">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#7b6f69' }}>Failed to load prediction data</div>
      </DashboardLayout>
    );
  }

  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;
  const trendColor = data.trend === 'up' ? '#059669' : data.trend === 'down' ? '#dc2626' : '#7b6f69';
  const trendLabel = data.trend === 'up' ? 'Growing' : data.trend === 'down' ? 'Declining' : 'Stable';
  const periodLabel = period === 'daily' ? 'Next Day' : period === 'weekly' ? 'Next Week' : 'Next Month';

  const allData = [...data.historical, ...data.predictions];
  const maxRevenue = Math.max(...allData.map((d) => d.revenue), 1);

  return (
    <DashboardLayout navItems={navItems} title="Admin Panel">
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <Brain size={28} style={{ color: '#d946a0' }} />
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1f1f1f' }}>AI Sales Predictions</h1>
            </div>
            <p style={{ margin: 0, color: '#7b6f69', fontSize: '0.85rem' }}>Statistical forecasting — {period} view</p>
          </div>

          {/* Period Selector */}
          <div style={{ display: 'flex', gap: '0.5rem', background: '#f5f0ec', borderRadius: '12px', padding: '4px' }}>
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: period === p.key ? '#d946a0' : 'transparent',
                  color: period === p.key ? 'white' : '#7b6f69',
                  transition: 'all 0.2s',
                }}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: `${periodLabel} Forecast`, value: `LKR ${data.summary.nextMonthPrediction.toLocaleString()}`, icon: DollarSign, color: '#d946a0', bg: '#fdf2f8' },
            { label: `Avg ${period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'}`, value: `LKR ${data.summary.avgMonthlyRevenue.toLocaleString()}`, icon: BarChart3, color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'Growth Rate', value: `${data.growthRate > 0 ? '+' : ''}${data.growthRate}%`, icon: TrendIcon, color: trendColor, bg: data.trend === 'up' ? '#d1fae5' : data.trend === 'down' ? '#fef2f2' : '#f5f0ec' },
            { label: 'Trend', value: trendLabel, icon: data.trend === 'up' ? ArrowUp : data.trend === 'down' ? ArrowDown : Minus, color: trendColor, bg: data.trend === 'up' ? '#d1fae5' : data.trend === 'down' ? '#fef2f2' : '#f5f0ec' },
          ].map((c, i) => (
            <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #eaded6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <c.icon size={18} style={{ color: c.color }} />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#7b6f69', textTransform: 'uppercase', fontWeight: 600 }}>{c.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Revenue Chart */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eaded6', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1f1f1f' }}>Revenue — Actual vs Predicted ({period})</h3>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'linear-gradient(135deg, #d946a0, #c026d3)', display: 'inline-block' }}></span> Actual</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', display: 'inline-block' }}></span> Predicted</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '200px', overflowX: 'auto', paddingBottom: '2rem', position: 'relative' }}>
            {allData.slice(-30).map((d, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 28px', minWidth: '28px' }}>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '28px',
                    height: `${Math.max(4, (d.revenue / maxRevenue) * 170)}px`,
                    borderRadius: '5px 5px 2px 2px',
                    background: d.isPrediction
                      ? 'linear-gradient(180deg, #fbbf24, #f59e0b)'
                      : 'linear-gradient(180deg, #d946a0, #c026d3)',
                    opacity: d.isPrediction ? 0.85 : 1,
                    transition: 'height 0.3s ease',
                    cursor: 'pointer',
                  }}
                  title={`${d.label}: LKR ${d.revenue.toLocaleString()}`}
                />
                <span style={{ fontSize: '0.55rem', color: '#7b6f69', marginTop: '4px', transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Forecast Breakdown */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eaded6', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#1f1f1f' }}>
            {period === 'daily' ? '7-Day' : period === 'weekly' ? '4-Week' : '3-Month'} Forecast Breakdown
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(data.predictions.length, 4)}, 1fr)`, gap: '0.75rem', overflowX: 'auto' }}>
            {data.predictions.map((p, i) => (
              <div key={i} style={{ background: '#fffbeb', borderRadius: '14px', padding: '1rem', border: '1px dashed #fbbf24', textAlign: 'center', minWidth: '120px' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', fontWeight: 700, color: '#92400e' }}>{p.label}</p>
                <p style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 800, color: '#1f1f1f' }}>LKR {p.revenue.toLocaleString()}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.7rem' }}>
                  <span style={{ color: '#dc2626' }}>Exp: {p.expenses.toLocaleString()}</span>
                  <span style={{ color: p.profit >= 0 ? '#059669' : '#dc2626', fontWeight: 700 }}>
                    {p.profit >= 0 ? '+' : ''}{p.profit.toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.65rem', color: '#7b6f69' }}>~{p.orders} orders</p>
              </div>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eaded6', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eaded6' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1f1f1f' }}>
              {period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'} Data
            </h3>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#fdf2f8', position: 'sticky', top: 0 }}>
                  {['Period', 'Revenue', 'Expenses', 'Profit', 'Orders', 'Type'].map((h) => (
                    <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 700, color: '#7b6f69', fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allData.slice(-30).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f5f0ec', background: d.isPrediction ? '#fffef5' : 'transparent' }}>
                    <td style={{ padding: '0.6rem 1rem', fontWeight: 600, color: '#1f1f1f' }}>{d.label}</td>
                    <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: '#d946a0' }}>LKR {d.revenue.toLocaleString()}</td>
                    <td style={{ padding: '0.6rem 1rem', color: '#dc2626' }}>LKR {d.expenses.toLocaleString()}</td>
                    <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: d.profit >= 0 ? '#059669' : '#dc2626' }}>LKR {d.profit.toLocaleString()}</td>
                    <td style={{ padding: '0.6rem 1rem', color: '#7b6f69' }}>{d.orders || '—'}</td>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, background: d.isPrediction ? '#fef3c7' : '#d1fae5', color: d.isPrediction ? '#92400e' : '#065f46' }}>
                        {d.isPrediction ? 'PREDICTED' : 'ACTUAL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminPredictions;

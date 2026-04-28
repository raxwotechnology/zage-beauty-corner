import { useState, useEffect } from 'react';
import { Ticket, Plus, Edit2, Trash2, X, Search, Copy, Check, FileText, Printer } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import API from '../../services/api';
import { toast } from 'react-toastify';
import { adminNavGroups as navItems } from './adminNavItems';
import useSettingsStore from '../../store/settingsStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const emptyForm = {
  code: '', type: 'percentage', value: '', minOrderAmount: '', maxDiscountAmount: '', maxUses: '',
  perUserMaxUses: '1',
  description: '', expiresAt: '', source: 'admin', applicableProductIds: '', applicableCategoryIds: '',
};

const AdminVouchers = () => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [printQty, setPrintQty] = useState({});
  const settings = useSettingsStore((s) => s.settings);

  const printVoucher = (v) => {
    const siteName = settings?.shopName || 'Zage Fashion Corner';
    const logoUrl = settings?.logoUrl || settings?.logo || '';
    const qty = printQty[v._id] || 1;
    const discountText = v.type === 'percentage' ? `${v.value}% OFF` : `Rs. ${v.value} OFF`;
    const expiryText = v.expiresAt ? new Date(v.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No Expiry';

    const singleVoucher = `
      <div style="width:380px;border:2px dashed #d946a0;border-radius:20px;padding:28px;margin:15px auto;text-align:center;background:linear-gradient(135deg,#fdf2f8,#fff5f7,#ffffff);position:relative;overflow:hidden;page-break-inside:avoid">
        <div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;background:#d946a0;opacity:0.08;border-radius:50%"></div>
        <div style="position:absolute;bottom:-20px;left:-20px;width:80px;height:80px;background:#c026d3;opacity:0.08;border-radius:50%"></div>
        ${logoUrl ? `<img src="${logoUrl}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block" onerror="this.style.display='none'" />` : ''}
        <h2 style="margin:0 0 4px;font-size:16px;color:#1f1f1f;font-family:'Segoe UI',sans-serif">${siteName}</h2>
        <p style="margin:0 0 12px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px">Discount Voucher</p>
        <div style="background:linear-gradient(135deg,#d946a0,#c026d3);color:white;border-radius:14px;padding:16px 20px;margin:0 0 14px">
          <p style="margin:0;font-size:28px;font-weight:900;letter-spacing:1px">${discountText}</p>
        </div>
        <div style="background:#f9fafb;border:1px dashed #d946a0;border-radius:10px;padding:10px;margin:0 0 12px">
          <p style="margin:0 0 2px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Voucher Code</p>
          <p style="margin:0;font-size:22px;font-weight:900;color:#d946a0;font-family:monospace;letter-spacing:4px">${v.code}</p>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#6b7280;margin-bottom:8px;padding:0 8px">
          <span>Min Order: Rs. ${v.minOrderAmount || 0}</span>
          <span>Expires: ${expiryText}</span>
        </div>
        ${v.description ? `<p style="margin:0 0 8px;font-size:11px;color:#7b6f69;font-style:italic">${v.description}</p>` : ''}
        <p style="margin:0;font-size:9px;color:#d1d5db">Present this voucher at checkout · ${siteName}</p>
      </div>`;

    const allVouchers = Array(qty).fill(singleVoucher).join('');

    const html = `<!DOCTYPE html><html><head><title>Voucher - ${v.code}</title>
      <style>body{font-family:'Segoe UI',sans-serif;margin:0;padding:20px;background:#fff}
      @media print{body{padding:10px}@page{margin:10mm}}</style>
      </head><body>${allVouchers}</body></html>`;

    const win = window.open('', '_blank', 'width=500,height=700');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  useEffect(() => { fetchVouchers(); }, []);

  const fetchVouchers = async () => {
    try {
      try {
        const { data } = await API.get('/loyalty/vouchers/admin');
        setVouchers(data || []);
      } catch (adminErr) {
        // Backward-compatible fallback in case backend is not restarted yet.
        const { data } = await API.get('/loyalty/vouchers');
        setVouchers(data || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };

  const openEdit = (v) => {
    setEditing(v._id);
    setForm({
      code: v.code,
      type: v.type,
      value: v.value,
      minOrderAmount: v.minOrderAmount || '',
      maxDiscountAmount: v.maxDiscountAmount || '',
      maxUses: v.maxUses || '',
      perUserMaxUses: v.perUserMaxUses || 1,
      description: v.description || '',
      expiresAt: v.expiresAt ? v.expiresAt.split('T')[0] : '',
      source: v.source || 'admin',
      applicableProductIds: (v.applicableProductIds || []).map((id) => String(id)).join(','),
      applicableCategoryIds: (v.applicableCategoryIds || []).map((id) => String(id)).join(','),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase(),
        value: Number(form.value),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxDiscountAmount: Number(form.maxDiscountAmount) || undefined,
        maxUses: Number(form.maxUses) || 9999,
        perUserMaxUses: Number(form.perUserMaxUses) || 1,
        applicableProductIds: form.applicableProductIds
          ? form.applicableProductIds.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        applicableCategoryIds: form.applicableCategoryIds
          ? form.applicableCategoryIds.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };
      if (editing) {
        await API.put(`/loyalty/vouchers/${editing}`, payload);
        toast.success('Voucher updated');
      } else {
        await API.post('/loyalty/vouchers', payload);
        toast.success('Voucher created');
      }
      setShowModal(false);
      fetchVouchers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save voucher');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this voucher?')) return;
    try {
      await API.delete(`/loyalty/vouchers/${id}`);
      toast.success('Voucher deleted');
      fetchVouchers();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text('Voucher Report', 14, 18);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated: ${new Date().toLocaleString()}  |  Total: ${vouchers.length} vouchers`, 14, 25);

      autoTable(doc, {
        startY: 30,
        head: [['Code', 'Type', 'Value', 'Min Order', 'Used/Max', 'Expires', 'Status', 'Description']],
        body: vouchers.map(v => [
          v.code,
          v.type === 'percentage' ? 'Percentage' : 'Fixed',
          v.type === 'percentage' ? `${v.value}%` : `Rs. ${v.value}`,
          v.minOrderAmount ? `Rs. ${v.minOrderAmount}` : '—',
          `${v.usedCount || 0} / ${v.maxUses || '∞'}`,
          v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : 'Never',
          v.isActive ? 'Active' : 'Inactive',
          v.description || '',
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [217, 70, 160], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [253, 242, 248] },
      });

      doc.save(`vouchers_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF downloaded!');
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('PDF generation failed: ' + err.message);
    }
  };

  const filtered = vouchers.filter(v => v.code?.toLowerCase().includes(search.toLowerCase()) || v.description?.toLowerCase().includes(search.toLowerCase()));

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-dark-navy">🎟️ Voucher Management</h1>
            <p className="text-muted-text text-sm mt-1">{vouchers.length} vouchers total</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => {
              const rows = [['Code', 'Type', 'Value', 'Min Order', 'Max Discount', 'Used', 'Max Uses', 'Per User', 'Expires', 'Status', 'Description']];
              vouchers.forEach(v => {
                rows.push([
                  v.code, v.type, v.value,
                  v.minOrderAmount || 0, v.maxDiscountAmount || '',
                  v.usedCount || 0, v.maxUses || '∞',
                  v.perUserMaxUses || 1,
                  v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : 'Never',
                  v.isActive ? 'Active' : 'Inactive',
                  v.description || '',
                ]);
              });
              const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `vouchers_export_${new Date().toISOString().split('T')[0]}.csv`;
              a.click(); URL.revokeObjectURL(url);
              toast.success('Vouchers exported!');
            }} className="flex items-center gap-2 border border-card-border text-dark-navy px-4 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-all text-sm">
              📥 Export CSV
            </button>
            <button onClick={downloadPDF} className="flex items-center gap-2 border border-red-200 text-red-600 px-4 py-2.5 rounded-xl font-semibold hover:bg-red-50 transition-all text-sm">
              <FileText size={16} /> Export PDF
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 bg-primary-green text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all text-sm">
              <Plus size={18} /> Create Voucher
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search vouchers..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-96 border border-card-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
        </div>

        <div className="grid gap-4">
          {filtered.map((v) => (
            <div key={v._id} className="bg-white rounded-2xl border border-card-border p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg">
                    <Ticket size={24} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-dark-navy text-lg tracking-wider">{v.code}</span>
                      <button onClick={() => copyCode(v.code, v._id)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        {copiedId === v._id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-muted-text" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-text mt-0.5">{v.description || 'No description'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 border border-card-border rounded-xl px-2 py-1">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={printQty[v._id] || 1}
                      onChange={(e) => setPrintQty((prev) => ({ ...prev, [v._id]: Math.max(1, Number(e.target.value)) }))}
                      className="w-10 text-center text-xs border-none outline-none bg-transparent"
                      title="Print qty"
                    />
                    <button onClick={() => printVoucher(v)} className="p-1.5 rounded-lg hover:bg-fuchsia-50 text-fuchsia-600 transition-colors" title="Print Voucher">
                      <Printer size={16} />
                    </button>
                  </div>
                  <button onClick={() => openEdit(v)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Edit"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(v._id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                  <p className="text-muted-text">Discount</p>
                  <p className="font-bold text-emerald-700 text-sm">{v.type === 'percentage' ? `${v.value}%` : `Rs. ${v.value}`}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                  <p className="text-muted-text">Min Order</p>
                  <p className="font-bold text-blue-700 text-sm">Rs. {v.minOrderAmount || 0}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-2.5 text-center">
                  <p className="text-muted-text">Used</p>
                  <p className="font-bold text-amber-700 text-sm">{v.usedCount || 0} / {v.maxUses || '∞'}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-2.5 text-center">
                  <p className="text-muted-text">Expires</p>
                  <p className="font-bold text-purple-700 text-sm">{v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : 'Never'}</p>
                </div>
                <div className={`rounded-xl p-2.5 text-center ${v.isActive ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className="text-muted-text">Status</p>
                  <p className={`font-bold text-sm ${v.isActive ? 'text-emerald-700' : 'text-red-700'}`}>{v.isActive ? 'Active' : 'Inactive'}</p>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-card-border p-12 text-center text-muted-text">
              <Ticket size={40} className="mx-auto mb-3 text-gray-300" />
              <p>No vouchers found</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-card-border flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-dark-navy">{editing ? 'Edit Voucher' : 'Create Voucher'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Voucher Code *</label>
                <input required value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="e.g. SAVE20" className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green font-mono tracking-wider" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-navy mb-1">Discount Type</label>
                  <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (Rs.)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-navy mb-1">Value *</label>
                  <input type="number" required value={form.value} onChange={(e) => setForm({...form, value: e.target.value})} placeholder={form.type === 'percentage' ? 'e.g. 10' : 'e.g. 500'} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-navy mb-1">Min Order (Rs.)</label>
                  <input type="number" value={form.minOrderAmount} onChange={(e) => setForm({...form, minOrderAmount: e.target.value})} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-navy mb-1">Max Uses</label>
                  <input type="number" value={form.maxUses} onChange={(e) => setForm({...form, maxUses: e.target.value})} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Usage Limit Per User</label>
                <input type="number" value={form.perUserMaxUses} onChange={(e) => setForm({...form, perUserMaxUses: e.target.value})} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Expiry Date</label>
                <input type="date" value={form.expiresAt} onChange={(e) => setForm({...form, expiresAt: e.target.value})} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Description</label>
                <input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="e.g. 10% off for new users" className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Applicable Product IDs (optional)</label>
                <input
                  value={form.applicableProductIds}
                  onChange={(e) => setForm({ ...form, applicableProductIds: e.target.value })}
                  placeholder="comma separated product ids"
                  className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Applicable Category IDs (optional)</label>
                <input
                  value={form.applicableCategoryIds}
                  onChange={(e) => setForm({ ...form, applicableCategoryIds: e.target.value })}
                  placeholder="comma separated category ids"
                  className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-primary-green text-white py-2.5 rounded-xl font-semibold hover:bg-emerald-600 transition-all text-sm">{editing ? 'Update' : 'Create'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-card-border py-2.5 rounded-xl font-semibold text-muted-text hover:bg-gray-50 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminVouchers;

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Printer, Search, Eye, X } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/authStore';
import useSettingsStore from '../../store/settingsStore';
import { createSupplierReturn, getSupplierReturns, getSuppliers } from '../../services/api';

const SupplierReturnsPanel = ({ storeId, products }) => {
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [reason, setReason] = useState('damaged');
  const [returnedAt, setReturnedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ productId: '', qty: 1, unitCostAtReturn: '' }]);
  const [history, setHistory] = useState([]);
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [viewReturn, setViewReturn] = useState(null);

  const productOptions = useMemo(
    () => (products || []).filter(Boolean).map((p) => ({ id: p._id, label: `${p.name} (Stock: ${p.stock || 0})` })),
    [products]
  );

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (user?.role === 'admin' && storeId) params.storeId = storeId;
      const { data } = await getSuppliers(params);
      setSuppliers(data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && !storeId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }
    fetchSuppliers();
  }, [storeId, user?.role]);

  const fetchHistory = async () => {
    try {
      const params = {};
      if (user?.role === 'admin' && storeId) params.storeId = storeId;
      if (range.startDate) params.startDate = range.startDate;
      if (range.endDate) params.endDate = range.endDate;
      const { data } = await getSupplierReturns(params);
      setHistory(data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => { fetchHistory(); }, [storeId, range.startDate, range.endDate]);

  const addLine = () => setItems((prev) => [...prev, { productId: '', qty: 1, unitCostAtReturn: '' }]);
  const removeLine = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateLine = (idx, patch) => setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (user?.role === 'admin' && !storeId) {
      toast.error('Please select a store');
      return;
    }
    if (!supplierId) {
      toast.error('Supplier is required');
      return;
    }
    const cleaned = items
      .map((l) => ({
        productId: l.productId,
        qty: Number(l.qty),
        unitCostAtReturn: l.unitCostAtReturn === '' ? undefined : Number(l.unitCostAtReturn),
      }))
      .filter((l) => l.productId && l.qty > 0);
    if (cleaned.length === 0) {
      toast.error('Add at least one valid item');
      return;
    }
    setSaving(true);
    try {
      const payload = { supplierId, reason, returnedAt: returnedAt || undefined, notes: notes || undefined, items: cleaned };
      if (user?.role === 'admin') payload.storeId = storeId;
      await createSupplierReturn(payload);
      toast.success('Supplier return saved — stock deducted from matching price row');
      setSupplierId('');
      setReason('damaged');
      setReturnedAt('');
      setNotes('');
      setItems([{ productId: '', qty: 1, unitCostAtReturn: '' }]);
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save supplier return');
    } finally {
      setSaving(false);
    }
  };

  const printReturnVoucher = (ret) => {
    const siteName = settings?.shopName || 'Zage Fashion Corner';
    const logoUrl = settings?.logoUrl || settings?.logo || '';
    const itemRows = (ret.items || []).map((it, i) => `<tr>
      <td style="padding:8px;border:1px solid #ddd">${i + 1}</td>
      <td style="padding:8px;border:1px solid #ddd">${it.productId?.name || 'N/A'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${it.qty}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${it.unitCostAtReturn != null ? `Rs. ${Number(it.unitCostAtReturn).toFixed(2)}` : '—'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${it.unitCostAtReturn != null ? `Rs. ${(it.qty * Number(it.unitCostAtReturn)).toFixed(2)}` : '—'}</td>
    </tr>`).join('');

    const total = (ret.items || []).reduce((s, it) => s + (it.unitCostAtReturn != null ? it.qty * Number(it.unitCostAtReturn) : 0), 0);

    const html = `<!DOCTYPE html><html><head><title>Return Voucher</title>
    <style>body{font-family:'Segoe UI',sans-serif;padding:30px;max-width:800px;margin:0 auto}
    .header{text-align:center;border-bottom:3px solid #dc2626;padding-bottom:15px;margin-bottom:20px}
    .header h1{margin:5px 0;color:#1f1f1f;font-size:22px}
    .logo{width:60px;height:60px;border-radius:50%;object-fit:cover;margin-bottom:8px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;font-size:13px}
    .info-grid div{padding:8px 12px;background:#fef2f2;border-radius:8px}
    .info-grid strong{color:#dc2626}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px}
    th{background:#dc2626;color:white;padding:10px 8px;text-align:left}
    .total-row{background:#fef2f2;font-weight:bold;font-size:15px}
    .footer{text-align:center;margin-top:30px;padding-top:15px;border-top:2px dashed #eee;font-size:11px;color:#999}
    @media print{body{padding:15px}}</style></head><body>
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" class="logo" onerror="this.style.display='none'" />` : ''}
      <h1>${siteName}</h1>
      <p style="font-size:16px;font-weight:700;color:#dc2626;margin-top:8px">SUPPLIER RETURN VOUCHER</p>
    </div>
    <div class="info-grid">
      <div><strong>Return ID:</strong> ${String(ret._id).slice(-8).toUpperCase()}</div>
      <div><strong>Date:</strong> ${new Date(ret.returnedAt || ret.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
      <div><strong>Supplier:</strong> ${ret.supplierId?.name || 'N/A'}</div>
      <div><strong>Reason:</strong> ${String(ret.reason || '').replace(/_/g, ' ')}</div>
    </div>
    ${ret.notes ? `<p style="font-size:12px;color:#666;margin-bottom:15px"><strong>Notes:</strong> ${ret.notes}</p>` : ''}
    <table>
      <thead><tr><th>#</th><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Cost</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${itemRows}
        <tr class="total-row"><td colspan="4" style="padding:10px;text-align:right;border:1px solid #ddd">Grand Total</td>
        <td style="padding:10px;text-align:right;border:1px solid #ddd">Rs. ${total.toFixed(2)}</td></tr>
      </tbody>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;font-size:12px">
      <div style="border-top:1px solid #333;padding-top:8px;text-align:center">Returned By</div>
      <div style="border-top:1px solid #333;padding-top:8px;text-align:center">Authorized Signature</div>
    </div>
    <div class="footer">This is a system-generated voucher from ${siteName}</div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=850,height=700');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-dark-navy mb-4">↩️ Supplier Returns</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-card-border p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-navy mb-1">Supplier *</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm bg-white">
              <option value="">Select supplier</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-navy mb-1">Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm bg-white">
              <option value="damaged">Damaged</option>
              <option value="expired">Expired</option>
              <option value="wrong_item">Wrong Item</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-navy mb-1">Return Date</label>
            <input type="date" value={returnedAt} onChange={(e) => setReturnedAt(e.target.value)} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-navy mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm resize-none" placeholder="Return notes..." />
        </div>

        <div className="border-t border-card-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-dark-navy">Return Items</h3>
            <button type="button" onClick={addLine} className="inline-flex items-center gap-2 text-sm font-semibold text-primary-green hover:underline">
              <Plus size={16} /> Add line
            </button>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
            ⚠️ Specify the <strong>unit cost at return</strong> to deduct from the correct price row. Same product at different prices are tracked as separate stock entries.
          </p>
          <div className="space-y-3">
            {items.map((l, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label className="text-xs text-muted-text block mb-1">Product *</label>
                  <select value={l.productId} onChange={(e) => updateLine(idx, { productId: e.target.value })} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm bg-white">
                    <option value="">Select product</option>
                    {productOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-text block mb-1">Qty *</label>
                  <input type="number" min="1" value={l.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm" />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-xs text-muted-text block mb-1">Unit Cost at Return (Rs.)</label>
                  <input type="number" min="0" step="0.01" value={l.unitCostAtReturn} onChange={(e) => updateLine(idx, { unitCostAtReturn: e.target.value })} className="w-full border border-card-border rounded-xl py-2.5 px-4 text-sm" placeholder="Match price row" />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-1">
                  <div className="w-full border border-card-border rounded-xl py-2.5 px-3 text-sm bg-gray-50 font-semibold text-red-600 text-right">
                    {l.unitCostAtReturn ? `Rs. ${(Number(l.qty) * Number(l.unitCostAtReturn)).toFixed(2)}` : '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Return & Deduct Stock'}
          </button>
        </div>
      </form>

      {/* Return History */}
      <div className="mt-8 bg-white rounded-2xl border border-card-border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-dark-navy">Return History</h3>
          <div className="flex gap-2">
            <input type="date" value={range.startDate} onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))} className="border border-card-border rounded-xl py-2 px-3 text-sm" />
            <input type="date" value={range.endDate} onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))} className="border border-card-border rounded-xl py-2 px-3 text-sm" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-text">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-text">Supplier</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-text">Reason</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-text">Items</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-text">Total</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-text">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {history.slice(0, 50).map((r) => {
                const total = (r.items || []).reduce((s, it) => s + (it.unitCostAtReturn ? it.qty * Number(it.unitCostAtReturn) : 0), 0);
                return (
                  <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-muted-text">{new Date(r.returnedAt || r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">{r.supplierId?.name || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">{String(r.reason || '').replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">{r.items?.length || 0}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">Rs. {total.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => printReturnVoucher(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Print Voucher">
                        <Printer size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-text">No supplier returns found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupplierReturnsPanel;

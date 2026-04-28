import { useState, useEffect, useCallback } from 'react';
import { Wallet, Search, ArrowLeft, CreditCard, TrendingUp, TrendingDown, DollarSign, Calendar, Download, ChevronDown, X, FileText, FileSpreadsheet, Edit2, Trash2, Save, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { adminNavGroups as navItems } from './adminNavItems';
import { getSupplierPaymentSummary, getSupplierLedger, recordSupplierPayment, recordSupplierPurchase, getSupplierPayments, updateSupplierTransaction, deleteSupplierTransaction, updateChequeStatus } from '../../services/api';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AdminSupplierPayments = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payDescription, setPayDescription] = useState('');
  const [chequeDetails, setChequeDetails] = useState({ chequeNumber: '', bankName: '', chequeDate: '', accountNumber: '' });
  const [paying, setPaying] = useState(false);
  const [supplierToPay, setSupplierToPay] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ totalCost: '', amountPaid: '', description: '' });
  const [editTx, setEditTx] = useState(null); // transaction being edited
  const [editForm, setEditForm] = useState({ amount: '', description: '', date: '' });

  const fetchSummary = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const res = await getSupplierPaymentSummary();
      setSuppliers(res.data);
    } catch (err) {
      toast.error('Failed to load supplier payments');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Auto-refresh when user switches back to this tab
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchSummary(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchSummary]);

  // Poll every 30 seconds to catch GRN updates from other pages
  useEffect(() => {
    const timer = setInterval(() => fetchSummary(true), 30000);
    return () => clearInterval(timer);
  }, [fetchSummary]);

  const openLedger = async (supplier) => {
    setSelectedSupplier(supplier);
    setLedgerLoading(true);
    try {
      const res = await getSupplierLedger(supplier._id);
      setLedger(res.data);
    } catch (err) {
      toast.error('Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const handlePayment = async () => {
    const targetSupplier = supplierToPay || selectedSupplier;
    if (!targetSupplier) return;
    if (!payAmount || Number(payAmount) <= 0) return toast.error('Enter valid amount');
    if (payMethod === 'cheque' && (!chequeDetails.chequeNumber || !chequeDetails.bankName || !chequeDetails.chequeDate)) {
      return toast.error('Please fill in all required cheque details');
    }
    setPaying(true);
    try {
      await recordSupplierPayment(targetSupplier._id, {
        amount: Number(payAmount),
        paymentMethod: payMethod,
        description: payDescription || undefined,
        ...(payMethod === 'cheque' ? chequeDetails : {})
      });
      toast.success('Payment recorded successfully');
      setShowPayModal(false);
      setPayAmount('');
      setPayDescription('');
      setChequeDetails({ chequeNumber: '', bankName: '', chequeDate: '', accountNumber: '' });
      setSupplierToPay(null);
      if (selectedSupplier) {
        openLedger(selectedSupplier);
      }
      fetchSummary(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handlePurchase = async () => {
    if (!purchaseForm.totalCost || Number(purchaseForm.totalCost) <= 0) return toast.error('Enter total cost');
    setPaying(true);
    try {
      await recordSupplierPurchase(selectedSupplier._id, {
        totalCost: Number(purchaseForm.totalCost),
        amountPaid: Number(purchaseForm.amountPaid || 0),
        description: purchaseForm.description || undefined,
      });
      const paid = Number(purchaseForm.amountPaid || 0);
      const due = Number(purchaseForm.totalCost) - paid;
      toast.success(`Purchase recorded! ${due > 0 ? `Balance added: LKR ${due.toLocaleString()}` : 'Fully paid'}`);
      setShowPurchaseModal(false);
      setPurchaseForm({ totalCost: '', amountPaid: '', description: '' });
      openLedger(selectedSupplier);
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record purchase');
    } finally {
      setPaying(false);
    }
  };

  const exportCSV = () => {
    if (!ledger?.transactions?.length) return;
    const rows = [['Date', 'Type', 'Description', 'Amount', 'Balance']];
    ledger.transactions.forEach((t) => {
      rows.push([
        new Date(t.date).toLocaleDateString(),
        t.type,
        t.description || '',
        t.amount.toFixed(2),
        t.runningBalance.toFixed(2),
      ]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier_ledger_${selectedSupplier?.name || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEditTx = (t) => {
    setEditTx(t._id);
    setEditForm({
      amount: t.amount,
      description: t.description || '',
      date: t.date ? new Date(t.date).toISOString().split('T')[0] : '',
    });
  };

  const handleSaveTx = async () => {
    try {
      await updateSupplierTransaction(editTx, { amount: Number(editForm.amount), description: editForm.description, date: editForm.date });
      toast.success('Transaction updated');
      setEditTx(null);
      openLedger(selectedSupplier);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const handleDeleteTx = async (id) => {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return;
    try {
      await deleteSupplierTransaction(id);
      toast.success('Transaction deleted');
      openLedger(selectedSupplier);
      fetchSummary(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const exportAllPaymentsExcel = async () => {
    try {
      const res = await getSupplierPayments();
      const rows = res.data.map(p => ({
        Supplier: p.supplierId?.name || 'Unknown',
        Amount: p.amount.toFixed(2),
        Date: new Date(p.date).toLocaleDateString(),
        Status: p.paymentMethod || 'cash',
        'Payment Method': p.paymentMethod || 'cash'
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Supplier Payments');
      XLSX.writeFile(workbook, 'supplier_payments.xlsx');
      toast.success('Excel exported');
    } catch (e) { toast.error('Export failed'); }
  };

  const exportAllPaymentsPDF = async () => {
    try {
      const res = await getSupplierPayments();
      const doc = new jsPDF();
      doc.text('Supplier Payments Report', 14, 15);
      autoTable(doc, {
        head: [['Supplier', 'Amount (LKR)', 'Date', 'Payment Method']],
        body: res.data.map(p => [
          p.supplierId?.name || 'Unknown',
          p.amount.toFixed(2),
          new Date(p.date).toLocaleDateString(),
          p.paymentMethod || 'cash'
        ]),
        startY: 20
      });
      doc.save('supplier_payments.pdf');
      toast.success('PDF exported');
    } catch (e) { toast.error('Export failed'); }
  };

  const filtered = suppliers.filter((s) =>
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDue = suppliers.reduce((s, sup) => s + (sup.balanceDue || 0), 0);
  const totalPurchased = suppliers.reduce((s, sup) => s + (sup.totalPurchased || 0), 0);
  const totalPaid = suppliers.reduce((s, sup) => s + (sup.totalPaid || 0), 0);

  // Ledger View
  if (selectedSupplier) {
    return (
      <DashboardLayout navItems={navItems} title="Admin Panel">
        <div>
          {/* Back Button */}
          <button onClick={() => { setSelectedSupplier(null); setLedger(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: '#d946a0', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', marginBottom: '1rem', padding: 0 }}>
            <ArrowLeft size={18} /> Back to Suppliers
          </button>

          {/* Supplier Header */}
          <div style={{ background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #fbcfe8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 800, color: '#1f1f1f' }}>{selectedSupplier.name}</h2>
                <p style={{ margin: 0, color: '#7b6f69', fontSize: '0.85rem' }}>{selectedSupplier.phone} {selectedSupplier.email && `· ${selectedSupplier.email}`}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid #eaded6', background: 'white', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', color: '#1f1f1f' }}>
                  <Download size={16} /> Export CSV
                </button>
                <button onClick={() => setShowPurchaseModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem', borderRadius: '10px', border: '1px solid #d946a0', background: 'white', color: '#d946a0', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                  <TrendingUp size={16} /> Record Purchase
                </button>
                <button onClick={() => setShowPayModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #d946a0, #c026d3)', color: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 10px rgba(217,70,160,0.3)' }}>
                  <CreditCard size={16} /> Record Payment
                </button>
              </div>
            </div>

            {/* Balance Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              {[
                { label: 'Total Purchased', value: ledger?.totalPurchased || 0, color: '#1f1f1f', icon: TrendingUp },
                { label: 'Total Paid', value: ledger?.totalPaid || 0, color: '#059669', icon: TrendingDown },
                { label: 'Balance Due', value: ledger?.balanceDue || 0, color: ledger?.balanceDue > 0 ? '#dc2626' : '#059669', icon: Wallet },
              ].map((c, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '1rem', border: '1px solid #eaded6', textAlign: 'center' }}>
                  <c.icon size={20} style={{ color: c.color, marginBottom: '0.25rem' }} />
                  <p style={{ margin: '0 0 0.15rem', fontSize: '0.7rem', color: '#7b6f69', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{c.label}</p>
                  <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: c.color }}>LKR {c.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transactions Table */}
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eaded6', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eaded6' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1f1f1f' }}>Transaction Ledger</h3>
            </div>
            {ledgerLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#7b6f69' }}>Loading...</div>
            ) : !ledger?.transactions?.length ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#7b6f69' }}>No transactions yet</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#fdf2f8' }}>
                      {['Date', 'Type', 'Description', 'By', 'Amount', 'Balance', 'Actions'].map((h) => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#7b6f69', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.transactions.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f5f0ec', background: editTx === t._id ? '#fff9f5' : 'white' }}>
                        <td style={{ padding: '0.7rem 1rem', color: '#1f1f1f', minWidth: '100px' }}>
                          {editTx === t._id
                            ? <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} style={{ border: '1px solid #eaded6', borderRadius: '6px', padding: '3px 6px', fontSize: '0.8rem', width: '120px' }} />
                            : new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: t.type === 'purchase' ? '#fef3c7' : '#d1fae5', color: t.type === 'purchase' ? '#92400e' : '#065f46' }}>
                            {t.type === 'purchase' ? 'PURCHASE' : 'PAYMENT'}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#7b6f69', maxWidth: '200px' }}>
                          {editTx === t._id
                            ? <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={{ border: '1px solid #eaded6', borderRadius: '6px', padding: '3px 8px', fontSize: '0.82rem', width: '100%' }} />
                            : <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{t.description}</span>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#7b6f69' }}>{t.createdBy?.name || '—'}</td>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 700, color: t.type === 'purchase' ? '#dc2626' : '#059669', minWidth: '110px' }}>
                          {editTx === t._id
                            ? <input type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} style={{ border: '1px solid #eaded6', borderRadius: '6px', padding: '3px 6px', fontSize: '0.85rem', width: '90px', fontWeight: 700 }} />
                            : <>{t.type === 'purchase' ? '+' : '-'} LKR {t.amount.toLocaleString()}</>}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 700, color: t.runningBalance > 0 ? '#dc2626' : '#059669' }}>
                          LKR {t.runningBalance.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          {editTx === t._id ? (
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button onClick={handleSaveTx} style={{ background: '#059669', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                              <button onClick={() => setEditTx(null)} style={{ background: '#f5f0ec', color: '#7b6f69', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button onClick={() => handleEditTx(t)} title="Edit" style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => handleDeleteTx(t._id)} title="Delete" style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cheque Tracking Section */}
          {ledger?.chequeSummary && ledger.chequeSummary.totalCheques > 0 && (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eaded6', overflow: 'hidden', marginTop: '1.5rem' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eaded6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1f1f1f' }}>🏦 Cheque Tracking</h3>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, background: '#d1fae5', color: '#065f46' }}>✅ Paid: {ledger.chequeSummary.paid}</span>
                  <span style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>⏳ Pending: {ledger.chequeSummary.pending}</span>
                  <span style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, background: '#fef2f2', color: '#991b1b' }}>❌ Bounced: {ledger.chequeSummary.bounced}</span>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#fdf2f8' }}>
                      {['Cheque No', 'Bank', 'Cheque Date', 'Amount', 'Account', 'Status', 'Action'].map((h) => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#7b6f69', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(ledger.chequeSummary.cheques || []).map((ch, ci) => (
                      <tr key={ci} style={{ borderBottom: '1px solid #f5f0ec' }}>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#1f1f1f' }}>{ch.chequeNumber}</td>
                        <td style={{ padding: '0.7rem 1rem', color: '#7b6f69' }}>{ch.bankName}</td>
                        <td style={{ padding: '0.7rem 1rem', color: '#7b6f69' }}>{ch.chequeDate ? new Date(ch.chequeDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 700, color: '#d946a0' }}>LKR {Number(ch.amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.7rem 1rem', color: '#7b6f69' }}>{ch.accountNumber || '—'}</td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '8px', fontWeight: 700, fontSize: '0.72rem', background: ch.status === 'paid' ? '#d1fae5' : ch.status === 'bounced' ? '#fef2f2' : '#fef3c7', color: ch.status === 'paid' ? '#065f46' : ch.status === 'bounced' ? '#991b1b' : '#92400e' }}>
                            {ch.status === 'paid' ? '✅ Paid' : ch.status === 'bounced' ? '❌ Bounced' : '⏳ Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <select
                            value={ch.status}
                            onChange={async (e) => {
                              try {
                                await updateChequeStatus(ch.paymentId, { chequeStatus: e.target.value, status: e.target.value });
                                toast.success('Cheque status updated');
                                openLedger(selectedSupplier);
                              } catch { toast.error('Failed to update cheque status'); }
                            }}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #eaded6', fontSize: '0.78rem', cursor: 'pointer' }}
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="bounced">Bounced</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {showPayModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Record Payment</h3>
                <button onClick={() => setShowPayModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7b6f69' }}><X size={20} /></button>
              </div>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#7b6f69' }}>
                Payment to <strong>{selectedSupplier.name}</strong> · Balance: <strong style={{ color: '#dc2626' }}>LKR {(ledger?.balanceDue || 0).toLocaleString()}</strong>
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Amount (LKR)</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00"
                  style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: '10px', border: '1px solid #eaded6', fontSize: '1.1rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Payment Method</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['cash', 'bank_transfer', 'cheque'].map((m) => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: `1px solid ${payMethod === m ? '#d946a0' : '#eaded6'}`, background: payMethod === m ? '#fdf2f8' : 'white', color: payMethod === m ? '#d946a0' : '#7b6f69', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              
              {payMethod === 'cheque' && (
                <div style={{ background: '#fdf2f8', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid #fbcfe8' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#d946a0' }}>Cheque Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Cheque No. *</label>
                      <input type="text" value={chequeDetails.chequeNumber} onChange={(e) => setChequeDetails({...chequeDetails, chequeNumber: e.target.value})} placeholder="0000123"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Bank Name *</label>
                      <input type="text" value={chequeDetails.bankName} onChange={(e) => setChequeDetails({...chequeDetails, bankName: e.target.value})} placeholder="BOC"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Cheque Date *</label>
                      <input type="date" value={chequeDetails.chequeDate} onChange={(e) => setChequeDetails({...chequeDetails, chequeDate: e.target.value})}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Account No.</label>
                      <input type="text" value={chequeDetails.accountNumber} onChange={(e) => setChequeDetails({...chequeDetails, accountNumber: e.target.value})} placeholder="Optional"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none' }} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Note (optional)</label>
                <input type="text" value={payDescription} onChange={(e) => setPayDescription(e.target.value)} placeholder="Payment reference..."
                  style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button onClick={handlePayment} disabled={paying}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #d946a0, #c026d3)', color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', opacity: paying ? 0.7 : 1 }}>
                {paying ? 'Processing...' : `Pay LKR ${Number(payAmount || 0).toLocaleString()}`}
              </button>
            </div>
          </div>
        )}

        {/* Purchase Modal */}
        {showPurchaseModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Record Purchase</h3>
                <button onClick={() => setShowPurchaseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7b6f69' }}><X size={20} /></button>
              </div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#7b6f69' }}>
                Stock purchase from <strong>{selectedSupplier.name}</strong>
              </p>
              <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#7b6f69', background: '#fdf2f8', padding: '0.6rem', borderRadius: '8px' }}>
                💡 Enter the total cost. If you pay partially now, the rest is tracked as balance due.
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Total Purchase Cost (LKR) *</label>
                <input type="number" value={purchaseForm.totalCost} onChange={(e) => setPurchaseForm({...purchaseForm, totalCost: e.target.value})} placeholder="e.g. 10000"
                  style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: '10px', border: '1px solid #eaded6', fontSize: '1.1rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Amount Paid Now (LKR)</label>
                <input type="number" value={purchaseForm.amountPaid} onChange={(e) => setPurchaseForm({...purchaseForm, amountPaid: e.target.value})} placeholder="e.g. 5000 (optional)"
                  style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: '10px', border: '1px solid #eaded6', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {purchaseForm.totalCost && (
                <div style={{ background: '#fef2f2', padding: '0.6rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <strong style={{ color: '#dc2626' }}>Balance to track: LKR {(Number(purchaseForm.totalCost || 0) - Number(purchaseForm.amountPaid || 0)).toLocaleString()}</strong>
                </div>
              )}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Description (optional)</label>
                <input type="text" value={purchaseForm.description} onChange={(e) => setPurchaseForm({...purchaseForm, description: e.target.value})} placeholder="Stock batch, items..."
                  style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button onClick={handlePurchase} disabled={paying}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #d946a0, #c026d3)', color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', opacity: paying ? 0.7 : 1 }}>
                {paying ? 'Processing...' : 'Record Purchase'}
              </button>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  // Summary View
  return (
    <DashboardLayout navItems={navItems} title="Admin Panel">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 800, color: '#1f1f1f' }}>Supplier Payments</h1>
            <p style={{ margin: 0, color: '#7b6f69', fontSize: '0.85rem' }}>Track supplier balances, purchases, and payments</p>
          </div>
          <button
            onClick={() => fetchSummary(true)}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', borderRadius: '12px', border: '1px solid #eaded6', background: 'white', color: '#1f1f1f', fontWeight: 600, fontSize: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Purchased', value: totalPurchased, color: '#1f1f1f', bg: '#f5f0ec', icon: TrendingUp },
            { label: 'Total Paid', value: totalPaid, color: '#059669', bg: '#d1fae5', icon: DollarSign },
            { label: 'Total Due', value: totalDue, color: totalDue > 0 ? '#dc2626' : '#059669', bg: totalDue > 0 ? '#fef2f2' : '#d1fae5', icon: Wallet },
          ].map((c, i) => (
            <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #eaded6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <c.icon size={18} style={{ color: c.color }} />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#7b6f69', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{c.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: c.color }}>LKR {c.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Search & Export */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#7b6f69' }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers..."
              style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2.75rem', borderRadius: '12px', border: '1px solid #eaded6', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={exportAllPaymentsExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#059669', color: 'white', padding: '0.7rem 1rem', borderRadius: '12px', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
              <FileSpreadsheet size={16} /> Export Payments (Excel)
            </button>
            <button onClick={exportAllPaymentsPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#dc2626', color: 'white', padding: '0.7rem 1rem', borderRadius: '12px', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
              <FileText size={16} /> Export Payments (PDF)
            </button>
          </div>
        </div>

        {/* Supplier Table */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eaded6', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#7b6f69' }}>Loading suppliers...</div>
          ) : !filtered.length ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#7b6f69' }}>No suppliers found</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#fdf2f8' }}>
                    {['Supplier', 'Contact', 'Total Purchased', 'Total Paid', 'Balance Due', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#7b6f69', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s._id} style={{ borderBottom: '1px solid #f5f0ec', cursor: 'pointer' }} onClick={() => openLedger(s)}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontWeight: 700, color: '#1f1f1f' }}>{s.name}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#7b6f69' }}>{s.phone || s.email || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1f1f1f' }}>LKR {(s.totalPurchased || 0).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#059669' }}>LKR {(s.totalPaid || 0).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', background: s.balanceDue > 0 ? '#fef2f2' : '#d1fae5', color: s.balanceDue > 0 ? '#dc2626' : '#059669' }}>
                          LKR {(s.balanceDue || 0).toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <button onClick={(e) => { e.stopPropagation(); setSupplierToPay(s); setShowPayModal(true); }}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: 'none', background: '#fdf2f8', color: '#d946a0', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                          Pay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Modal for Summary View */}
        {showPayModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Record Payment</h3>
                <button onClick={() => { setShowPayModal(false); setSupplierToPay(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7b6f69' }}><X size={20} /></button>
              </div>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#7b6f69' }}>
                Payment to <strong>{(supplierToPay || selectedSupplier)?.name}</strong> · Balance: <strong style={{ color: '#dc2626' }}>LKR {((supplierToPay || ledger)?.balanceDue || 0).toLocaleString()}</strong>
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Amount (LKR)</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00"
                  style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: '10px', border: '1px solid #eaded6', fontSize: '1.1rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Payment Method</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['cash', 'bank_transfer', 'cheque'].map((m) => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: `1px solid ${payMethod === m ? '#d946a0' : '#eaded6'}`, background: payMethod === m ? '#fdf2f8' : 'white', color: payMethod === m ? '#d946a0' : '#7b6f69', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              
              {payMethod === 'cheque' && (
                <div style={{ background: '#fdf2f8', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid #fbcfe8' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#d946a0' }}>Cheque Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Cheque No. *</label>
                      <input type="text" value={chequeDetails.chequeNumber} onChange={(e) => setChequeDetails({...chequeDetails, chequeNumber: e.target.value})} placeholder="0000123"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Bank Name *</label>
                      <input type="text" value={chequeDetails.bankName} onChange={(e) => setChequeDetails({...chequeDetails, bankName: e.target.value})} placeholder="BOC"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Cheque Date *</label>
                      <input type="date" value={chequeDetails.chequeDate} onChange={(e) => setChequeDetails({...chequeDetails, chequeDate: e.target.value})}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Account No.</label>
                      <input type="text" value={chequeDetails.accountNumber} onChange={(e) => setChequeDetails({...chequeDetails, accountNumber: e.target.value})} placeholder="Optional"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none' }} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#7b6f69', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Note (optional)</label>
                <input type="text" value={payDescription} onChange={(e) => setPayDescription(e.target.value)} placeholder="Payment reference..."
                  style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #eaded6', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button onClick={handlePayment} disabled={paying}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #d946a0, #c026d3)', color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', opacity: paying ? 0.7 : 1 }}>
                {paying ? 'Processing...' : `Pay LKR ${Number(payAmount || 0).toLocaleString()}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminSupplierPayments;

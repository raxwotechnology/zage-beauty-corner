import { useEffect, useRef } from 'react';
import { X, Printer, RotateCcw } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import useSettingsStore from '../../store/settingsStore';

const InvoiceModal = ({ isOpen, onClose, order, onNewSale }) => {
  const settings = useSettingsStore((s) => s.settings);
  const brandName = settings?.shopName || 'Zage Fashion Corner';
  const brandAddress = settings?.address || '';
  const brandPhone = settings?.phone || '';
  const brandEmail = settings?.email || '';
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (isOpen && order?.invoiceNumber && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, order.invoiceNumber, {
          format: 'CODE128',
          width: 1.2,
          height: 30,
          displayValue: true,
          fontSize: 10,
          margin: 4,
          textMargin: 2,
        });
      } catch { /* ignore */ }
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleNewSale = () => {
    onNewSale();
    onClose();
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const subtotal = order.subtotal ?? order.items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? order.totalAmount;
  const discountAmount = order.discountAmount || 0;
  const couponDiscount = order.couponDiscount || 0;
  const totalDiscount = discountAmount + couponDiscount;
  const taxAmount = order.tax || 0;

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-invoice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', width: '100%' }}>
        {/* Close button — hidden when printing */}
        <button className="pos-invoice-close no-print" onClick={onClose}>
          <X size={20} />
        </button>

        {/* ═══════ Professional Receipt Content ═══════ */}
        <div className="pos-receipt" id="pos-receipt-content" style={{ fontFamily: "'Courier New', Courier, monospace", padding: '20px', background: '#fff' }}>
          
          {/* Store Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: '12px', marginBottom: '10px' }}>
            {settings?.logo && (
              <img src={settings.logo} alt="" style={{ width: '48px', height: '48px', objectFit: 'contain', margin: '0 auto 6px', display: 'block', borderRadius: '8px' }} />
            )}
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 2px', color: '#111', letterSpacing: '1px' }}>
              {order.storeId?.name || brandName}
            </h2>
            {(order.storeId?.address || brandAddress) && (
              <p style={{ fontSize: '10px', margin: '0', color: '#555' }}>
                {order.storeId?.address || brandAddress}
              </p>
            )}
            {(order.storeId?.phone || brandPhone) && (
              <p style={{ fontSize: '10px', margin: '0', color: '#555' }}>
                Tel: {order.storeId?.phone || brandPhone}
                {(order.storeId?.email || brandEmail) && ` | ${order.storeId?.email || brandEmail}`}
              </p>
            )}
          </div>

          {/* Invoice Title */}
          <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, margin: 0, letterSpacing: '3px', color: '#333' }}>TAX INVOICE</p>
          </div>

          {/* Invoice Meta */}
          <div style={{ fontSize: '11px', borderTop: '1px dashed #999', borderBottom: '1px dashed #999', padding: '8px 0', margin: '6px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: '#666' }}>Invoice #:</span>
              <span style={{ fontWeight: 700, color: '#111' }}>{order.invoiceNumber || order._id?.slice(-8).toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: '#666' }}>Date:</span>
              <span style={{ color: '#111' }}>{formatDate(order.createdAt)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: '#666' }}>Time:</span>
              <span style={{ color: '#111' }}>{formatTime(order.createdAt)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: '#666' }}>Cashier:</span>
              <span style={{ color: '#111' }}>{order.cashierId?.name || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#666' }}>Payment:</span>
              <span style={{ fontWeight: 700, color: '#111', textTransform: 'uppercase', background: '#f3f4f6', padding: '1px 8px', borderRadius: '4px', fontSize: '10px' }}>
                {order.paymentMethod}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          {(order.customerName || order.customerPhone) && (
            <div style={{ fontSize: '11px', borderBottom: '1px dashed #999', padding: '6px 0', margin: '0 0 6px' }}>
              {order.customerName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: '#666' }}>Customer:</span>
                  <span style={{ color: '#111', fontWeight: 600 }}>{order.customerName}</span>
                </div>
              )}
              {order.customerPhone && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>Phone:</span>
                  <span style={{ color: '#111' }}>{order.customerPhone}</span>
                </div>
              )}
            </div>
          )}

          {/* Items Table */}
          <div style={{ margin: '8px 0' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 65px 70px', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#666', borderBottom: '1px solid #ddd', padding: '4px 0', textTransform: 'uppercase' }}>
              <span>Item</span>
              <span style={{ textAlign: 'center' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>Price</span>
              <span style={{ textAlign: 'right' }}>Total</span>
            </div>
            {/* Items */}
            {order.items?.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 65px 70px', gap: '4px', fontSize: '11px', padding: '5px 0', borderBottom: '1px dotted #eee' }}>
                <span style={{ color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ textAlign: 'center', color: '#333' }}>{item.quantity}</span>
                <span style={{ textAlign: 'right', color: '#555' }}>{item.price.toFixed(2)}</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: '#111' }}>{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ borderTop: '2px solid #333', margin: '8px 0 0', padding: '8px 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: '#555' }}>
              <span>Subtotal:</span>
              <span>Rs. {subtotal.toFixed(2)}</span>
            </div>

            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: '#dc2626' }}>
                <span>
                  Discount{order.discountType === 'percentage' ? ` (${order.discountValue}%)` : ''}:
                </span>
                <span>-Rs. {discountAmount.toFixed(2)}</span>
              </div>
            )}

            {order.couponCode && couponDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: '#dc2626' }}>
                <span>Coupon ({order.couponCode}):</span>
                <span>-Rs. {couponDiscount.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: '#555' }}>
              <span>Tax:</span>
              <span>Rs. {taxAmount.toFixed(2)}</span>
            </div>

            {/* Grand Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, padding: '8px 0', borderTop: '2px double #333', borderBottom: '2px double #333', margin: '6px 0', color: '#111' }}>
              <span>TOTAL</span>
              <span>Rs. {order.totalAmount.toFixed(2)}</span>
            </div>

            {/* Cash Details */}
            {order.paymentMethod === 'cash' && !order.isCredit && (
              <div style={{ margin: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px', color: '#555' }}>
                  <span>Amount Tendered:</span>
                  <span>Rs. {(order.tenderedAmount || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#059669' }}>
                  <span>Change Due:</span>
                  <span>Rs. {(order.changeGiven || 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Credit Details */}
            {order.isCredit && (
              <div style={{ margin: '6px 0', border: '1px solid #fde68a', background: '#fffbeb', padding: '6px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px', color: '#92400e' }}>
                  <span>Amount Paid:</span>
                  <span style={{ fontWeight: 700 }}>Rs. {(order.amountPaid || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>
                  <span>Balance Due:</span>
                  <span>Rs. {(order.creditBalance || 0).toFixed(2)}</span>
                </div>
                {order.creditNote && (
                  <p style={{ fontSize: '9px', color: '#b45309', margin: '4px 0 0', fontStyle: 'italic' }}>
                    Note: {order.creditNote}
                  </p>
                )}
              </div>
            )}

            {order.paymentMethod === 'koko' && (
              <div style={{ margin: '6px 0', fontSize: '10px', color: '#6b7280', textAlign: 'center' }}>
                Koko Pay — Buy Now Pay Later
              </div>
            )}
          </div>

          {/* Invoice Barcode */}
          <div style={{ textAlign: 'center', margin: '10px 0 6px', borderTop: '1px dashed #999', paddingTop: '8px' }}>
            <svg ref={barcodeRef} style={{ maxWidth: '200px', display: 'block', margin: '0 auto' }}></svg>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', borderTop: '1px dashed #999', paddingTop: '8px', marginTop: '4px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, margin: '0 0 2px', color: '#333' }}>Thank you for shopping with us!</p>
            <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>
              Items: {order.items?.reduce((s, i) => s + i.quantity, 0)} | {formatDate(order.createdAt)} {formatTime(order.createdAt)}
            </p>
            <p style={{ fontSize: '8px', color: '#aaa', margin: '4px 0 0' }}>
              Powered by {brandName}
            </p>
          </div>
        </div>

        {/* Action buttons — hidden when printing */}
        <div className="pos-invoice-actions no-print">
          <button className="pos-btn-outline" onClick={handlePrint}>
            <Printer size={18} />
            Print Invoice
          </button>
          <button className="pos-btn-green pos-btn-lg" onClick={handleNewSale}>
            <RotateCcw size={18} />
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;

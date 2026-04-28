import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowLeft,
  Camera,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  LogOut,
  CreditCard,
  Banknote,
  Receipt,
  Package,
  AlertTriangle,
  X,
  Percent,
  DollarSign,
  Clock,
  TrendingUp,
  Ticket,
  User,
  Phone,
  Smartphone,
} from 'lucide-react';
import { getPosProducts, getProductByBarcode, posCheckout, getPosOrders, applyVoucher, getSettings, getActivePosSession, startPosSession, endPosSession, getPosPayHereHash, redeemPoints, getMyLoyaltyPoints, getCreditOrders, settleCreditOrder } from '../../services/api';
import usePosStore from '../../store/posStore';
import useAuthStore from '../../store/authStore';
import useSettingsStore from '../../store/settingsStore';
import BarcodeScannerModal from './BarcodeScannerModal';
import InvoiceModal from './InvoiceModal';
import { toast } from 'react-toastify';

const POSScreen = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);
  const brandName = settings?.shopName || 'Zage Fashion Corner';
  const pos = usePosStore();

  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [shiftData, setShiftData] = useState(null);
  const [discountInput, setDiscountInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [discountTypeInput, setDiscountTypeInput] = useState('percentage');
  const [posSession, setPosSession] = useState(null);
  const [showStartSession, setShowStartSession] = useState(false);
  const [showEndSession, setShowEndSession] = useState(false);
  const [dailyFinancials, setDailyFinancials] = useState(null);
  const [balanceOrders, setBalanceOrders] = useState([]);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    opening: { 5000: 0, 1000: 0, 500: 0, 100: 0, 50: 0, 20: 0 },
    closing: { 5000: 0, 1000: 0, 500: 0, 100: 0, 50: 0, 20: 0 },
  });
  const [customerPoints, setCustomerPoints] = useState(0);
  const [pointsInput, setPointsInput] = useState('');
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [isCredit, setIsCredit] = useState(false);
  const [creditAmountPaid, setCreditAmountPaid] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [showCreditPanel, setShowCreditPanel] = useState(false);
  const [creditOrders, setCreditOrders] = useState([]);
  const [creditLoading, setCreditLoading] = useState(false);
  const [settleAmount, setSettleAmount] = useState({});

  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Load initial products + settings for tax rate
  useEffect(() => {
    loadProducts();
    loadTaxRate();
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const { data } = await getActivePosSession();
      setPosSession(data || null);
      if (!data) setShowStartSession(true);
    } catch {
      // ignore
    }
  };

  const denomsToLines = (obj) =>
    Object.entries(obj).map(([denom, qty]) => ({ denom: Number(denom), qty: Number(qty || 0) }));
  const calcTotal = (obj) =>
    Object.entries(obj).reduce((s, [d, q]) => s + Number(d) * Number(q || 0), 0);

  const handleStartSession = async () => {
    try {
      const openingDenoms = denomsToLines(sessionForm.opening);
      const openingCashAmount = calcTotal(sessionForm.opening);
      const { data } = await startPosSession({ openingDenoms, openingCashAmount });
      setPosSession(data);
      setShowStartSession(false);
      toast.success('POS session started');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start session');
    }
  };

  const handleEndSession = async () => {
    try {
      const closingDenoms = denomsToLines(sessionForm.closing);
      const closingCashCountedAmount = calcTotal(sessionForm.closing);
      const { data } = await endPosSession({ closingDenoms, closingCashCountedAmount });
      setPosSession(null);
      setShowEndSession(false);
      toast.success(data.varianceFlagged ? `Session closed (variance Rs. ${data.variance})` : 'Session closed');
      setShowStartSession(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close session');
    }
  };

  const openEndSessionModal = async () => {
    setShowEndSession(true);
  };

  const openBalanceModal = async () => {
    try {
      setBalanceLoading(true);
      const { data } = await getPosOrders();
      setDailyFinancials(data?.summary || null);
      setBalanceOrders(data?.orders || []);
      setShowBalanceModal(true);
    } catch {
      setDailyFinancials(null);
      setBalanceOrders([]);
      setShowBalanceModal(true);
    } finally {
      setBalanceLoading(false);
    }
  };

  const loadTaxRate = async () => {
    try {
      const { data } = await getSettings();
      if (data?.taxRate !== undefined) pos.setTaxRate(data.taxRate);
    } catch (err) { /* use default */ }
  };

  // Focus search on mount
  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
  }, []);

  const loadProducts = async (search = '') => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      const { data } = await getPosProducts(params);
      setProducts(data);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  const handleSearch = (value) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadProducts(value);
    }, 300);
  };

  // Handle search enter (add first result)
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && products.length > 0) {
      e.preventDefault();
      pos.addItem(products[0]);
      toast.success(`Added ${products[0].name}`, { autoClose: 1000 });
      setSearchQuery('');
      loadProducts();
    }
  };

  // Barcode scan handler
  const handleBarcodeScan = async (code) => {
    try {
      const { data } = await getProductByBarcode(code);
      pos.addItem(data);
      toast.success(`Scanned: ${data.name}`, { autoClose: 1500 });
    } catch (err) {
      toast.error(`No product found for barcode: ${code}`);
    }
  };

  // Add product to cart
  const handleAddProduct = (product) => {
    pos.addItem(product);
    toast.success(`Added ${product.name}`, { autoClose: 800 });
  };

  // Apply discount
  const handleApplyDiscount = () => {
    const value = parseFloat(discountInput);
    if (isNaN(value) || value <= 0) {
      toast.error('Enter a valid discount');
      return;
    }
    if (discountTypeInput === 'percentage' && value > 100) {
      toast.error('Percentage cannot exceed 100%');
      return;
    }
    pos.setDiscount(value, discountTypeInput);
    setShowDiscount(false);
    setDiscountInput('');
    toast.success('Discount applied!');
  };

  // Apply coupon/voucher
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) { toast.error('Enter a coupon code'); return; }
    setApplyingCoupon(true);
    try {
      const { data } = await applyVoucher({ code: couponCode.toUpperCase(), orderTotal: pos.getSubtotal() });
      pos.setCoupon({
        code: data.code || couponCode.toUpperCase(),
        value: data.discount || data.value,
        type: data.type || 'percentage',
        maxDiscount: data.maxDiscountAmount,
        description: data.description || '',
      });
      toast.success(`Coupon applied: ${data.description || couponCode.toUpperCase()} 🎉`);
      setCouponCode('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired coupon');
    } finally {
      setApplyingCoupon(false);
    }
  };

  // Checkout handler - for cash, card, koko
  const handleCheckout = async (overrideMethod) => {
    // If called via onClick, the first arg is the event object. Ignore it.
    const method = (typeof overrideMethod === 'string') ? overrideMethod : pos.paymentMethod;
    if (pos.cart.length === 0) {
      toast.warning('Cart is empty');
      return;
    }

    if (method === 'cash' && !isCredit) {
      const tendered = parseFloat(pos.tenderedAmount);
      if (isNaN(tendered) || tendered < pos.getGrandTotal()) {
        toast.error('Tendered amount must be at least the total amount');
        return;
      }
    }

    // PayHere: checkout first, then submit to payment gateway
    if (method === 'payhere') {
      await handlePosPayHere();
      return;
    }

    try {
      setCheckingOut(true);
      const { data } = await posCheckout({
        items: pos.cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          image: item.image,
          quantity: item.quantity,
          price: item.price,
        })),
        paymentMethod: method,
        tenderedAmount: method === 'cash' ? parseFloat(pos.tenderedAmount) : undefined,
        discount: pos.discount,
        discountType: pos.discountType,
        couponCode: pos.coupon?.code || undefined,
        loyaltyPointsRedeemed: pos.loyaltyPointsToRedeem || undefined,
        loyaltyDiscount: pos.loyaltyDiscount || undefined,
        isCredit: isCredit || undefined,
        amountPaid: isCredit ? parseFloat(creditAmountPaid) || 0 : undefined,
        creditNote: isCredit ? creditNote : undefined,
        customerName: pos.customerName || undefined,
        customerPhone: pos.customerPhone || undefined,
        sendSmsReceipt: pos.sendSmsReceipt,
        sendReceiptEmail: pos.sendReceiptEmail,
        receiptEmail: pos.receiptEmail || undefined,
        printReceipt: pos.printReceipt,
      });

      setLastOrder(data);
      setShowInvoice(true);
      if (data?.smsReceiptError) {
        toast.warning(`Sale completed, but SMS failed: ${data.smsReceiptError}`);
      } else {
        toast.success(isCredit ? 'Credit sale recorded! 📋' : 'Sale completed! 🎉');
      }
      setIsCredit(false);
      setCreditAmountPaid('');
      setCreditNote('');

      if (pos.printReceipt) {
        setTimeout(() => window.print(), 350);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  // PayHere POS flow: create order record, get hash, redirect
  const handlePosPayHere = async () => {
    try {
      setCheckingOut(true);
      // 1. Create the POS order as payhere method
      const { data: order } = await posCheckout({
        items: pos.cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          image: item.image,
          quantity: item.quantity,
          price: item.price,
        })),
        paymentMethod: 'payhere',
        discount: pos.discount,
        discountType: pos.discountType,
        couponCode: pos.coupon?.code || undefined,
        customerName: pos.customerName || undefined,
        customerPhone: pos.customerPhone || undefined,
        sendSmsReceipt: pos.sendSmsReceipt,
        sendReceiptEmail: pos.sendReceiptEmail,
        receiptEmail: pos.receiptEmail || undefined,
        printReceipt: pos.printReceipt,
      });

      // 2. Get PayHere hash for this POS order
      const { data: payData } = await getPosPayHereHash({ orderId: order._id, amount: order.totalAmount });

      // 3. Submit to PayHere
      const FRONTEND = 'https://beauty.zage.lk';
      const BACKEND = 'https://zagebeauty.zage.lk';
      const form = document.createElement('form');
      const isSandbox = payData.sandbox;
      form.method = 'POST';
      form.action = isSandbox
        ? 'https://sandbox.payhere.lk/pay/checkout'
        : 'https://www.payhere.lk/pay/checkout';

      const fields = {
        merchant_id: payData.merchant_id,
        return_url: `${FRONTEND}/pos`,
        cancel_url: `${FRONTEND}/pos`,
        notify_url: `${BACKEND}/api/orders/payhere-notify`,
        order_id: payData.order_id,
        items: order.items?.map(i => i.name).join(', ') || 'POS Sale',
        amount: payData.amount,
        currency: payData.currency,
        hash: payData.hash,
        first_name: user?.name?.split(' ')[0] || 'Walk-in',
        last_name: user?.name?.split(' ').slice(1).join(' ') || 'Customer',
        email: order.receiptEmail || user?.email || 'noreply@zage.lk',
        phone: order.customerPhone || user?.phone || '0000000000',
        address: 'Walk-in Store',
        city: 'Colombo',
        country: 'Sri Lanka',
      };

      Object.entries(fields).forEach(([key, val]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = val;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      toast.error(err.response?.data?.message || 'PayHere checkout failed');
      setCheckingOut(false);
    }
  };

  // New sale - clear cart and reload products
  const handleNewSale = () => {
    pos.clearCart();
    setLastOrder(null);
    loadProducts();
    if (searchRef.current) searchRef.current.focus();
  };

  // Shift summary
  const handleShiftSummary = async () => {
    try {
      const { data } = await getPosOrders();
      setShiftData(data);
      setShowShiftSummary(true);
    } catch (err) {
      toast.error('Failed to load shift data');
    }
  };

  // Logout
  const handleLogout = () => {
    pos.clearCart();
    logout();
    navigate('/cashier-login');
  };

  const handleBack = () => {
    if (user?.role === 'admin') {
      navigate('/admin');
      return;
    }
    if (user?.role === 'manager') {
      navigate('/manager');
      return;
    }
    navigate('/employee');
  };

  const subtotal = pos.getSubtotal();
  const discountAmount = pos.getDiscountAmount();
  const couponDiscount = pos.getCouponDiscount();
  const loyaltyDiscount = pos.loyaltyDiscount || 0;
  const totalDiscount = pos.getTotalDiscount();
  const taxPercent = (pos.taxRate * 100).toFixed(0);
  const tax = pos.getTax();
  const grandTotal = pos.getGrandTotal();
  const change = pos.getChange();

  const fetchCustomerPoints = async () => {
    try {
      setLoadingPoints(true);
      const { data } = await getMyLoyaltyPoints();
      setCustomerPoints(data?.points || 0);
    } catch {
      setCustomerPoints(0);
    } finally {
      setLoadingPoints(false);
    }
  };

  const pointValue = settings?.loyaltyPointValue || 1;

  const handleApplyPoints = () => {
    const pts = parseInt(pointsInput);
    if (isNaN(pts) || pts < 10) { toast.error('Minimum 10 points'); return; }
    if (pts > customerPoints) { toast.error('Insufficient points'); return; }
    const discount = pts * pointValue;
    pos.setLoyaltyRedemption(pts, discount);
    toast.success(`${pts} points applied (Rs.${discount} discount)`);
    setPointsInput('');
  };

  const fetchCreditOrders = async () => {
    try {
      setCreditLoading(true);
      const { data } = await getCreditOrders({ status: 'pending' });
      setCreditOrders(data || []);
    } catch (err) {
      toast.error('Failed to load credit orders');
    } finally {
      setCreditLoading(false);
    }
  };

  const handleSettleCredit = async (orderId) => {
    const amt = settleAmount[orderId];
    if (!amt || Number(amt) <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      await settleCreditOrder(orderId, { amount: Number(amt) });
      toast.success('Payment recorded!');
      setSettleAmount((p) => ({ ...p, [orderId]: '' }));
      fetchCreditOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to settle');
    }
  };

  const handleSettleFull = async (orderId) => {
    try {
      await settleCreditOrder(orderId, {});
      toast.success('Credit fully settled! ✅');
      fetchCreditOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to settle');
    }
  };

  return (
    <div className="pos-screen">
      {/* Top Bar */}
      <header className="pos-topbar">
        <div className="pos-topbar-left">
          <ShoppingCart size={26} className="pos-topbar-icon" />
          <h1 className="pos-topbar-title">{brandName} POS</h1>
        </div>
        <div className="pos-topbar-center">
          <span className="pos-topbar-store">{user?.assignedStoreName || 'Store'}</span>
        </div>
        <div className="pos-topbar-right">
          <button className="pos-topbar-btn" onClick={handleBack} title="Back to Dashboard">
            <ArrowLeft size={18} />
            <span className="pos-topbar-btn-text">Back</span>
          </button>
          <button className="pos-topbar-btn" onClick={openEndSessionModal} title="Close POS Session">
            <Clock size={18} />
            <span className="pos-topbar-btn-text">Close</span>
          </button>
          <button className="pos-topbar-btn" onClick={openBalanceModal} title="View Daily Balance">
            <DollarSign size={18} />
            <span className="pos-topbar-btn-text">Balance</span>
          </button>
          <button className="pos-topbar-btn" onClick={handleShiftSummary} title="Shift Summary">
            <TrendingUp size={18} />
            <span className="pos-topbar-btn-text">Shift</span>
          </button>
          <button className="pos-topbar-btn" onClick={() => { setShowCreditPanel(!showCreditPanel); if (!showCreditPanel) fetchCreditOrders(); }} title="Credit Sales" style={showCreditPanel ? {background:'#fef3c7',color:'#92400e'} : {}}>
            📋
            <span className="pos-topbar-btn-text">Credit</span>
          </button>
          <div className="pos-topbar-cashier">
            <div className="pos-topbar-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <span className="pos-topbar-cashier-name">{user?.name}</span>
          </div>
          <button className="pos-topbar-logout" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="pos-main">
        {/* ──────── LEFT PANEL: Products ──────── */}
        <div className="pos-products-panel">
          {/* Search Bar */}
          <div className="pos-search-bar">
            <div className="pos-search-input-wrapper">
              <Search size={20} className="pos-search-icon" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by name, barcode, or SKU... (Enter to quick-add)"
                className="pos-search-input"
              />
              {searchQuery && (
                <button
                  className="pos-search-clear"
                  onClick={() => { setSearchQuery(''); loadProducts(); }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              className="pos-scan-btn"
              onClick={() => setShowScanner(true)}
              title="Scan Barcode"
            >
              <Camera size={22} />
            </button>
          </div>

          {/* Product Grid */}
          <div className="pos-product-grid">
            {loading ? (
              <div className="pos-loading">
                <div className="pos-spinner" />
                <p>Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="pos-empty">
                <Package size={48} />
                <p>No products found</p>
              </div>
            ) : (
              products.map((product) => (
                <div
                  key={product._id}
                  className={`pos-product-card ${product.stock <= 0 ? 'pos-out-of-stock' : ''}`}
                  onClick={() => product.stock > 0 && handleAddProduct(product)}
                >
                  <div className="pos-product-img-wrapper">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="pos-product-img"
                        loading="lazy"
                      />
                    ) : (
                      <div className="pos-product-img-placeholder">
                        <Package size={28} />
                      </div>
                    )}
                    {product.stock <= 5 && product.stock > 0 && (
                      <span className="pos-stock-badge pos-stock-low">Low</span>
                    )}
                    {product.stock <= 0 && (
                      <span className="pos-stock-badge pos-stock-out">Out</span>
                    )}
                  </div>
                  <div className="pos-product-info">
                    <h4 className="pos-product-name">{product.name}</h4>
                    <div className="pos-product-meta">
                      <span className="pos-product-price">Rs. {product.price.toFixed(2)}</span>
                      <span className="pos-product-unit">/{product.unit}</span>
                    </div>
                    <div className="pos-product-stock-row">
                      <span className={`pos-product-stock ${product.stock <= 5 ? 'low' : ''}`}>
                        Stock: {product.stock}
                      </span>
                      {product.barcode && (
                        <span className="pos-product-barcode">{product.barcode}</span>
                      )}
                    </div>
                  </div>
                  {product.stock > 0 && (
                    <button className="pos-product-add-btn">
                      <Plus size={18} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ──────── RIGHT PANEL: Cart ──────── */}
        <div className="pos-cart-panel">
          <div className="pos-cart-header">
            <Receipt size={20} />
            <h2>Current Sale</h2>
            <span className="pos-cart-count">{pos.cart.length} items</span>
          </div>

          {/* Cart Items */}
          <div className="pos-cart-items">
            {pos.cart.length === 0 ? (
              <div className="pos-cart-empty">
                <ShoppingCart size={40} />
                <p>No items added yet</p>
                <span>Search or scan to add products</span>
              </div>
            ) : (
              pos.cart.map((item) => (
                <div key={item.productId} className="pos-cart-item">
                  <div className="pos-cart-item-info">
                    <h4 className="pos-cart-item-name">{item.name}</h4>
                    <p className="pos-cart-item-price">
                      Rs.{item.price.toFixed(2)} × {item.quantity}
                    </p>
                  </div>
                  <div className="pos-cart-item-controls">
                    <div className="pos-qty-controls">
                      <button
                        className="pos-qty-btn"
                        onClick={() => pos.updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="pos-qty-value">{item.quantity}</span>
                      <button
                        className="pos-qty-btn"
                        onClick={() => pos.updateQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= item.stock}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="pos-cart-item-total">
                      Rs.{(item.price * item.quantity).toFixed(2)}
                    </span>
                    <button
                      className="pos-cart-remove"
                      onClick={() => pos.removeItem(item.productId)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals */}
          {pos.cart.length > 0 && (
            <div className="pos-cart-totals" style={{display:'flex', flexDirection:'column', maxHeight:'65vh'}}>
              <div style={{overflowY:'auto', flex:1, paddingRight:'8px', marginBottom:'10px'}}>
                <div className="pos-total-row">
                  <span>Subtotal</span>
                  <span>Rs. {subtotal.toFixed(2)}</span>
                </div>
              {discountAmount > 0 && (
                <div className="pos-total-row pos-discount-row">
                  <span>
                    Discount
                    {pos.discountType === 'percentage' ? ` (${pos.discount}%)` : ''}
                  </span>
                  <span>-Rs. {discountAmount.toFixed(2)}</span>
                  <button
                    className="pos-discount-clear"
                    onClick={() => pos.setDiscount(0, 'percentage')}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="pos-total-row pos-discount-row">
                  <span>
                    🎟️ Coupon ({pos.coupon?.code})
                  </span>
                  <span>-Rs. {couponDiscount.toFixed(2)}</span>
                  <button
                    className="pos-discount-clear"
                    onClick={() => pos.clearCoupon()}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <div className="pos-total-row">
                <span>Tax ({taxPercent}%)</span>
                <span>Rs. {tax.toFixed(2)}</span>
              </div>
              {loyaltyDiscount > 0 && (
                <div className="pos-total-row pos-discount-row">
                  <span>🏆 Loyalty ({pos.loyaltyPointsToRedeem} pts)</span>
                  <span>-Rs. {loyaltyDiscount.toFixed(2)}</span>
                  <button className="pos-discount-clear" onClick={() => pos.clearLoyaltyRedemption()}><X size={12} /></button>
                </div>
              )}

              {/* Coupon Input */}
              <div style={{display:'flex', gap:'6px', marginBottom:'8px'}}>
                <div style={{flex:1, position:'relative'}}>
                  <Ticket size={16} style={{position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af'}} />
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    className="pos-input"
                    style={{paddingLeft:'32px', width:'100%', fontSize:'13px'}}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                  />
                </div>
                <button
                  className="pos-btn-green"
                  onClick={handleApplyCoupon}
                  disabled={applyingCoupon}
                  style={{padding:'8px 14px', fontSize:'12px', whiteSpace:'nowrap'}}
                >
                  {applyingCoupon ? '...' : 'Apply'}
                </button>
              </div>

              {/* Discount Button */}
              <button
                className="pos-apply-discount-btn"
                onClick={() => setShowDiscount(true)}
              >
                <Percent size={16} />
                Apply Discount
              </button>

              {/* Loyalty Points Redemption */}
              <button
                className="pos-apply-discount-btn"
                onClick={() => { setShowLoyalty(!showLoyalty); if (!showLoyalty) fetchCustomerPoints(); }}
                style={{marginTop:'4px', background: showLoyalty ? '#fef3c7' : undefined, color: showLoyalty ? '#92400e' : undefined}}
              >
                🏆 {pos.loyaltyPointsToRedeem > 0 ? `Points Applied: ${pos.loyaltyPointsToRedeem}` : 'Redeem Loyalty Points'}
              </button>
              {showLoyalty && (
                <div style={{background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'10px', padding:'10px', marginBottom:'6px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'6px', fontSize:'12px'}}>
                    <span style={{color:'#92400e', fontWeight:600}}>Available Points:</span>
                    <span style={{fontWeight:700, color:'#d97706'}}>{loadingPoints ? '...' : customerPoints}</span>
                  </div>
                  {pos.loyaltyPointsToRedeem > 0 ? (
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontSize:'12px', color:'#065f46', fontWeight:600}}>✅ {pos.loyaltyPointsToRedeem} pts = Rs.{pos.loyaltyDiscount}</span>
                      <button onClick={() => { pos.clearLoyaltyRedemption(); toast.info('Points cleared'); }} style={{fontSize:'11px', color:'#dc2626', cursor:'pointer', background:'none', border:'none', fontWeight:600}}>Remove</button>
                    </div>
                  ) : (
                    <div style={{display:'flex', gap:'6px'}}>
                      <input type="number" value={pointsInput} onChange={(e) => setPointsInput(e.target.value)} placeholder="Points to redeem" className="pos-input" style={{flex:1, fontSize:'12px'}} min="10" max={customerPoints} />
                      <button className="pos-btn-green" onClick={handleApplyPoints} style={{padding:'6px 14px', fontSize:'12px'}}>Apply</button>
                    </div>
                  )}
                  <p style={{fontSize:'10px', color:'#92400e', marginTop:'6px', marginBottom:0}}>1 point = Rs.{pointValue} discount. Min 10 points.</p>
                </div>
              )}

              {/* Customer Info Toggle */}
              <button
                className="pos-apply-discount-btn"
                onClick={() => setShowCustomerInfo(!showCustomerInfo)}
                style={{marginTop:'4px', background: showCustomerInfo ? '#dbeafe' : undefined, color: showCustomerInfo ? '#2563eb' : undefined}}
              >
                <User size={16} />
                {pos.customerName ? `Customer: ${pos.customerName}` : 'Add Customer Info'}
              </button>
              {showCustomerInfo && (
                <div style={{display:'flex', gap:'6px', marginBottom:'6px'}}>
                  <input
                    type="text"
                    value={pos.customerName}
                    onChange={(e) => pos.setCustomerInfo(e.target.value, pos.customerPhone)}
                    placeholder="Customer name"
                    className="pos-input"
                    style={{flex:1, fontSize:'12px'}}
                  />
                  <input
                    type="tel"
                    value={pos.customerPhone}
                    onChange={(e) => pos.setCustomerInfo(pos.customerName, e.target.value)}
                    placeholder="Phone"
                    className="pos-input"
                    style={{flex:1, fontSize:'12px'}}
                  />
                </div>
              )}

              <div style={{display:'flex', flexDirection:'column', gap:'6px', marginBottom:'10px'}}>
                <label style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#374151'}}>
                  <input
                    type="checkbox"
                    checked={pos.sendSmsReceipt}
                    onChange={(e) => pos.setReceiptOptions({ sendSmsReceipt: e.target.checked, sendReceiptEmail: pos.sendReceiptEmail, receiptEmail: pos.receiptEmail, printReceipt: pos.printReceipt })}
                  />
                  Send SMS Receipt
                </label>
                <label style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#374151'}}>
                  <input
                    type="checkbox"
                    checked={pos.sendReceiptEmail}
                    onChange={(e) => pos.setReceiptOptions({ sendSmsReceipt: pos.sendSmsReceipt, sendReceiptEmail: e.target.checked, receiptEmail: pos.receiptEmail, printReceipt: pos.printReceipt })}
                  />
                  Send Receipt via Email
                </label>
                {pos.sendReceiptEmail && (
                  <input
                    type="email"
                    value={pos.receiptEmail}
                    onChange={(e) => pos.setReceiptOptions({ sendSmsReceipt: pos.sendSmsReceipt, sendReceiptEmail: pos.sendReceiptEmail, receiptEmail: e.target.value, printReceipt: pos.printReceipt })}
                    placeholder="customer@email.com"
                    className="pos-input"
                    style={{fontSize:'12px'}}
                  />
                )}
                <label style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#374151'}}>
                  <input
                    type="checkbox"
                    checked={pos.printReceipt}
                    onChange={(e) => pos.setReceiptOptions({ sendSmsReceipt: pos.sendSmsReceipt, sendReceiptEmail: pos.sendReceiptEmail, receiptEmail: pos.receiptEmail, printReceipt: e.target.checked })}
                  />
                  Print Receipt
                </label>
              </div>

              {/* Payment Method */}
              <div className="pos-payment-methods">
                <button
                  className={`pos-payment-btn ${pos.paymentMethod === 'cash' ? 'active' : ''}`}
                  onClick={() => pos.setPaymentMethod('cash')}
                >
                  <Banknote size={20} />
                  Cash
                </button>
                <button
                  className={`pos-payment-btn ${pos.paymentMethod === 'card' ? 'active' : ''}`}
                  onClick={() => pos.setPaymentMethod('card')}
                >
                  <CreditCard size={20} />
                  Card
                </button>
                <button
                  className={`pos-payment-btn ${pos.paymentMethod === 'koko' ? 'active' : ''}`}
                  onClick={() => pos.setPaymentMethod('koko')}
                  title="Koko Pay - Buy Now Pay Later"
                >
                  <Smartphone size={20} />
                  Koko
                </button>
                <button
                  className={`pos-payment-btn ${pos.paymentMethod === 'payhere' ? 'active' : ''}`}
                  onClick={() => pos.setPaymentMethod('payhere')}
                  title="PayHere - Online Payment"
                  style={{ background: pos.paymentMethod === 'payhere' ? '#6d28d9' : undefined, color: pos.paymentMethod === 'payhere' ? '#fff' : undefined }}
                >
                  <CreditCard size={20} />
                  PayHere
                </button>
              </div>

              {/* Cash tendered */}
              {pos.paymentMethod === 'cash' && !isCredit && (
                <div className="pos-cash-section">
                  <label className="pos-cash-label">Amount Tendered</label>
                  <div className="pos-cash-input-wrapper">
                    <span className="pos-cash-icon" style={{fontSize:'14px', fontWeight:'bold', color:'#9ca3af'}}>Rs.</span>
                    <input
                      type="number"
                      value={pos.tenderedAmount}
                      onChange={(e) => pos.setTenderedAmount(e.target.value)}
                      placeholder="0.00"
                      className="pos-cash-input"
                      min={grandTotal}
                      step="0.01"
                    />
                  </div>
                  {parseFloat(pos.tenderedAmount) >= grandTotal && (
                    <div className="pos-change-display">
                      <span>Change Due:</span>
                      <span className="pos-change-amount">Rs. {change.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Credit Sale Toggle */}
              <label className={`pos-credit-toggle ${isCredit ? 'active' : ''}`}>
                <input type="checkbox" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} />
                <span>📋 Credit Sale (Pay Later)</span>
              </label>
              {isCredit && (
                <div className="pos-credit-fields">
                  <label className="pos-credit-label">Amount Paid Now</label>
                  <input
                    type="number"
                    className="pos-credit-input"
                    value={creditAmountPaid}
                    onChange={(e) => setCreditAmountPaid(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    max={grandTotal}
                    step="0.01"
                  />
                  {creditAmountPaid && parseFloat(creditAmountPaid) < grandTotal && (
                    <div className="pos-credit-pending">
                      <span>Pending Balance</span>
                      <span className="pos-credit-pending-amount">Rs. {(grandTotal - parseFloat(creditAmountPaid || 0)).toFixed(2)}</span>
                    </div>
                  )}
                  <input
                    type="text"
                    className="pos-credit-note-input"
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    placeholder="Note (e.g. customer name, phone)"
                  />
                </div>
              )}
            </div> {/* End of scrollable part */}

              <div className="pos-total-row pos-grand-total">
                <span>TOTAL</span>
                <span>Rs. {grandTotal.toFixed(2)}</span>
              </div>

              {/* Checkout Button */}
              <button
                className="pos-checkout-btn"
                onClick={() => handleCheckout()}
                disabled={checkingOut || pos.cart.length === 0}
                style={isCredit ? {background:'linear-gradient(135deg,#f59e0b,#d97706)'} : {}}
              >
                {checkingOut ? (
                  <span className="pos-spinner-sm" />
                ) : (
                  <>
                    <Receipt size={22} />
                    {isCredit ? `CREDIT SALE — Rs. ${grandTotal.toFixed(2)}` : `CHECKOUT — Rs. ${grandTotal.toFixed(2)}`}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ──────── MODALS ──────── */}

      {/* Barcode Scanner */}
      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />

      {/* Invoice */}
      <InvoiceModal
        isOpen={showInvoice}
        onClose={() => setShowInvoice(false)}
        order={lastOrder}
        onNewSale={handleNewSale}
      />

      {/* Discount Modal */}
      {showDiscount && (
        <div className="pos-modal-overlay" onClick={() => setShowDiscount(false)}>
          <div className="pos-discount-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-discount-header">
              <h3>Apply Discount</h3>
              <button onClick={() => setShowDiscount(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="pos-discount-body">
              <div className="pos-discount-type-toggle">
                <button
                  className={`pos-discount-type-btn ${discountTypeInput === 'percentage' ? 'active' : ''}`}
                  onClick={() => setDiscountTypeInput('percentage')}
                >
                  <Percent size={16} />
                  Percentage
                </button>
                <button
                  className={`pos-discount-type-btn ${discountTypeInput === 'fixed' ? 'active' : ''}`}
                  onClick={() => setDiscountTypeInput('fixed')}
                >
                  <DollarSign size={16} />
                  Fixed Amount
                </button>
              </div>
              <input
                type="number"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder={discountTypeInput === 'percentage' ? 'e.g. 10' : 'e.g. 5.00'}
                className="pos-input pos-discount-input"
                autoFocus
                min="0"
                step="0.01"
              />
              <button className="pos-btn-green pos-btn-lg" onClick={handleApplyDiscount}>
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Summary Modal */}
      {showShiftSummary && shiftData && (
        <div className="pos-modal-overlay" onClick={() => setShowShiftSummary(false)}>
          <div className="pos-shift-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-shift-header">
              <Clock size={22} />
              <h3>Shift Summary</h3>
              <button onClick={() => setShowShiftSummary(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="pos-shift-stats">
              <div className="pos-shift-stat">
                <span className="pos-shift-stat-label">Total Sales</span>
                <span className="pos-shift-stat-value">Rs. {shiftData.summary.totalSales.toFixed(2)}</span>
              </div>
              <div className="pos-shift-stat">
                <span className="pos-shift-stat-label">Transactions</span>
                <span className="pos-shift-stat-value">{shiftData.summary.totalOrders}</span>
              </div>
              <div className="pos-shift-stat">
                <span className="pos-shift-stat-label">Cash Sales</span>
                <span className="pos-shift-stat-value">Rs. {shiftData.summary.cashSales.toFixed(2)}</span>
              </div>
              <div className="pos-shift-stat">
                <span className="pos-shift-stat-label">Card Sales</span>
                <span className="pos-shift-stat-value">Rs. {shiftData.summary.cardSales.toFixed(2)}</span>
              </div>
              <div className="pos-shift-stat">
                <span className="pos-shift-stat-label">Koko Sales</span>
                <span className="pos-shift-stat-value">Rs. {(shiftData.summary.kokoSales || 0).toFixed(2)}</span>
              </div>
            </div>
            {shiftData.orders.length > 0 && (
              <div className="pos-shift-orders">
                <h4>Recent Transactions</h4>
                {shiftData.orders.slice(0, 10).map((order) => (
                  <div key={order._id} className="pos-shift-order-row">
                    <span className="pos-shift-order-id">#{order._id.slice(-6)}</span>
                    <span className="pos-shift-order-method">{order.paymentMethod}</span>
                    <span className="pos-shift-order-items">{order.items.length} items</span>
                    <span className="pos-shift-order-total">Rs. {order.totalAmount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start Session Modal */}
      {showStartSession && (
        <div className="pos-modal-overlay" onClick={() => {}}>
          <div className="pos-shift-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-shift-header">
              <Clock size={22} />
              <h3>Start Day (Opening Cash)</h3>
            </div>
            <div style={{ padding: '16px' }}>
              <p style={{ marginTop: 0, color: '#64748b', fontSize: '13px' }}>Enter opening cash denominations. Total is calculated automatically.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {[5000, 1000, 500, 100, 50, 20].map((d) => (
                  <div key={d}>
                    <label style={{ fontSize: '12px', color: '#374151' }}>{d} LKR</label>
                    <input
                      type="number"
                      min="0"
                      value={sessionForm.opening[d]}
                      onChange={(e) => setSessionForm((s) => ({ ...s, opening: { ...s.opening, [d]: Number(e.target.value || 0) } }))}
                      className="pos-input"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px', fontWeight: 700 }}>Total: Rs. {calcTotal(sessionForm.opening).toFixed(2)}</div>
              <button className="pos-btn-green pos-btn-lg" style={{ marginTop: '14px' }} onClick={handleStartSession}>
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Session Modal */}
      {showEndSession && (
        <div className="pos-modal-overlay" onClick={() => setShowEndSession(false)}>
          <div className="pos-shift-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-shift-header">
              <Clock size={22} />
              <h3>Close Day (Closing Cash)</h3>
              <button onClick={() => setShowEndSession(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: '16px' }}>
              <p style={{ marginTop: 0, color: '#64748b', fontSize: '13px' }}>Count physical cash by denomination. Variance will be flagged automatically.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {[5000, 1000, 500, 100, 50, 20].map((d) => (
                  <div key={d}>
                    <label style={{ fontSize: '12px', color: '#374151' }}>{d} LKR</label>
                    <input
                      type="number"
                      min="0"
                      value={sessionForm.closing[d]}
                      onChange={(e) => setSessionForm((s) => ({ ...s, closing: { ...s.closing, [d]: Number(e.target.value || 0) } }))}
                      className="pos-input"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px', fontWeight: 700 }}>Total: Rs. {calcTotal(sessionForm.closing).toFixed(2)}</div>
              <button className="pos-btn-green pos-btn-lg" style={{ marginTop: '14px' }} onClick={handleEndSession}>
                Close Session
              </button>
            </div>
          </div>
        </div>
      )}

      {showBalanceModal && (
        <div className="pos-modal-overlay" onClick={() => setShowBalanceModal(false)}>
          <div
            className="pos-shift-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0b1220', border: '1px solid #1f2937', color: '#e2e8f0', width: 'min(1200px, 96vw)', maxHeight: '92vh' }}
          >
            <div className="pos-shift-header">
              <DollarSign size={22} />
              <h3>Daily Cash Balance</h3>
              <button onClick={() => setShowBalanceModal(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: '16px', color: '#e2e8f0' }}>
              {balanceLoading ? (
                <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>Loading balance...</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', fontSize: '13px' }}>
                    {[
                      ['Opening Cash', `Rs. ${Number(posSession?.openingCashAmount || 0).toFixed(2)}`],
                      ['Total Sales', `Rs. ${Number(dailyFinancials?.totalSales || 0).toFixed(2)}`],
                      ['Cash Sales', `Rs. ${Number(dailyFinancials?.cashSales || 0).toFixed(2)}`],
                      ['Card Sales', `Rs. ${Number(dailyFinancials?.cardSales || 0).toFixed(2)}`],
                      ['Koko Sales', `Rs. ${Number(dailyFinancials?.kokoSales || 0).toFixed(2)}`],
                      ['Items Sold', `${Number(dailyFinancials?.totalItemsSold || 0)}`],
                      ['System Revenue', `Rs. ${Number(dailyFinancials?.systemRevenue || 0).toFixed(2)}`],
                      ['Profit of Day', `Rs. ${Number(dailyFinancials?.profitOfDay || 0).toFixed(2)}`],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          background: '#111827',
                          border: '1px solid #374151',
                          borderRadius: '10px',
                          padding: '10px',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '14px', padding: '12px', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                      Expected Physical Cash: <strong>Rs. {(Number(posSession?.openingCashAmount || 0) + Number(dailyFinancials?.cashSales || 0)).toFixed(2)}</strong>
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#94a3b8' }}>
                      Formula: Opening cash + Cash sales
                    </div>
                  </div>
                  <div style={{ marginTop: '14px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#cbd5e1' }}>Sales History</h4>
                    <div style={{ maxHeight: '420px', overflow: 'auto', border: '1px solid #334155', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ background: '#111827', position: 'sticky', top: 0 }}>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8' }}>Time</th>
                            <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8' }}>Customer</th>
                            <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8' }}>Items</th>
                            <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8' }}>Payment</th>
                            <th style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>Total</th>
                            <th style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>Profit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balanceOrders.map((order) => (
                            <tr key={order._id} style={{ borderTop: '1px solid #1f2937' }}>
                              <td style={{ padding: '8px', color: '#e2e8f0', verticalAlign: 'top' }}>
                                {new Date(order.createdAt).toLocaleTimeString()}
                              </td>
                              <td style={{ padding: '8px', color: '#cbd5e1', verticalAlign: 'top' }}>
                                <div style={{ fontWeight: 600, color: '#f8fafc' }}>{order.customerName || 'Walk-in Customer'}</div>
                                <div style={{ color: '#94a3b8', marginTop: '2px' }}>{order.customerPhone || '-'}</div>
                              </td>
                              <td style={{ padding: '8px', color: '#cbd5e1' }}>
                                {(order.itemDetails || []).map((it) => `${it.name} x${it.quantity} @ Rs.${Number(it.unitPrice || 0).toFixed(2)}`).join(', ')}
                              </td>
                              <td style={{ padding: '8px', color: '#e2e8f0', textTransform: 'uppercase' }}>
                                {order.paymentMethod}
                              </td>
                              <td style={{ padding: '8px', color: '#f8fafc', textAlign: 'right' }}>
                                Rs. {Number(order.totalAmount || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: '8px', color: Number(order.estimatedProfit || 0) < 0 ? '#fca5a5' : '#86efac', textAlign: 'right', fontWeight: 700 }}>
                                Rs. {Number(order.estimatedProfit || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          {balanceOrders.length === 0 && (
                            <tr>
                              <td colSpan={6} style={{ padding: '10px', color: '#94a3b8', textAlign: 'center' }}>
                                No sales history for today.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credit Orders Panel */}
      {showCreditPanel && (
        <div className="pos-credit-overlay" onClick={() => setShowCreditPanel(false)}>
          <div className="pos-credit-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pos-credit-panel-header">
              <div>
                <h2>📋 Credit Orders</h2>
                <p>{creditOrders.length} pending credit sales</p>
              </div>
              <button className="pos-scanner-close" onClick={() => setShowCreditPanel(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="pos-credit-panel-body">
              {creditLoading ? (
                <div style={{textAlign:'center',padding:'2.5rem'}}><div className="pos-spinner" /></div>
              ) : creditOrders.length === 0 ? (
                <div className="pos-credit-empty">
                  <p>✅</p>
                  <p>No pending credit orders</p>
                </div>
              ) : (
                creditOrders.map((order) => (
                  <div key={order._id} className="pos-credit-card">
                    <div className="pos-credit-card-header">
                      <div>
                        <span className="pos-credit-invoice">{order.invoiceNumber}</span>
                        <span className="pos-credit-date">{new Date(order.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>
                      </div>
                      <span className="pos-credit-badge">
                        Pending: Rs. {Number(order.creditBalance || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="pos-credit-card-info">
                      <div><span>Customer:</span> <strong>{order.customerName || order.customerPhone || 'Walk-in'}</strong></div>
                      <div><span>Total:</span> <strong>Rs. {Number(order.totalAmount).toFixed(2)}</strong></div>
                      <div><span>Paid:</span> <strong style={{color:'#4ade80'}}>Rs. {Number(order.amountPaid || 0).toFixed(2)}</strong></div>
                    </div>
                    {order.creditNote && <p className="pos-credit-card-note">Note: {order.creditNote}</p>}
                    <div className="pos-credit-card-actions">
                      <input
                        type="number"
                        className="pos-credit-settle-input"
                        placeholder="Amount"
                        value={settleAmount[order._id] || ''}
                        onChange={(e) => setSettleAmount((p) => ({...p, [order._id]: e.target.value}))}
                      />
                      <button className="pos-credit-btn pos-credit-btn-partial" onClick={() => handleSettleCredit(order._id)}>
                        Pay Partial
                      </button>
                      <button className="pos-credit-btn pos-credit-btn-full" onClick={() => handleSettleFull(order._id)}>
                        Pay Full
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSScreen;

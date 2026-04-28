import { create } from 'zustand';

const usePosStore = create((set, get) => ({
  cart: [],
  discount: 0,
  discountType: 'percentage', // 'percentage' or 'fixed'
  paymentMethod: 'cash',
  tenderedAmount: '',
  taxRate: 0.05, // 5% default, can be updated from settings
  coupon: null, // { code, value, type, description }
  customerName: '',
  customerPhone: '',
  sendReceiptEmail: false,
  receiptEmail: '',
  sendSmsReceipt: false,
  printReceipt: true,
  loyaltyPointsToRedeem: 0,
  loyaltyDiscount: 0,

  addItem: (product) => {
    const { cart } = get();
    const existing = cart.find((item) => item.productId === product._id);

    if (existing) {
      if (existing.quantity >= product.stock) return;
      set({
        cart: cart.map((item) =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ),
      });
    } else {
      if (product.stock <= 0) return;
      set({
        cart: [
          ...cart,
          {
            productId: product._id,
            name: product.name,
            image: product.images?.[0] || '',
            price: product.price,
            stock: product.stock,
            unit: product.unit,
            barcode: product.barcode || '',
            quantity: 1,
          },
        ],
      });
    }
  },

  removeItem: (productId) => {
    set({ cart: get().cart.filter((item) => item.productId !== productId) });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      cart: get().cart.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.min(quantity, item.stock) }
          : item
      ),
    });
  },

  setDiscount: (value, type) => {
    set({ discount: value, discountType: type });
  },

  setCoupon: (coupon) => {
    set({ coupon });
  },

  clearCoupon: () => {
    set({ coupon: null });
  },

  setPaymentMethod: (method) => {
    set({ paymentMethod: method });
  },

  setTenderedAmount: (amount) => {
    set({ tenderedAmount: amount });
  },

  setTaxRate: (rate) => {
    set({ taxRate: rate });
  },

  setCustomerInfo: (name, phone) => {
    set({ customerName: name, customerPhone: phone });
  },

  setReceiptOptions: (opts) => {
    set({
      sendSmsReceipt: !!opts.sendSmsReceipt,
      sendReceiptEmail: !!opts.sendReceiptEmail,
      receiptEmail: opts.receiptEmail !== undefined ? opts.receiptEmail : get().receiptEmail,
      printReceipt: opts.printReceipt !== false,
    });
  },

  setLoyaltyRedemption: (points, discount) => {
    set({ loyaltyPointsToRedeem: points || 0, loyaltyDiscount: discount || 0 });
  },

  clearLoyaltyRedemption: () => {
    set({ loyaltyPointsToRedeem: 0, loyaltyDiscount: 0 });
  },

  clearCart: () => {
    set({
      cart: [],
      discount: 0,
      discountType: 'percentage',
      paymentMethod: 'cash',
      tenderedAmount: '',
      coupon: null,
      customerName: '',
      customerPhone: '',
      sendReceiptEmail: false,
      receiptEmail: '',
      sendSmsReceipt: false,
      printReceipt: true,
      loyaltyPointsToRedeem: 0,
      loyaltyDiscount: 0,
    });
  },

  // Computed values
  getSubtotal: () => {
    return get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getDiscountAmount: () => {
    const subtotal = get().getSubtotal();
    const { discount, discountType } = get();
    if (!discount || discount <= 0) return 0;
    if (discountType === 'percentage') {
      return (subtotal * discount) / 100;
    }
    return Math.min(discount, subtotal);
  },

  getCouponDiscount: () => {
    const subtotal = get().getSubtotal();
    const { coupon } = get();
    if (!coupon) return 0;
    if (coupon.type === 'percentage') {
      const raw = (subtotal * coupon.value) / 100;
      return coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
    }
    return Math.min(coupon.value, subtotal);
  },

  getTotalDiscount: () => {
    return get().getDiscountAmount() + get().getCouponDiscount() + (get().loyaltyDiscount || 0);
  },

  getTax: () => {
    const subtotal = get().getSubtotal();
    const totalDiscount = get().getTotalDiscount();
    const { taxRate } = get();
    return parseFloat(((subtotal - totalDiscount) * taxRate).toFixed(2));
  },

  getGrandTotal: () => {
    const subtotal = get().getSubtotal();
    const totalDiscount = get().getTotalDiscount();
    const tax = get().getTax();
    return parseFloat(Math.max(0, subtotal - totalDiscount + tax).toFixed(2));
  },

  getChange: () => {
    const { tenderedAmount } = get();
    const total = get().getGrandTotal();
    const tendered = parseFloat(tenderedAmount);
    if (isNaN(tendered) || tendered < total) return 0;
    return parseFloat((tendered - total).toFixed(2));
  },
}));

export default usePosStore;

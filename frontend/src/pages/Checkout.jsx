import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, Clock, CreditCard, Truck, ChevronRight, ShieldCheck, X } from 'lucide-react';
import { motion } from 'framer-motion';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import useCurrencyStore from '../store/currencyStore';
import useSettingsStore from '../store/settingsStore';
import { applyVoucher, createOrder, getMyLoyaltyPoints, getPayHereHash, requestOrderPaymentOtp, verifyOrderPaymentOtp } from '../services/api';
import { toast } from 'react-toastify';

const Checkout = () => {
  const { items, getSubtotal, clearItems } = useCartStore();
  const { user } = useAuthStore();
  const { convertPrice, formatPrice } = useCurrencyStore();
  const navigate = useNavigate();

  const [address, setAddress] = useState({ street: '', city: '', state: '', zipCode: '', country: 'USA' });
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [sendReceiptEmail, setSendReceiptEmail] = useState(false);
  const [receiptEmail, setReceiptEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpOrderId, setOtpOrderId] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [claimedVouchers, setClaimedVouchers] = useState([]);
  const [selectedVoucherCode, setSelectedVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [customerPoints, setCustomerPoints] = useState(0);
  const [pointsInput, setPointsInput] = useState('');
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [showLoyalty, setShowLoyalty] = useState(false);
  const siteSettings = useSettingsStore((s) => s.settings);
  const pointValue = siteSettings?.loyaltyPointValue || 1;

  const subtotal = getSubtotal();
  const deliveryFee = subtotal > 50 ? 0 : 4.99;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const fullTotalBeforeDiscount = subtotal + deliveryFee + tax;
  const total = Math.max(0, fullTotalBeforeDiscount - voucherDiscount - loyaltyDiscount);

  // Pre-fill address from user profile
  useEffect(() => {
    if (user?.addresses?.length > 0) {
      const def = user.addresses.find((a) => a.isDefault) || user.addresses[0];
      setAddress({
        street: def.street || '',
        city: def.city || '',
        state: def.state || '',
        zipCode: def.zipCode || '',
        country: def.country || 'USA',
      });
    }
  }, [user]);

  useEffect(() => {
    const loadClaimedVouchers = async () => {
      if (!user) return;
      try {
        const { data } = await getMyLoyaltyPoints();
        setCustomerPoints(data?.points || 0);
        const available = data?.availableVouchers || [];
        
        // Filter vouchers that are valid for the current cart
        const validVouchers = available.filter(v => {
          // Check min order amount
          if (v.minOrderAmount && subtotal < v.minOrderAmount) return false;
          
          // Check products / categories
          const hasProductRestriction = v.applicableProductIds?.length > 0;
          const hasCategoryRestriction = v.applicableCategoryIds?.length > 0;
          
          if (hasProductRestriction || hasCategoryRestriction) {
            const itemProductIds = items.map(i => i.productId?._id || i.productId);
            const itemCategoryIds = items.map(i => i.productId?.category?._id || i.productId?.category || i.productId?.categoryId?._id || i.productId?.categoryId);
            
            let productMatch = false;
            let categoryMatch = false;
            
            if (hasProductRestriction) {
              productMatch = itemProductIds.some(id => v.applicableProductIds.includes(String(id)));
            }
            if (hasCategoryRestriction) {
              categoryMatch = itemCategoryIds.some(id => v.applicableCategoryIds.includes(String(id)));
            }
            
            if (hasProductRestriction && hasCategoryRestriction) {
              if (!productMatch && !categoryMatch) return false;
            } else if (hasProductRestriction && !productMatch) {
              return false;
            } else if (hasCategoryRestriction && !categoryMatch) {
              return false;
            }
          }
          
          return true;
        });

        setClaimedVouchers(validVouchers);
        
        // Check if currently selected voucher is still valid
        if (selectedVoucherCode) {
          const stillValid = validVouchers.some(v => v.code === selectedVoucherCode);
          if (!stillValid) {
            setSelectedVoucherCode('');
            setVoucherDiscount(0);
            toast.warning('Your applied voucher is no longer valid for the current cart items and was removed.');
          }
        }
      } catch {
        setClaimedVouchers([]);
      }
    };
    loadClaimedVouchers();
  }, [user, subtotal, items]);

  // Generate delivery date options (next 7 days)
  const dateOptions = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dateOptions.push(d.toISOString().split('T')[0]);
  }

  const timeSlots = ['8:00 AM - 10:00 AM', '10:00 AM - 12:00 PM', '12:00 PM - 2:00 PM', '2:00 PM - 4:00 PM', '4:00 PM - 6:00 PM', '6:00 PM - 8:00 PM'];

  const handlePlaceOrder = async () => {
    if (!address.street || !address.city || !address.state || !address.zipCode) {
      toast.error('Please fill in your delivery address');
      return;
    }
    if (!deliveryDate || !deliveryTime) {
      toast.error('Please select a delivery date and time');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        items: items.map((item) => ({
          productId: item.productId?._id || item.productId,
          name: item.productId?.name || item.name,
          image: item.productId?.images?.[0] || item.image,
          quantity: item.quantity,
          price: item.productId?.price || item.price,
          storeId: item.productId?.storeId,
        })),
        deliveryAddress: address,
        deliverySlot: { date: deliveryDate, timeSlot: deliveryTime },
        paymentMethod,
        deliveryFee,
        tax,
        voucherCode: selectedVoucherCode || undefined,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem || undefined,
        loyaltyDiscount: loyaltyDiscount || undefined,
        sendReceiptEmail,
        receiptEmail: sendReceiptEmail ? (receiptEmail || user?.email || '') : undefined,
      };

      const { data: order } = await createOrder(orderData);

      if (paymentMethod === 'payhere') {
        await sendPaymentOtp(order._id);
        setOtpOrderId(order._id);
        setOtpModalOpen(true);
      } else if (paymentMethod === 'koko') {
        clearItems();
        if (order?.splitOrders?.isSplit) {
          toast.info(order.splitOrders.message);
        } else {
          toast.success('Koko order placed successfully!');
        }
        navigate(`/order-confirmation/${order._id}`);
      } else {
        // COD — go to confirmation
        clearItems();
        toast.success('Order placed successfully!');
        navigate(`/order-confirmation/${order._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyVoucher = async (codeToApply) => {
    const code = codeToApply || selectedVoucherCode;
    if (!code) {
      setVoucherDiscount(0);
      return;
    }
    try {
      setApplyingVoucher(true);
      const applyPayload = {
        code,
        orderAmount: fullTotalBeforeDiscount,
        items: items.map((item) => ({
          productId: item.productId?._id || item.productId,
          quantity: item.quantity,
        })),
      };
      const { data } = await applyVoucher(applyPayload);
      setVoucherDiscount(Number(data?.discount || 0));
      toast.success(`Voucher applied: Rs. ${Number(data?.discount || 0).toFixed(2)} off`);
    } catch (err) {
      setVoucherDiscount(0);
      setSelectedVoucherCode('');
      toast.error(err.response?.data?.message || 'Failed to apply voucher');
    } finally {
      setApplyingVoucher(false);
    }
  };

  const sendPaymentOtp = async (orderId) => {
    try {
      setOtpSending(true);
      await requestOrderPaymentOtp(orderId);
      toast.success('Payment OTP sent to your phone');
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to send payment OTP');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyPaymentOtp = async () => {
    if (!otpOrderId) return;
    if (!otpCode || otpCode.trim().length !== 6) {
      toast.error('Enter the 6-digit OTP');
      return;
    }
    try {
      setOtpVerifying(true);
      await verifyOrderPaymentOtp(otpOrderId, { otp: otpCode.trim() });
      const { data: payData } = await getPayHereHash(otpOrderId);
      setOtpModalOpen(false);
      setOtpCode('');
      const payOrder = { _id: otpOrderId, items };
      initiatePayHere(payData, payOrder);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'OTP verification failed');
    } finally {
      setOtpVerifying(false);
    }
  };

  const initiatePayHere = (payData, order) => {
    const FRONTEND = 'https://beauty.zage.lk';
    const BACKEND = 'https://zagebeauty.zage.lk';
    const payment = {
      sandbox: payData.sandbox,
      merchant_id: payData.merchant_id,
      return_url: `${FRONTEND}/order-confirmation/${order._id}`,
      cancel_url: `${FRONTEND}/checkout`,
      notify_url: `${BACKEND}/api/orders/payhere-notify`,
      order_id: payData.order_id,
      items: Array.isArray(order.items) ? order.items.map((i) => i.name).join(', ') : 'Order',
      amount: payData.amount,
      currency: payData.currency,
      hash: payData.hash,
      first_name: user.name.split(' ')[0],
      last_name: user.name.split(' ').slice(1).join(' ') || '',
      email: user.email,
      phone: user.phone || '0000000000',
      address: address.street,
      city: address.city,
      country: 'Sri Lanka',
    };

    if (window.payhere) {
      window.payhere.onCompleted = function () {
        clearItems();
        toast.success('Payment successful!');
        navigate(`/order-confirmation/${order._id}`);
      };
      window.payhere.onDismissed = function () {
        toast.info('Payment cancelled');
      };
      window.payhere.onError = function (error) {
        toast.error('Payment error: ' + error);
      };
      window.payhere.startPayment(payment);
    } else {
      toast.error('PayHere SDK not loaded. Please try again.');
    }
  };

  if (items.length === 0) {
    return (
      <div className="base-container py-20 text-center">
        <h2 className="text-2xl font-bold text-dark-navy mb-2 mt-0">No items to checkout</h2>
        <Link to="/shop" className="text-primary-green font-semibold hover:underline">Go Shopping</Link>
      </div>
    );
  }

  return (
    <div className="base-container py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-dark-navy mt-0 mb-6">Checkout</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left — Forms */}
        <div className="flex-1 space-y-6">
          {/* Delivery Address */}
          <motion.div
            className="bg-white border border-card-border rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          >
            <h3 className="font-bold text-dark-navy mt-0 mb-4 flex items-center gap-2">
              <MapPin size={20} className="text-primary-green" /> Delivery Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-navy mb-1">Street</label>
                <input type="text" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  className="w-full border border-card-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none text-sm" placeholder="123 Main Street" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">City</label>
                <input type="text" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className="w-full border border-card-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none text-sm" placeholder="New York" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">State</label>
                <input type="text" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  className="w-full border border-card-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none text-sm" placeholder="NY" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Zip Code</label>
                <input type="text" value={address.zipCode} onChange={(e) => setAddress({ ...address, zipCode: e.target.value })}
                  className="w-full border border-card-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none text-sm" placeholder="10001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-navy mb-1">Country</label>
                <input type="text" value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })}
                  className="w-full border border-card-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none text-sm" placeholder="USA" />
              </div>
            </div>
          </motion.div>

          {/* Delivery Slot */}
          <motion.div
            className="bg-white border border-card-border rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h3 className="font-bold text-dark-navy mt-0 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-primary-green" /> Delivery Slot
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-dark-navy mb-2">Select Date</label>
              <div className="flex flex-wrap gap-2">
                {dateOptions.map((d) => {
                  const dateObj = new Date(d + 'T00:00:00');
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = dateObj.getDate();
                  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
                  return (
                    <button key={d} type="button" onClick={() => setDeliveryDate(d)}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all text-center min-w-[70px] ${
                        deliveryDate === d ? 'border-primary-green bg-emerald-50 text-primary-green' : 'border-card-border hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs text-muted-text">{dayName}</div>
                      <div className="font-bold">{dayNum}</div>
                      <div className="text-xs">{month}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-navy mb-2">Select Time</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {timeSlots.map((slot) => (
                  <button key={slot} type="button" onClick={() => setDeliveryTime(slot)}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      deliveryTime === slot ? 'border-primary-green bg-emerald-50 text-primary-green' : 'border-card-border hover:border-gray-300'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Voucher */}
          <motion.div
            className="bg-white border border-card-border rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          >
            <h3 className="font-bold text-dark-navy mt-0 mb-4">Voucher</h3>
            {claimedVouchers.length === 0 ? (
              <p className="text-sm text-amber-600 mb-0">No valid vouchers available for current cart items.</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedVoucherCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setSelectedVoucherCode(code);
                    if (code) {
                      handleApplyVoucher(code);
                    } else {
                      setVoucherDiscount(0);
                    }
                  }}
                  className="w-full border border-card-border rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-green"
                >
                  <option value="">Select claimed voucher</option>
                  {claimedVouchers.map((v, idx) => (
                    <option key={`${v.code}-${idx}`} value={v.code}>
                      {v.code} ({v.type === 'percentage' ? `${v.value}%` : `Rs. ${v.value}`})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {voucherDiscount > 0 && (
              <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-sm text-emerald-700 font-semibold mb-0 flex items-center gap-2">
                  <ShieldCheck size={16} /> Voucher discount applied: -Rs. {voucherDiscount.toFixed(2)} deducted from total
                </p>
              </div>
            )}
          </motion.div>

          {/* Loyalty Points */}
          <motion.div
            className="bg-white border border-card-border rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
          >
            <h3 className="font-bold text-dark-navy mt-0 mb-4 flex items-center gap-2">
              🏆 Redeem Loyalty Points
            </h3>
            {!user ? (
              <p className="text-sm text-muted-text mb-0">Login to redeem your loyalty points.</p>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-text">Available Points:</span>
                  <span className="font-bold text-amber-600">{customerPoints}</span>
                </div>
                {loyaltyPointsToRedeem > 0 ? (
                  <div className="flex items-center justify-between bg-amber-50 rounded-xl p-3 border border-amber-100">
                    <span className="text-sm text-emerald-700 font-semibold">✅ {loyaltyPointsToRedeem} pts = Rs.{loyaltyDiscount.toFixed(2)} off</span>
                    <button onClick={() => { setLoyaltyPointsToRedeem(0); setLoyaltyDiscount(0); setPointsInput(''); toast.info('Points removed'); }}
                      className="text-xs text-red-600 font-semibold hover:underline bg-transparent border-none cursor-pointer">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="number" value={pointsInput} onChange={(e) => setPointsInput(e.target.value)}
                      placeholder="Points to redeem (min 10)" min="10" max={customerPoints}
                      className="flex-1 border border-card-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-green outline-none" />
                    <button onClick={() => {
                      const pts = parseInt(pointsInput);
                      if (isNaN(pts) || pts < 10) { toast.error('Minimum 10 points'); return; }
                      if (pts > customerPoints) { toast.error('Insufficient points'); return; }
                      const disc = pts * pointValue;
                      setLoyaltyPointsToRedeem(pts);
                      setLoyaltyDiscount(disc);
                      toast.success(`${pts} points applied (Rs.${disc} discount)`);
                      setPointsInput('');
                    }} className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">Apply</button>
                  </div>
                )}
                <p className="text-xs text-muted-text mt-2 mb-0">1 point = Rs.{pointValue} discount. Minimum 10 points to redeem.</p>
              </div>
            )}
          </motion.div>

          {/* Payment Method */}
          <motion.div
            className="bg-white border border-card-border rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.22 }}
          >
            <h3 className="font-bold text-dark-navy mt-0 mb-4 flex items-center gap-2">
              <CreditCard size={20} className="text-primary-green" /> Payment Method
            </h3>
            <div className="space-y-3">
              {[
                { id: 'cod', label: 'Cash on Delivery', icon: '💵', desc: 'Pay when your order arrives' },
                { id: 'payhere', label: 'PayHere (Card/Bank)', icon: '💳', desc: 'Secure online payment via PayHere' },
                { id: 'koko', label: 'Koko Pay', icon: '📱', desc: 'Buy now and pay later with Koko' },
              ].map((method) => (
                <label key={method.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === method.id ? 'border-primary-green bg-emerald-50' : 'border-card-border hover:border-gray-300'
                  }`}
                >
                  <input type="radio" name="payment" value={method.id} checked={paymentMethod === method.id}
                    onChange={(e) => setPaymentMethod(e.target.value)} className="accent-primary-green" />
                  <span className="text-2xl">{method.icon}</span>
                  <div>
                    <p className="font-semibold text-dark-navy text-sm m-0">{method.label}</p>
                    <p className="text-xs text-muted-text m-0">{method.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="bg-white border border-card-border rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}
          >
            <h3 className="font-bold text-dark-navy mt-0 mb-4">Receipt Delivery</h3>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-card-border cursor-pointer">
              <input
                type="checkbox"
                checked={sendReceiptEmail}
                onChange={(e) => setSendReceiptEmail(e.target.checked)}
                className="accent-primary-green"
              />
              <span className="text-sm text-dark-navy">Send receipt via Email after successful payment</span>
            </label>
            {sendReceiptEmail && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-dark-navy mb-1">Receipt Email</label>
                <input
                  type="email"
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  placeholder={user?.email || 'you@example.com'}
                  className="w-full border border-card-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none text-sm"
                />
              </div>
            )}
          </motion.div>
        </div>

        {/* Right — Order Summary */}
        <div className="lg:w-96">
          <motion.div
            className="bg-white border border-card-border rounded-2xl p-6 sticky top-24"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h3 className="font-bold text-dark-navy text-lg mt-0 mb-4">Order Summary</h3>

            {/* Items preview */}
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {items.map((item) => {
                const product = item.productId || {};
                return (
                  <div key={product._id || item.productId} className="flex items-center gap-3">
                    <img src={product.images?.[0] || item.image || ''} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-navy m-0 truncate">{product.name || item.name}</p>
                      <p className="text-xs text-muted-text m-0">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold text-dark-navy">{formatPrice(convertPrice((product.price || item.price) * item.quantity))}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-card-border pt-4 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-text">Subtotal</span>
                <span className="font-medium">{formatPrice(convertPrice(subtotal))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-text">Delivery</span>
                <span className="font-medium">{deliveryFee === 0 ? <span className="text-primary-green">FREE</span> : formatPrice(convertPrice(deliveryFee))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-text">Tax</span>
                <span className="font-medium">{formatPrice(convertPrice(tax))}</span>
              </div>
              {voucherDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-text">Voucher Discount</span>
                  <span className="font-medium text-emerald-700">- {formatPrice(convertPrice(voucherDiscount))}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-text">🏆 Loyalty ({loyaltyPointsToRedeem} pts)</span>
                  <span className="font-medium text-emerald-700">- {formatPrice(convertPrice(loyaltyDiscount))}</span>
                </div>
              )}
            </div>

            <div className="border-t border-card-border pt-4 mb-6">
              <div className="flex justify-between">
                <span className="font-bold text-dark-navy text-lg">Total</span>
                <span className="font-bold text-dark-navy text-lg">{formatPrice(convertPrice(total))}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={loading}
              className="w-full bg-primary-green text-white font-semibold py-3.5 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Processing...' : paymentMethod === 'payhere' ? 'Pay Now' : paymentMethod === 'koko' ? 'Place Koko Order' : 'Place Order'}
              <ChevronRight size={18} />
            </button>

            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-text">
              <ShieldCheck size={14} className="text-primary-green" />
              <span>Secure & encrypted checkout</span>
            </div>
          </motion.div>
        </div>
      </div>

      {otpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-card-border shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-dark-navy m-0">Verify Payment OTP</h3>
              <button
                onClick={() => setOtpModalOpen(false)}
                className="text-muted-text hover:text-dark-navy"
                aria-label="Close OTP dialog"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-text mb-4">
              Enter the 6-digit OTP sent to your phone to continue with payment.
            </p>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter OTP"
              className="w-full border border-card-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => sendPaymentOtp(otpOrderId)}
                disabled={otpSending || otpVerifying}
                className="flex-1 border border-primary-green text-primary-green font-semibold py-2.5 rounded-xl hover:bg-emerald-50 transition-all disabled:opacity-60"
              >
                {otpSending ? 'Sending...' : 'Resend OTP'}
              </button>
              <button
                onClick={handleVerifyPaymentOtp}
                disabled={otpVerifying || otpSending}
                className="flex-1 bg-primary-green text-white font-semibold py-2.5 rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-60"
              >
                {otpVerifying ? 'Verifying...' : 'Verify & Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;

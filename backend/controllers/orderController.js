const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const Voucher = require('../models/Voucher');
const PaymentOtp = require('../models/PaymentOtp');
const crypto = require('crypto');
const { sendEmail, paymentReceiptEmail, orderConfirmationEmail } = require('../utils/emailService');
const { sendSms, buildPaymentMessage, buildOtpMessage } = require('../utils/smsService');
const { isValidSLPhone, formatSLPhone } = require('../utils/validators');
const { markVoucherAsUsed } = require('./loyaltyController');

const PAYMENT_OTP_EXPIRY_MINUTES = 5;
const PAYMENT_OTP_VERIFY_WINDOW_MINUTES = 15;
const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const buildOrderItems = (items) => items.map((item) => ({
  productId: item.productId,
  name: item.name,
  image: item.image,
  quantity: item.quantity,
  price: item.price,
}));

const calculateTotal = (items, deliveryFee = 0, tax = 0) => {
  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return itemsTotal + (deliveryFee || 0) + (tax || 0);
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res, next) => {
  try {
    const {
      items,
      deliveryAddress,
      deliverySlot,
      paymentMethod,
      deliveryFee,
      tax,
      sendReceiptEmail = false,
      receiptEmail,
      voucherCode,
    } = req.body;

    if (!items || items.length === 0) {
      res.status(400);
      return next(new Error('No order items'));
    }

    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .select('_id allowKokoOnline storeId categoryId')
      .lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const kokoEligibleItems = [];
    const nonKokoItems = [];
    for (const item of items) {
      const dbProduct = productMap.get(String(item.productId));
      if (!dbProduct) {
        res.status(400);
        return next(new Error(`Invalid product in order: ${item.productId}`));
      }
      if (paymentMethod === 'koko' && dbProduct.allowKokoOnline === false) {
        nonKokoItems.push(item);
      } else {
        kokoEligibleItems.push(item);
      }
    }

    // Group items by store
    const storeId = items[0].storeId || productMap.get(String(items[0].productId))?.storeId || null;

    let order;
    let appliedVoucher = null;
    let voucherDiscount = 0;
    let splitOrders = null;
    if (voucherCode) {
      const voucher = await Voucher.findOne({ code: String(voucherCode).toUpperCase(), isActive: true });
      if (!voucher) {
        res.status(400);
        return next(new Error('Invalid voucher code'));
      }
      if (voucher.expiresAt && new Date() > voucher.expiresAt) {
        res.status(400);
        return next(new Error('Voucher has expired'));
      }
      const user = await User.findById(req.user._id).select('vouchers').lean();
      const userVoucher = (user?.vouchers || []).find((v) => v.code === voucher.code && v.isUsed !== true);
      if (!userVoucher) {
        res.status(400);
        return next(new Error('Voucher must be claimed before checkout'));
      }
      const userUsageCount = (voucher.usedBy || []).filter(
        (entry) => String(entry?.userId) === String(req.user._id)
      ).length;
      if (voucher.perUserMaxUses && userUsageCount >= voucher.perUserMaxUses) {
        res.status(400);
        return next(new Error('You have reached your usage limit for this voucher'));
      }
      const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
      const orderAmount = subtotal + Number(deliveryFee || 0) + Number(tax || 0);
      if (voucher.minOrderAmount && orderAmount < voucher.minOrderAmount) {
        res.status(400);
        return next(new Error(`Minimum order amount is Rs.${voucher.minOrderAmount}`));
      }
      const productIdSet = new Set(items.map((it) => String(it.productId)));
      if ((voucher.applicableProductIds || []).length > 0) {
        const allowedProducts = new Set((voucher.applicableProductIds || []).map((id) => String(id)));
        const hasMatchingProduct = [...productIdSet].some((id) => allowedProducts.has(id));
        if (!hasMatchingProduct) {
          res.status(400);
          return next(new Error('Voucher does not match selected products'));
        }
      }
      if ((voucher.applicableCategoryIds || []).length > 0) {
        const allowedCategories = new Set((voucher.applicableCategoryIds || []).map((id) => String(id)));
        const hasMatchingCategory = products.some((p) => allowedCategories.has(String(p.categoryId)));
        if (!hasMatchingCategory) {
          res.status(400);
          return next(new Error('Voucher does not match selected product categories'));
        }
      }
      if (voucher.type === 'percentage') {
        voucherDiscount = Math.round((orderAmount * voucher.value) / 100);
        if (voucher.maxDiscountAmount) voucherDiscount = Math.min(voucherDiscount, voucher.maxDiscountAmount);
      } else {
        voucherDiscount = Number(voucher.value || 0);
      }
      appliedVoucher = voucher;
    }

    if (paymentMethod === 'koko' && nonKokoItems.length > 0) {
      const kokoTotal = calculateTotal(kokoEligibleItems, 0, 0);
      const nonKokoTotal = calculateTotal(nonKokoItems, deliveryFee || 0, tax || 0);

      const kokoOrder = kokoEligibleItems.length
        ? await Order.create({
          userId: req.user._id,
          storeId,
          items: buildOrderItems(kokoEligibleItems),
          deliveryAddress,
          deliverySlot,
          totalAmount: kokoTotal,
          deliveryFee: 0,
          tax: 0,
          paymentMethod: 'koko',
          paymentStatus: 'pending',
          orderStatus: 'pending',
          paymentOtpRequired: false,
          sendReceiptEmail: !!sendReceiptEmail,
          receiptEmail: receiptEmail || undefined,
        })
        : null;

      const fallbackOrder = await Order.create({
        userId: req.user._id,
        storeId,
        items: buildOrderItems(nonKokoItems),
        deliveryAddress,
        deliverySlot,
        totalAmount: nonKokoTotal,
        deliveryFee: deliveryFee || 0,
        tax: tax || 0,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        paymentOtpRequired: false,
        sendReceiptEmail: !!sendReceiptEmail,
        receiptEmail: receiptEmail || undefined,
      });

      order = kokoOrder || fallbackOrder;
      splitOrders = {
        isSplit: true,
        message: 'Some items are not eligible for Koko Pay. Order has been split automatically.',
        kokoOrderId: kokoOrder?._id || null,
        fallbackOrderId: fallbackOrder._id,
      };
    } else {
      const totalAmount = Math.max(0, calculateTotal(items, deliveryFee, tax) - voucherDiscount);
      order = await Order.create({
        userId: req.user._id,
        storeId,
        items: buildOrderItems(items),
        deliveryAddress,
        deliverySlot,
        totalAmount,
        deliveryFee: deliveryFee || 0,
        tax: tax || 0,
        paymentMethod: paymentMethod || 'cod',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        paymentOtpRequired: paymentMethod === 'payhere',
        sendReceiptEmail: !!sendReceiptEmail,
        receiptEmail: receiptEmail || undefined,
        voucherCode: appliedVoucher?.code,
        discountAmount: voucherDiscount,
      });
    }

    if (appliedVoucher && paymentMethod !== 'payhere') {
      await markVoucherAsUsed(req.user._id, appliedVoucher.code);
    }

    // Update product stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
      });
    }

    // Clear user cart
    await Cart.findOneAndUpdate(
      { userId: req.user._id },
      { items: [] }
    );

    res.status(201).json({
      ...order.toObject(),
      splitOrders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/my
// @access  Private
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('storeId', 'name logo');

    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('storeId', 'name logo phone')
      .populate('userId', 'name email');

    if (!order) {
      res.status(404);
      return next(new Error('Order not found'));
    }

    // Verify ownership
    if (
      order.userId._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'manager'
    ) {
      res.status(403);
      return next(new Error('Not authorized'));
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/StoreOwner/Admin
const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404);
      return next(new Error('Order not found'));
    }

    const nextOrderStatus = req.body.orderStatus || order.orderStatus;
    const nextPaymentStatus = req.body.paymentStatus || order.paymentStatus;

    const shouldRestoreStock =
      nextOrderStatus === 'cancelled' &&
      order.orderStatus !== 'cancelled' &&
      order.isPosOrder !== true;

    order.orderStatus = nextOrderStatus;
    order.paymentStatus = nextPaymentStatus;

    const updated = await order.save();

    // If a store owner cancels an order via /orders/:id/status, ensure stock is restored
    if (shouldRestoreStock) {
      for (const item of order.items || []) {
        if (!item?.productId || !item?.quantity) continue;
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity },
        });
      }
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Generate PayHere hash for payment
// @route   POST /api/orders/:id/payhere-hash
// @access  Private
const generatePayHereHash = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      return next(new Error('Order not found'));
    }
    if (order.userId.toString() !== req.user._id.toString()) {
      res.status(403);
      return next(new Error('Not authorized for this order'));
    }

    if (order.paymentMethod === 'payhere') {
      if (!order.paymentOtpVerifiedAt) {
        res.status(403);
        return next(new Error('Payment OTP verification is required before payment.'));
      }
      const maxAgeMs = PAYMENT_OTP_VERIFY_WINDOW_MINUTES * 60 * 1000;
      if (Date.now() - new Date(order.paymentOtpVerifiedAt).getTime() > maxAgeMs) {
        order.paymentOtpVerifiedAt = undefined;
        await order.save();
        res.status(403);
        return next(new Error('Payment OTP expired. Please verify again.'));
      }
    }

    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;

    const orderId = order._id.toString();
    const amount = order.totalAmount.toFixed(2);
    const currency = 'LKR';

    // PayHere hash generation: md5(merchantId + orderId + amountFormatted + currency + md5(merchantSecret))
    const secretHash = crypto
      .createHash('md5')
      .update(merchantSecret)
      .digest('hex')
      .toUpperCase();

    const hash = crypto
      .createHash('md5')
      .update(merchantId + orderId + amount + currency + secretHash)
      .digest('hex')
      .toUpperCase();

    res.json({
      merchant_id: merchantId,
      order_id: orderId,
      amount,
      currency,
      hash,
      sandbox: process.env.PAYHERE_SANDBOX === 'true',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request payment OTP for an order
// @route   POST /api/orders/:id/payment-otp/request
// @access  Private
const requestPaymentOtp = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      return next(new Error('Order not found'));
    }
    if (order.userId.toString() !== req.user._id.toString()) {
      res.status(403);
      return next(new Error('Not authorized for this order'));
    }
    if (order.paymentMethod !== 'payhere') {
      res.status(400);
      return next(new Error('Payment OTP is only required for online payment orders.'));
    }

    const user = await User.findById(req.user._id);
    if (!user?.phone || !isValidSLPhone(user.phone)) {
      res.status(400);
      return next(new Error('A valid Sri Lankan phone number is required to receive OTP.'));
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + PAYMENT_OTP_EXPIRY_MINUTES * 60 * 1000);

    await PaymentOtp.findOneAndUpdate(
      { orderId: order._id },
      {
        orderId: order._id,
        userId: req.user._id,
        otpHash: hashOtp(otp),
        expiresAt,
        attempts: 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    order.paymentOtpVerifiedAt = undefined;
    order.paymentOtpRequired = true;
    await order.save();

    await sendSms(formatSLPhone(user.phone), buildOtpMessage(otp));

    res.json({
      message: 'Payment OTP sent successfully',
      expiresInSeconds: PAYMENT_OTP_EXPIRY_MINUTES * 60,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify payment OTP for an order
// @route   POST /api/orders/:id/payment-otp/verify
// @access  Private
const verifyPaymentOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      res.status(400);
      return next(new Error('OTP is required'));
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      return next(new Error('Order not found'));
    }
    if (order.userId.toString() !== req.user._id.toString()) {
      res.status(403);
      return next(new Error('Not authorized for this order'));
    }

    const paymentOtp = await PaymentOtp.findOne({ orderId: order._id });
    if (!paymentOtp) {
      res.status(400);
      return next(new Error('No payment OTP found. Please request a new OTP.'));
    }
    if (paymentOtp.expiresAt < new Date()) {
      await PaymentOtp.deleteOne({ _id: paymentOtp._id });
      res.status(400);
      return next(new Error('OTP expired. Please request a new OTP.'));
    }
    if (paymentOtp.attempts >= 5) {
      await PaymentOtp.deleteOne({ _id: paymentOtp._id });
      res.status(429);
      return next(new Error('Too many invalid attempts. Request a new OTP.'));
    }

    if (paymentOtp.otpHash !== hashOtp(String(otp).trim())) {
      paymentOtp.attempts += 1;
      await paymentOtp.save();
      res.status(400);
      return next(new Error('Invalid OTP'));
    }

    order.paymentOtpVerifiedAt = new Date();
    order.paymentOtpRequired = false;
    await order.save();
    await PaymentOtp.deleteOne({ _id: paymentOtp._id });

    res.json({ message: 'Payment OTP verified successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    PayHere IPN notification handler
// @route   POST /api/orders/payhere-notify
// @access  Public (called by PayHere)
const payHereNotify = async (req, res, next) => {
  try {
    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
    } = req.body;

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    const secretHash = crypto
      .createHash('md5')
      .update(merchantSecret)
      .digest('hex')
      .toUpperCase();

    const localSig = crypto
      .createHash('md5')
      .update(
        merchant_id +
          order_id +
          payhere_amount +
          payhere_currency +
          status_code +
          secretHash
      )
      .digest('hex')
      .toUpperCase();

    if (localSig !== md5sig) {
      console.error('PayHere IPN signature mismatch');
      return res.status(400).send('Signature mismatch');
    }

    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).send('Order not found');
    }

    // status_code: 2 = success, 0 = pending, -1 = canceled, -2 = failed, -3 = chargeback
    if (status_code === '2') {
      order.paymentStatus = 'completed';
      order.orderStatus = 'confirmed';
      
      if (order.voucherCode) {
        await markVoucherAsUsed(order.userId, order.voucherCode);
      }

      // Send payment receipt email only when user opted in.
      try {
        const customer = await User.findById(order.userId);
        const targetEmail = order.receiptEmail || customer?.email;
        if (order.sendReceiptEmail && targetEmail) {
          const receipt = paymentReceiptEmail(order, customer.name);
          const sent = await sendEmail(targetEmail, receipt.subject, receipt.html);
          if (sent) {
            order.receiptEmailSentAt = new Date();
            order.receiptEmailError = undefined;
          } else {
            order.receiptEmailError = 'Email service failed to deliver receipt';
          }
        }
      } catch (emailErr) {
        console.error('[Email] PayHere receipt failed:', emailErr.message);
        order.receiptEmailError = emailErr.message;
      }

      // Send payment confirmation SMS if customer has a valid Sri Lankan phone.
      try {
        const customer = await User.findById(order.userId);
        if (customer?.phone && isValidSLPhone(customer.phone)) {
          await sendSms(formatSLPhone(customer.phone), buildPaymentMessage(order.totalAmount));
        }
      } catch (smsErr) {
        console.error('[SMS] Payment confirmation failed:', smsErr.message);
      }
    } else if (status_code === '0') {
      order.paymentStatus = 'pending';
    } else {
      order.paymentStatus = 'failed';
    }

    await order.save();
    res.status(200).send('OK');
  } catch (error) {
    console.error('PayHere IPN Error:', error);
    res.status(500).send('Server Error');
  }
};

// @desc    KoKo Pay payment notification handler
// @route   POST /api/orders/koko-notify
// @access  Public (called by KoKo)
const kokoNotify = async (req, res) => {
  try {
    const { order_id, status, payment_id, amount } = req.body;
    if (!order_id) return res.status(400).send('Missing order_id');

    const order = await Order.findById(order_id);
    if (!order) return res.status(404).send('Order not found');

    if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'APPROVED') {
      order.paymentStatus = 'completed';
      order.orderStatus = 'confirmed';
      order.paymentMethod = 'koko';
      if (payment_id) order.kokoPaymentId = payment_id;

      if (order.voucherCode) {
        await markVoucherAsUsed(order.userId, order.voucherCode);
      }

      try {
        const customer = await User.findById(order.userId);
        const installment = (order.totalAmount / 3).toFixed(2);
        const targetEmail = order.receiptEmail || customer?.email;
        if (order.sendReceiptEmail && targetEmail) {
          const receipt = paymentReceiptEmail(order, customer?.name || 'Customer');
          await sendEmail(targetEmail, receipt.subject, receipt.html);
          order.receiptEmailSentAt = new Date();
        }
        if (customer?.phone && isValidSLPhone(customer.phone)) {
          await sendSms(
            formatSLPhone(customer.phone),
            `Payment successful via Koko Pay. You will be charged LKR ${installment} for 3 months.`
          );
        }
      } catch (notifyErr) {
        console.error('[KoKo] Post-payment notification failed:', notifyErr.message);
      }
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      order.paymentStatus = 'failed';
    }

    await order.save();
    res.status(200).send('OK');
  } catch (error) {
    console.error('KoKo IPN Error:', error);
    res.status(500).send('Server Error');
  }
};

// @desc    Generate PayHere hash for POS orders
// @route   POST /api/pos/payhere-hash
// @access  Private/Cashier/Admin/Manager
const generatePosPayHereHash = async (req, res, next) => {
  try {
    const { orderId, amount } = req.body;
    if (!orderId || !amount) {
      res.status(400);
      return next(new Error('orderId and amount are required'));
    }
    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    const amountStr = parseFloat(amount).toFixed(2);
    const currency = 'LKR';

    const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hash = crypto.createHash('md5').update(merchantId + orderId + amountStr + currency + secretHash).digest('hex').toUpperCase();

    res.json({
      merchant_id: merchantId,
      order_id: orderId,
      amount: amountStr,
      currency,
      hash,
      sandbox: process.env.PAYHERE_SANDBOX === 'true',
    });
  } catch (error) { next(error); }
};

// @desc    Get orders for a store owner's store
// @route   GET /api/orders/store
// @access  Private/StoreOwner
const getStoreOrders = async (req, res, next) => {
  try {
    const Store = require('../models/Store');
    const store = await Store.findOne({ managerId: req.user._id });
    if (!store) {
      res.status(404);
      return next(new Error('No store found for this user'));
    }
    const { startDate, endDate, status } = req.query;
    const filter = { storeId: store._id };
    if (status) filter.orderStatus = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(filter)
      .populate('userId', 'name email phone')
      .populate('deliveryGuyId', 'name email phone')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel own order (within 1 hour)
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelMyOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      return next(new Error('Order not found'));
    }
    if (order.userId.toString() !== req.user._id.toString()) {
      res.status(403);
      return next(new Error('Not authorized'));
    }
    if (order.orderStatus === 'cancelled') {
      res.status(400);
      return next(new Error('Order is already cancelled'));
    }
    if (['shipped', 'out_for_delivery', 'delivered', 'completed'].includes(order.orderStatus)) {
      res.status(400);
      return next(new Error('Cannot cancel order at this stage'));
    }
    // 1-hour cancellation window
    const hoursSinceOrder = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceOrder > 1) {
      res.status(400);
      return next(new Error('Cancellation window (1 hour) has expired'));
    }
    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = req.body.reason || 'Cancelled by customer';
    await order.save();
    // Restore stock
    for (const item of order.items || []) {
      if (item?.productId && item?.quantity) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
    }
    res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  generatePayHereHash,
  generatePosPayHereHash,
  requestPaymentOtp,
  verifyPaymentOtp,
  payHereNotify,
  kokoNotify,
  getStoreOrders,
  cancelMyOrder,
};

const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Store = require('../models/Store');
const PosSession = require('../models/PosSession');
const { isValidSLPhone, formatSLPhone, isStrictSLE164Phone, isValidEmail } = require('../utils/validators');
const { sendSms, buildPosReceiptMessage } = require('../utils/smsService');
const { sendEmail, posReceiptEmail } = require('../utils/emailService');

// Helper: resolve store ID for the current user (cashier, manager, or admin)
const resolveStoreId = async (user) => {
  // Cashier / stockEmployee — use assignedStore
  if (user.assignedStore) return user.assignedStore;

  // Manager — find store they manage
  if (user.role === 'manager') {
    const store = await Store.findOne({ managerId: user._id });
    return store?._id || null;
  }

  // Admin — use first store (they can access any)
  if (user.role === 'admin') {
    const store = await Store.findOne({ isActive: true });
    return store?._id || null;
  }

  return null;
};

const ALLOWED_DENOMS_LKR = [5000, 1000, 500, 100, 50, 20];
const calcDenomsTotal = (lines = []) =>
  (lines || []).reduce((s, l) => s + (Number(l.denom || 0) * Number(l.qty || 0)), 0);

// @desc    Get active POS session
// @route   GET /api/pos/session/active
// @access  Private/Cashier/Manager/Admin
const getActiveSession = async (req, res, next) => {
  try {
    const storeId = await resolveStoreId(req.user);
    if (!storeId) { res.status(400); return next(new Error('No store found for your account')); }
    const session = await PosSession.findOne({ storeId, cashierId: req.user._id, status: 'open' }).sort({ startedAt: -1 });
    res.json(session || null);
  } catch (error) { next(error); }
};

// @desc    Start POS session (opening cash + denominations)
// @route   POST /api/pos/session/start
// @access  Private/Cashier/Manager/Admin
const startSession = async (req, res, next) => {
  try {
    const storeId = await resolveStoreId(req.user);
    if (!storeId) { res.status(400); return next(new Error('No store found for your account')); }

    const existing = await PosSession.findOne({ storeId, cashierId: req.user._id, status: 'open' });
    if (existing) return res.status(200).json(existing);

    const openingDenoms = Array.isArray(req.body.openingDenoms) ? req.body.openingDenoms : [];
    for (const l of openingDenoms) {
      if (!ALLOWED_DENOMS_LKR.includes(Number(l.denom))) { res.status(400); return next(new Error('Invalid denomination')); }
      if (Number(l.qty) < 0) { res.status(400); return next(new Error('Invalid denomination qty')); }
    }
    const openingCashAmount = req.body.openingCashAmount !== undefined
      ? Number(req.body.openingCashAmount || 0)
      : calcDenomsTotal(openingDenoms);

    const session = await PosSession.create({
      storeId,
      cashierId: req.user._id,
      startedAt: new Date(),
      status: 'open',
      openingCashAmount,
      openingDenoms,
    });

    res.status(201).json(session);
  } catch (error) { next(error); }
};

// @desc    End POS session (closing cash count + reconciliation)
// @route   POST /api/pos/session/end
// @access  Private/Cashier/Manager/Admin
const endSession = async (req, res, next) => {
  try {
    const storeId = await resolveStoreId(req.user);
    if (!storeId) { res.status(400); return next(new Error('No store found for your account')); }

    const session = await PosSession.findOne({ storeId, cashierId: req.user._id, status: 'open' });
    if (!session) { res.status(404); return next(new Error('No open POS session found')); }

    const closingDenoms = Array.isArray(req.body.closingDenoms) ? req.body.closingDenoms : [];
    for (const l of closingDenoms) {
      if (!ALLOWED_DENOMS_LKR.includes(Number(l.denom))) { res.status(400); return next(new Error('Invalid denomination')); }
      if (Number(l.qty) < 0) { res.status(400); return next(new Error('Invalid denomination qty')); }
    }

    const closingCashCountedAmount = req.body.closingCashCountedAmount !== undefined
      ? Number(req.body.closingCashCountedAmount || 0)
      : calcDenomsTotal(closingDenoms);

    const orders = await Order.find({ posSessionId: session._id, isPosOrder: true });
    const cashSales = orders.filter((o) => o.paymentMethod === 'cash').reduce((s, o) => s + (o.totalAmount || 0), 0);
    const nonCashSales = orders.filter((o) => o.paymentMethod !== 'cash').reduce((s, o) => s + (o.totalAmount || 0), 0);
    const totalSales = cashSales + nonCashSales;
    const totalItemsSold = orders.reduce((s, o) => s + (o.items || []).reduce((x, it) => x + (it.quantity || 0), 0), 0);

    const expectedCash = Number(session.openingCashAmount || 0) + Number(cashSales || 0);
    const variance = Number(closingCashCountedAmount || 0) - expectedCash;

    session.closingDenoms = closingDenoms;
    session.closingCashCountedAmount = closingCashCountedAmount;
    session.expectedCash = Number(expectedCash.toFixed(2));
    session.expectedNonCash = Number(nonCashSales.toFixed(2));
    session.totalSales = Number(totalSales.toFixed(2));
    session.totalItemsSold = totalItemsSold;
    session.variance = Number(variance.toFixed(2));
    session.varianceFlagged = Math.abs(session.variance) > 0.01;
    session.varianceNote = req.body.varianceNote || session.varianceNote;
    session.status = 'closed';
    session.endedAt = new Date();

    await session.save();
    res.json(session);
  } catch (error) { next(error); }
};

// @desc    Get products for POS
// @route   GET /api/pos/products
// @access  Private/Cashier/Manager/Admin
const getPosProducts = async (req, res, next) => {
  try {
    const storeId = await resolveStoreId(req.user);
    if (!storeId) {
      res.status(400);
      return next(new Error('No store found for your account'));
    }

    const { search, category } = req.query;
    const filter = {
      storeId,
      status: 'active',
    };

    if (category) {
      filter.categoryId = category;
    }

    let products;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { barcode: search },
        { sku: { $regex: search, $options: 'i' } },
      ];
      products = await Product.find(filter)
        .select('name price mrp stock images unit barcode sku variants discount allowKokoPos')
        .limit(50)
        .lean();
    } else {
      products = await Product.find(filter)
        .select('name price mrp stock images unit barcode sku variants discount allowKokoPos')
        .limit(100)
        .lean();
    }

    res.json(products);
  } catch (error) {
    next(error);
  }
};

// @desc    Look up a product by barcode
// @route   GET /api/pos/products/barcode/:code
// @access  Private/Cashier/Manager/Admin
const getProductByBarcode = async (req, res, next) => {
  try {
    const storeId = await resolveStoreId(req.user);
    if (!storeId) {
      res.status(400);
      return next(new Error('No store found for your account'));
    }

    const product = await Product.findOne({
      barcode: req.params.code,
      storeId,
      status: 'active',
    })
      .select('name price mrp stock images unit barcode sku variants discount allowKokoPos')
      .lean();

    if (!product) {
      res.status(404);
      return next(new Error('Product not found with this barcode'));
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
};

// @desc    Process POS checkout
// @route   POST /api/pos/checkout
// @access  Private/Cashier
const posCheckout = async (req, res, next) => {
  try {
    const {
      items,
      paymentMethod,
      tenderedAmount,
      discount,
      discountType,
      couponCode,
      customerName,
      customerPhone,
      sendSmsReceipt = false,
      sendReceiptEmail = false,
      receiptEmail,
      printReceipt = true,
      isCredit = false,
      amountPaid = 0,
      creditNote = '',
      loyaltyPointsRedeemed,
      loyaltyDiscount,
    } = req.body;
    let normalizedCustomerPhone = customerPhone ? formatSLPhone(customerPhone) : undefined;
    if (customerPhone && !isValidSLPhone(customerPhone)) {
      res.status(400);
      return next(new Error('Customer phone must be a valid Sri Lankan mobile number.'));
    }
    if (sendSmsReceipt && !normalizedCustomerPhone) {
      res.status(400);
      return next(new Error('Customer phone is required when SMS receipt is enabled.'));
    }
    if (sendSmsReceipt && !isStrictSLE164Phone(normalizedCustomerPhone)) {
      res.status(400);
      return next(new Error('Customer phone must be in +947XXXXXXXX format for SMS receipts.'));
    }
    if (sendReceiptEmail && receiptEmail && !isValidEmail(receiptEmail)) {
      res.status(400);
      return next(new Error('Please enter a valid email address for receipt delivery.'));
    }


    if (!items || items.length === 0) {
      res.status(400);
      return next(new Error('No items in cart'));
    }

    const storeId = await resolveStoreId(req.user);
    if (!storeId) {
      res.status(400);
      return next(new Error('No store found for your account'));
    }

    const activeSession = await PosSession.findOne({ storeId, cashierId: req.user._id, status: 'open' });
    if (!activeSession) {
      res.status(400);
      return next(new Error('No open POS session. Please start the day (opening cash) before checkout.'));
    }

    const store = await Store.findById(storeId);
    if (!store) {
      res.status(404);
      return next(new Error('Store not found'));
    }

    // Validate stock and calculate totals
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        res.status(404);
        return next(new Error(`Product not found: ${item.name || item.productId}`));
      }
      if (product.stock < item.quantity) {
        res.status(400);
        return next(
          new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`)
        );
      }
      if (paymentMethod === 'koko' && product.allowKokoPos === false) {
        res.status(400);
        return next(new Error(`${product.name} is not eligible for Koko Pay in POS.`));
      }

      const lineTotal = item.price * item.quantity;
      subtotal += lineTotal;

      validatedItems.push({
        productId: product._id,
        name: product.name,
        image: product.images?.[0] || '',
        quantity: item.quantity,
        price: item.price,
        unitCostAtSale: Number(product.avgCost || product.lastCost || 0),
      });
    }

    // Calculate manual discount
    let discountAmount = 0;
    if (discount && discount > 0) {
      if (discountType === 'percentage') {
        discountAmount = (subtotal * discount) / 100;
      } else {
        discountAmount = discount;
      }
    }

    // Apply coupon/voucher discount
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      try {
        const Voucher = require('../models/Voucher');
        const voucher = await Voucher.findOne({
          code: couponCode.toUpperCase(),
          isActive: true,
        });
        if (voucher) {
          if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
            // Expired — skip silently
          } else if (voucher.usedCount >= voucher.maxUses) {
            // Max uses reached — skip silently
          } else if (voucher.minOrderAmount && subtotal < voucher.minOrderAmount) {
            // Min order not met — skip silently
          } else {
            if (voucher.type === 'percentage') {
              couponDiscount = (subtotal * voucher.value) / 100;
              if (voucher.maxDiscountAmount) {
                couponDiscount = Math.min(couponDiscount, voucher.maxDiscountAmount);
              }
            } else {
              couponDiscount = Math.min(voucher.value, subtotal);
            }
            // Increment usage
            voucher.usedCount = (voucher.usedCount || 0) + 1;
            await voucher.save();
            appliedCoupon = voucher.code;
          }
        }
      } catch (err) {
        // Voucher model may not exist — skip coupon
      }
    }

    const totalDiscount = discountAmount + couponDiscount;

    // Dynamic tax from settings
    let taxRate = 0.05; // default 5%
    try {
      const Settings = require('../models/Settings');
      const settings = await Settings.findOne();
      if (settings?.taxRate !== undefined) taxRate = settings.taxRate;
    } catch (err) { /* use default */ }

    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const tax = parseFloat((taxableAmount * taxRate).toFixed(2));
    const totalAmount = parseFloat((taxableAmount + tax).toFixed(2));

    // Change calculation for cash
    let changeGiven = 0;
    if (paymentMethod === 'cash' && tenderedAmount && !isCredit) {
      changeGiven = parseFloat((tenderedAmount - totalAmount).toFixed(2));
      if (changeGiven < 0) {
        res.status(400);
        return next(new Error('Tendered amount is less than total'));
      }
    }

    // Generate invoice number (INV-YYYYMMDD-XXXX)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayPosCount = await Order.countDocuments({
      isPosOrder: true,
      createdAt: { $gte: todayStart },
    });
    const invoiceNumber = `INV-${dateStr}-${String(todayPosCount + 1).padStart(4, '0')}`;

    // Credit sale handling
    const creditBalance = isCredit ? Math.max(0, totalAmount - Number(amountPaid || 0)) : 0;

    // Create the POS order
    const order = await Order.create({
      userId: req.user._id,
      storeId,
      items: validatedItems,
      totalAmount,
      tax,
      deliveryFee: 0,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: isCredit && creditBalance > 0 ? 'pending' : 'completed',
      orderStatus: 'completed',
      isPosOrder: true,
      invoiceNumber,
      cashierId: req.user._id,
      posSessionId: activeSession._id,
      tenderedAmount: isCredit ? Number(amountPaid || 0) : (tenderedAmount || totalAmount),
      changeGiven: isCredit ? 0 : changeGiven,
      customerName: customerName || undefined,
      customerPhone: normalizedCustomerPhone || undefined,
      couponCode: appliedCoupon || undefined,
      sendReceiptEmail: !!sendReceiptEmail,
      receiptEmail: receiptEmail || undefined,
      sendSmsReceipt: !!sendSmsReceipt,
      printReceipt: !!printReceipt,
      isCredit: !!isCredit,
      amountPaid: isCredit ? Number(amountPaid || 0) : totalAmount,
      creditBalance,
      creditNote: creditNote || undefined,
      loyaltyPointsRedeemed: loyaltyPointsRedeemed || 0,
      discountAmount: totalDiscount || 0,
    });

    // Deduct stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
      });
    }

    // Return full order with store info for invoice
    const populatedOrder = await Order.findById(order._id)
      .populate('storeId', 'name address phone email logo')
      .populate('cashierId', 'name')
      .lean();

    // Add extra invoice data
    populatedOrder.subtotal = subtotal;
    populatedOrder.discountAmount = discountAmount;
    populatedOrder.discountType = discountType || null;
    populatedOrder.discountValue = discount || 0;
    populatedOrder.couponCode = appliedCoupon;
    populatedOrder.couponDiscount = couponDiscount;
    populatedOrder.sendReceiptEmail = !!sendReceiptEmail;
    populatedOrder.receiptEmail = receiptEmail || undefined;
    populatedOrder.sendSmsReceipt = !!sendSmsReceipt;
    populatedOrder.printReceipt = !!printReceipt;

    if (sendSmsReceipt && normalizedCustomerPhone) {
      try {
        await sendSms(normalizedCustomerPhone, buildPosReceiptMessage(totalAmount));
      } catch (smsErr) {
        populatedOrder.smsReceiptError = smsErr.message;
      }
    }

    if (sendReceiptEmail) {
      try {
        const cashier = await User.findById(req.user._id).select('name email phone').lean();
        const targetEmail = receiptEmail || cashier?.email;
        if (targetEmail) {
          const template = posReceiptEmail(populatedOrder, {
            name: customerName || 'Walk-in Customer',
            email: targetEmail,
            phone: normalizedCustomerPhone || '',
          });
          const sent = await sendEmail(targetEmail, template.subject, template.html);
          if (sent) {
            await Order.findByIdAndUpdate(order._id, { receiptEmailSentAt: new Date(), receiptEmailError: undefined });
          } else {
            await Order.findByIdAndUpdate(order._id, { receiptEmailError: 'Email service failed to deliver receipt' });
            populatedOrder.receiptEmailError = 'Email service failed to deliver receipt';
          }
        }
      } catch (emailErr) {
        populatedOrder.receiptEmailError = emailErr.message;
      }
    }

    res.status(201).json(populatedOrder);
  } catch (error) {
    next(error);
  }
};

// @desc    Get POS orders for today's shift
// @route   GET /api/pos/orders
// @access  Private/Cashier
const getPosOrders = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      cashierId: req.user._id,
      isPosOrder: true,
      createdAt: { $gte: today },
    })
      .sort({ createdAt: -1 })
      .populate('storeId', 'name')
      .lean();

    const productIds = [
      ...new Set(
        orders
          .flatMap((o) => (o.items || [])
            .filter((it) => it.unitCostAtSale === undefined || it.unitCostAtSale === null)
            .map((it) => String(it.productId || ''))
            .filter(Boolean))
      ),
    ];
    const products = productIds.length > 0
      ? await Product.find({ _id: { $in: productIds } }).select('_id avgCost lastCost').lean()
      : [];
    const productCostMap = new Map(
      products.map((p) => [String(p._id), Number(p.avgCost || p.lastCost || 0)])
    );

    // Calculate shift summary
    const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = orders.length;
    const cashSales = orders
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const cardSales = orders
      .filter((o) => o.paymentMethod === 'card')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const kokoSales = orders
      .filter((o) => o.paymentMethod === 'koko')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const totalItemsSold = orders.reduce(
      (sum, o) => sum + (o.items || []).reduce((line, item) => line + Number(item.quantity || 0), 0),
      0
    );
    const enrichedOrders = orders.map((order) => {
      const itemDetails = (order.items || []).map((it) => {
        const qty = Number(it.quantity || 0);
        const unitPrice = Number(it.price || 0);
        const lineTotal = qty * unitPrice;
        const unitCost = it.unitCostAtSale !== undefined && it.unitCostAtSale !== null
          ? Number(it.unitCostAtSale || 0)
          : (productCostMap.get(String(it.productId || '')) || 0);
        const lineProfit = lineTotal - (unitCost * qty);
        return {
          name: it.name || 'Item',
          quantity: qty,
          unitPrice: Number(unitPrice.toFixed(2)),
          lineTotal: Number(lineTotal.toFixed(2)),
          estimatedUnitCost: Number(unitCost.toFixed(2)),
          estimatedProfit: Number(lineProfit.toFixed(2)),
        };
      });
      const estimatedProfit = itemDetails.reduce((sum, it) => sum + Number(it.estimatedProfit || 0), 0);
      return {
        ...order,
        itemDetails,
        estimatedProfit: Number(estimatedProfit.toFixed(2)),
      };
    });
    const profitOfDay = enrichedOrders.reduce((sum, o) => sum + Number(o.estimatedProfit || 0), 0);

    res.json({
      orders: enrichedOrders,
      summary: {
        totalSales: parseFloat(totalSales.toFixed(2)),
        totalOrders,
        cashSales: parseFloat(cashSales.toFixed(2)),
        cardSales: parseFloat(cardSales.toFixed(2)),
        kokoSales: parseFloat(kokoSales.toFixed(2)),
        totalItemsSold,
        systemRevenue: parseFloat(totalSales.toFixed(2)),
        profitOfDay: parseFloat(profitOfDay.toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single POS order (invoice)
// @route   GET /api/pos/orders/:id
// @access  Private/Cashier
const getPosOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('storeId', 'name address phone email logo')
      .populate('cashierId', 'name')
      .lean();

    if (!order) {
      res.status(404);
      return next(new Error('Order not found'));
    }

    if (!order.isPosOrder) {
      res.status(400);
      return next(new Error('This is not a POS order'));
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
};

// @desc    Get cashier-wise sales report
// @route   GET /api/pos/cashier-report
// @access  Private/Admin/Manager
const getCashierSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { isPosOrder: true, orderStatus: { $ne: 'cancelled' } };

    if (req.user.role === 'manager') {
      const storeId = await resolveStoreId(req.user);
      if (storeId) filter.storeId = storeId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    } else {
      // Default: last 30 days
      const d = new Date();
      d.setDate(d.getDate() - 30);
      filter.createdAt = { $gte: d };
    }

    const report = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$cashierId',
          totalSales: { $sum: '$totalAmount' },
          transactionCount: { $sum: 1 },
          totalItems: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } },
          avgTransaction: { $avg: '$totalAmount' },
          cashSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0] } },
          cardSales: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$totalAmount', 0] } },
          lastSale: { $max: '$createdAt' },
        },
      },
      { $sort: { totalSales: -1 } },
    ]);

    // Populate cashier names
    const cashierIds = report.map((r) => r._id).filter(Boolean);
    const cashiers = await User.find({ _id: { $in: cashierIds } }).select('name email role').lean();
    const cashierMap = {};
    cashiers.forEach((c) => { cashierMap[String(c._id)] = c; });

    const enriched = report.map((r) => ({
      cashier: cashierMap[String(r._id)] || { name: 'Unknown', email: '' },
      totalSales: Math.round(r.totalSales * 100) / 100,
      transactionCount: r.transactionCount,
      totalItems: r.totalItems,
      avgTransaction: Math.round(r.avgTransaction * 100) / 100,
      cashSales: Math.round(r.cashSales * 100) / 100,
      cardSales: Math.round(r.cardSales * 100) / 100,
      lastSale: r.lastSale,
    }));

    const totals = {
      totalSales: enriched.reduce((s, r) => s + r.totalSales, 0),
      totalTransactions: enriched.reduce((s, r) => s + r.transactionCount, 0),
      totalItems: enriched.reduce((s, r) => s + r.totalItems, 0),
    };

    res.json({ cashiers: enriched, totals });
  } catch (error) { next(error); }
};

// @desc    Get credit orders (unpaid/partial)
// @route   GET /api/pos/credit-orders
// @access  Private/Cashier/Manager/Admin
const getCreditOrders = async (req, res, next) => {
  try {
    const storeId = await resolveStoreId(req.user);
    const filter = { isPosOrder: true, isCredit: true, storeId };
    if (req.query.status === 'pending') {
      filter.creditBalance = { $gt: 0 };
    } else if (req.query.status === 'settled') {
      filter.creditBalance = 0;
    }
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate('cashierId', 'name')
      .lean();
    res.json(orders);
  } catch (error) { next(error); }
};

// @desc    Settle credit order (mark remaining as paid)
// @route   PUT /api/pos/credit-orders/:id/settle
// @access  Private/Cashier/Manager/Admin
const settleCreditOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) { res.status(404); return next(new Error('Order not found')); }
    if (!order.isCredit) { res.status(400); return next(new Error('This is not a credit order')); }

    const payAmount = Number(req.body.amount || order.creditBalance);
    if (payAmount <= 0) { res.status(400); return next(new Error('Invalid payment amount')); }

    order.amountPaid = Number(order.amountPaid || 0) + payAmount;
    order.creditBalance = Math.max(0, Number(order.totalAmount) - Number(order.amountPaid));
    if (order.creditBalance <= 0) {
      order.creditBalance = 0;
      order.paymentStatus = 'completed';
      order.creditPaidAt = new Date();
    }
    if (req.body.note) order.creditNote = (order.creditNote || '') + ' | ' + req.body.note;
    await order.save();
    res.json(order);
  } catch (error) { next(error); }
};

module.exports = {
  getPosProducts,
  getProductByBarcode,
  posCheckout,
  getPosOrders,
  getPosOrderById,
  getActiveSession,
  startSession,
  endSession,
  getCashierSalesReport,
  getCreditOrders,
  settleCreditOrder,
};

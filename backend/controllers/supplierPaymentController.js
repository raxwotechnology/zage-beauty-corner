const SupplierPayment = require('../models/SupplierPayment');
const Supplier = require('../models/Supplier');
const Store = require('../models/Store');
const mongoose = require('mongoose');

const resolveStoreId = async (req) => {
  if (req.user.role === 'manager') {
    const store = await Store.findOne({ managerId: req.user._id }).select('_id').lean();
    return store?._id || null;
  }
  // Admin: use query/body storeId, or auto-detect first store
  if (req.user.role === 'admin') {
    const explicit = req.body?.storeId || req.query?.storeId;
    if (explicit) return explicit;
    const store = await Store.findOne({}).sort({ createdAt: 1 }).select('_id').lean();
    return store?._id || null;
  }
  return req.body?.storeId || req.query?.storeId || null;
};

// @desc    Get all suppliers with balances
// @route   GET /api/supplier-payments/summary
// @access  Private/Admin/Manager
const getSupplierSummary = async (req, res, next) => {
  try {
    let storeId = await resolveStoreId(req);

    // For admin, if no store found, still show all suppliers
    let supplierFilter = {};
    let paymentMatchFilter = {};
    if (storeId) {
      supplierFilter = { storeId, status: 'active' };
      paymentMatchFilter = { storeId: new mongoose.Types.ObjectId(storeId) };
    } else if (req.user.role === 'admin') {
      // Show all suppliers regardless of store
      supplierFilter = { status: 'active' };
    } else {
      res.status(400);
      return next(new Error('storeId is required'));
    }

    const suppliers = await Supplier.find(supplierFilter).lean();

    // Aggregate balances
    const pipeline = paymentMatchFilter.storeId
      ? [{ $match: paymentMatchFilter }]
      : [];
    pipeline.push({
      $group: {
        _id: '$supplierId',
        totalPurchased: {
          $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, '$amount', 0] },
        },
        totalPaid: {
          $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] },
        },
        transactionCount: { $sum: 1 },
        lastTransaction: { $max: '$date' },
      },
    });

    const balances = await SupplierPayment.aggregate(pipeline);

    const balanceMap = {};
    balances.forEach((b) => {
      balanceMap[String(b._id)] = b;
    });

    const result = suppliers.map((s) => {
      const bal = balanceMap[String(s._id)] || { totalPurchased: 0, totalPaid: 0, transactionCount: 0 };
      return {
        ...s,
        totalPurchased: bal.totalPurchased,
        totalPaid: bal.totalPaid,
        balanceDue: bal.totalPurchased - bal.totalPaid,
        transactionCount: bal.transactionCount,
        lastTransaction: bal.lastTransaction || null,
      };
    });

    // Sort by balance due descending
    result.sort((a, b) => b.balanceDue - a.balanceDue);
    res.json(result);
  } catch (error) { next(error); }
};

// @desc    Get all supplier payments (for export)
// @route   GET /api/supplier-payments/payments
// @access  Private/Admin/Manager
const getSupplierPayments = async (req, res, next) => {
  try {
    let storeId = await resolveStoreId(req);
    const filter = { type: 'payment' };
    if (storeId) {
      filter.storeId = new mongoose.Types.ObjectId(storeId);
    } else if (req.user.role !== 'admin') {
      res.status(400);
      return next(new Error('storeId is required'));
    }

    const payments = await SupplierPayment.find(filter)
      .populate('supplierId', 'name')
      .populate('createdBy', 'name')
      .sort({ date: -1 });

    res.json(payments);
  } catch (error) { next(error); }
};

// @desc    Get ledger for a supplier
// @route   GET /api/supplier-payments/:supplierId/ledger
// @access  Private/Admin/Manager
const getSupplierLedger = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const { startDate, endDate } = req.query;
    const filter = { supplierId };

    // Use the supplier's own storeId to filter ledger
    const supplier = await Supplier.findById(supplierId).lean();
    if (supplier?.storeId) {
      filter.storeId = supplier.storeId;
    } else {
      // Fallback: try resolveStoreId
      const storeId = await resolveStoreId(req);
      if (storeId) filter.storeId = storeId;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const transactions = await SupplierPayment.find(filter)
      .populate('createdBy', 'name')
      .sort({ date: -1 });

    // Calculate running balance
    const sorted = [...transactions].reverse();
    let runningBalance = 0;
    const ledger = sorted.map((t) => {
      if (t.type === 'purchase') runningBalance += t.amount;
      else runningBalance -= t.amount;
      return { ...t.toObject(), runningBalance };
    });

    // supplier already fetched above for storeId resolution

    // Totals
    const totalPurchased = transactions
      .filter((t) => t.type === 'purchase')
      .reduce((s, t) => s + t.amount, 0);
    const totalPaid = transactions
      .filter((t) => t.type === 'payment')
      .reduce((s, t) => s + t.amount, 0);

    res.json({
      supplier,
      transactions: ledger.reverse(),
      totalPurchased,
      totalPaid,
      balanceDue: totalPurchased - totalPaid,
    });
  } catch (error) { next(error); }
};

// @desc    Record a payment to supplier
// @route   POST /api/supplier-payments/:supplierId/pay
// @access  Private/Admin/Manager
const recordPayment = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const { amount, description, paymentMethod, date, chequeNumber, bankName, chequeDate, accountNumber } = req.body;

    if (!amount || amount <= 0) {
      res.status(400);
      return next(new Error('Valid payment amount is required'));
    }

    let storeId = await resolveStoreId(req);

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) { res.status(404); return next(new Error('Supplier not found')); }

    // Use supplier's storeId as fallback
    if (!storeId) storeId = supplier.storeId;
    if (!storeId) { res.status(400); return next(new Error('storeId is required')); }

    const paymentData = {
      supplierId,
      storeId,
      type: 'payment',
      amount,
      description: description || `Payment to ${supplier.name}`,
      paymentMethod: paymentMethod || 'cash',
      date: date || new Date(),
      createdBy: req.user._id,
    };

    if (paymentMethod === 'cheque') {
      if (chequeNumber) paymentData.chequeNumber = chequeNumber;
      if (bankName) paymentData.bankName = bankName;
      if (chequeDate) paymentData.chequeDate = new Date(chequeDate);
      if (accountNumber) paymentData.accountNumber = accountNumber;
    }

    const payment = await SupplierPayment.create(paymentData);

    const populated = await SupplierPayment.findById(payment._id)
      .populate('createdBy', 'name');

    res.status(201).json(populated);
  } catch (error) { next(error); }
};

// @desc    Record a purchase (called internally when stock is received)
// @route   POST /api/supplier-payments/:supplierId/purchase
// @access  Private/Admin/Manager
const recordPurchase = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const { totalCost, amountPaid, description, referenceId } = req.body;

    let storeId = await resolveStoreId(req);

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) { res.status(404); return next(new Error('Supplier not found')); }

    // Use supplier's storeId as fallback
    if (!storeId) storeId = supplier.storeId;
    if (!storeId) { res.status(400); return next(new Error('storeId is required')); }

    // Record the purchase entry
    const purchase = await SupplierPayment.create({
      supplierId,
      storeId,
      type: 'purchase',
      amount: totalCost,
      description: description || `Stock purchase from ${supplier.name}`,
      referenceId: referenceId || null,
      date: new Date(),
      createdBy: req.user._id,
    });

    // If partial or full payment made, record it
    let paymentRecord = null;
    if (amountPaid && amountPaid > 0) {
      paymentRecord = await SupplierPayment.create({
        supplierId,
        storeId,
        type: 'payment',
        amount: amountPaid,
        description: `Payment with stock receipt`,
        referenceId: referenceId || null,
        date: new Date(),
        createdBy: req.user._id,
      });
    }

    res.status(201).json({
      purchase,
      payment: paymentRecord,
      balanceAdded: totalCost - (amountPaid || 0),
    });
  } catch (error) { next(error); }
};

module.exports = {
  getSupplierSummary,
  getSupplierPayments,
  getSupplierLedger,
  recordPayment,
  recordPurchase,
};

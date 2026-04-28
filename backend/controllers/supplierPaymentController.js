const SupplierPayment = require('../models/SupplierPayment');
const Supplier = require('../models/Supplier');
const Store = require('../models/Store');
const mongoose = require('mongoose');

const resolveStoreId = async (req) => {
  if (req.user.role === 'manager') {
    const store = await Store.findOne({ managerId: req.user._id }).select('_id').lean();
    return store?._id || null;
  }
  // Admin: use query/body storeId, or null (all stores)
  if (req.user.role === 'admin') {
    return req.body?.storeId || req.query?.storeId || null;
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
      paymentMatchFilter = { storeId: new mongoose.Types.ObjectId(String(storeId)) };
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
      filter.storeId = new mongoose.Types.ObjectId(String(storeId));
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

    // If date filter is applied, we need the opening balance from before startDate
    let openingBalance = 0;
    if (startDate) {
      const beforeFilter = {
        supplierId,
        date: { $lt: new Date(startDate) }
      };
      if (filter.storeId) beforeFilter.storeId = filter.storeId;
      
      const beforeResults = await SupplierPayment.aggregate([
        { $match: beforeFilter },
        {
          $group: {
            _id: null,
            purchases: { $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, '$amount', 0] } },
            payments: { $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] } }
          }
        }
      ]);
      if (beforeResults.length > 0) {
        openingBalance = beforeResults[0].purchases - beforeResults[0].payments;
      }
    }

    // Calculate running balance
    const sorted = [...transactions].reverse();
    let runningBalance = openingBalance;
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

    // Cheque summary
    const chequePayments = transactions.filter((t) => t.type === 'payment' && t.paymentMethod === 'cheque');
    let allCheques = [];
    chequePayments.forEach((cp) => {
      if (cp.cheques && cp.cheques.length > 0) {
        cp.cheques.forEach((ch) => {
          allCheques.push({ ...ch.toObject ? ch.toObject() : ch, paymentId: cp._id, date: cp.date });
        });
      } else if (cp.chequeNumber) {
        allCheques.push({
          chequeNumber: cp.chequeNumber,
          bankName: cp.bankName,
          chequeDate: cp.chequeDate,
          amount: cp.amount,
          accountNumber: cp.accountNumber,
          status: cp.chequeStatus || 'pending',
          paymentId: cp._id,
          date: cp.date,
        });
      }
    });

    const chequeSummary = {
      totalCheques: allCheques.length,
      paid: allCheques.filter((c) => c.status === 'paid').length,
      pending: allCheques.filter((c) => c.status === 'pending').length,
      bounced: allCheques.filter((c) => c.status === 'bounced').length,
      cheques: allCheques,
    };

    res.json({
      supplier,
      transactions: ledger.reverse(),
      totalPurchased,
      totalPaid,
      balanceDue: totalPurchased - totalPaid,
      chequeSummary,
    });
  } catch (error) { next(error); }
};

// @desc    Record a payment to supplier
// @route   POST /api/supplier-payments/:supplierId/pay
// @access  Private/Admin/Manager
const recordPayment = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const { amount, description, paymentMethod, date, chequeNumber, bankName, chequeDate, accountNumber, cheques } = req.body;

    if (!amount || amount <= 0) {
      res.status(400);
      return next(new Error('Valid payment amount is required'));
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) { res.status(404); return next(new Error('Supplier not found')); }

    // Use supplier's storeId as the primary source of truth for the ledger
    const storeId = supplier.storeId || (await resolveStoreId(req));
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
      // Multi-cheque support
      if (Array.isArray(cheques) && cheques.length > 0) {
        paymentData.cheques = cheques.map((ch) => ({
          chequeNumber: ch.chequeNumber,
          bankName: ch.bankName,
          chequeDate: ch.chequeDate ? new Date(ch.chequeDate) : new Date(),
          amount: Number(ch.amount || 0),
          accountNumber: ch.accountNumber || '',
          status: ch.status || 'pending',
        }));
      }
      // Single cheque (backward compat)
      if (chequeNumber) paymentData.chequeNumber = chequeNumber;
      if (bankName) paymentData.bankName = bankName;
      if (chequeDate) paymentData.chequeDate = new Date(chequeDate);
      if (accountNumber) paymentData.accountNumber = accountNumber;
      paymentData.chequeStatus = 'pending';
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

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) { res.status(404); return next(new Error('Supplier not found')); }

    // Use supplier's storeId as the primary source of truth for the ledger
    const storeId = supplier.storeId || (await resolveStoreId(req));
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

// @desc    Update a supplier payment/purchase transaction
// @route   PUT /api/supplier-payments/transaction/:id
// @access  Private/Admin/Manager
const updateTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, description, paymentMethod, date } = req.body;
    const transaction = await SupplierPayment.findById(id);
    if (!transaction) { res.status(404); return next(new Error('Transaction not found')); }
    if (amount !== undefined && amount > 0) transaction.amount = amount;
    if (description !== undefined) transaction.description = description;
    if (paymentMethod) transaction.paymentMethod = paymentMethod;
    if (date) transaction.date = new Date(date);
    await transaction.save();
    const populated = await SupplierPayment.findById(id).populate('createdBy', 'name');
    res.json(populated);
  } catch (error) { next(error); }
};

// @desc    Delete a supplier payment/purchase transaction
// @route   DELETE /api/supplier-payments/transaction/:id
// @access  Private/Admin
const deleteTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transaction = await SupplierPayment.findById(id);
    if (!transaction) { res.status(404); return next(new Error('Transaction not found')); }
    await SupplierPayment.findByIdAndDelete(id);
    res.json({ message: 'Transaction deleted' });
  } catch (error) { next(error); }
};

// @desc    Update cheque status (single or multi)
// @route   PUT /api/supplier-payments/cheque-status/:id
// @access  Private/Admin/Manager
const updateChequeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { chequeStatus, chequeIndex, status } = req.body;
    const transaction = await SupplierPayment.findById(id);
    if (!transaction) { res.status(404); return next(new Error('Transaction not found')); }

    // Update specific cheque in multi-cheque array
    if (chequeIndex !== undefined && transaction.cheques && transaction.cheques[chequeIndex]) {
      transaction.cheques[chequeIndex].status = status || chequeStatus || 'pending';
    } else {
      // Update top-level cheque status
      transaction.chequeStatus = chequeStatus || status || 'pending';
    }

    await transaction.save();
    const populated = await SupplierPayment.findById(id).populate('createdBy', 'name');
    res.json(populated);
  } catch (error) { next(error); }
};

module.exports = {
  getSupplierSummary,
  getSupplierPayments,
  getSupplierLedger,
  recordPayment,
  recordPurchase,
  updateTransaction,
  deleteTransaction,
  updateChequeStatus,
};

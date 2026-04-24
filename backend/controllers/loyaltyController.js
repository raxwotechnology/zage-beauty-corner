const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const Voucher = require('../models/Voucher');
const User = require('../models/User');
const Product = require('../models/Product');

const normalizeUserVouchers = (vouchers = []) => {
  const now = Date.now();
  const deduped = new Map();
  for (const voucher of vouchers) {
    if (!voucher?.code) continue;
    if (voucher.isUsed) continue;
    if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() <= now) continue;
    // Keep only one voucher option per code for UI, but preserve a count for visibility.
    const key = String(voucher.code).toUpperCase();
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, {
        ...voucher.toObject?.() || voucher,
        code: key,
        duplicateCount: 1,
      });
    } else {
      existing.duplicateCount += 1;
    }
  }
  return [...deduped.values()];
};

// @desc    Get my loyalty points
// @route   GET /api/loyalty/points
// @access  Private
const getMyPoints = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('loyaltyPoints vouchers')
      .populate({
        path: 'vouchers.voucherId',
        select: 'applicableProductIds applicableCategoryIds'
      });
      
    // Merge populated data back into vouchers
    const mergedVouchers = (user.vouchers || []).map(v => {
      const vObj = v.toObject ? v.toObject() : v;
      if (vObj.voucherId) {
        vObj.applicableProductIds = vObj.voucherId.applicableProductIds;
        vObj.applicableCategoryIds = vObj.voucherId.applicableCategoryIds;
        // Re-assign voucherId to just the ID string to avoid breaking other things
        vObj.voucherId = vObj.voucherId._id;
      }
      return vObj;
    });

    const availableVouchers = normalizeUserVouchers(mergedVouchers);
    res.json({
      points: user.loyaltyPoints || 0,
      vouchers: mergedVouchers,
      availableVouchers,
    });
  } catch (error) { next(error); }
};

// @desc    Get loyalty transaction history
// @route   GET /api/loyalty/history
// @access  Private
const getLoyaltyHistory = async (req, res, next) => {
  try {
    const transactions = await LoyaltyTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(transactions);
  } catch (error) { next(error); }
};

// @desc    Redeem points for discount (100 points = Rs.100)
// @route   POST /api/loyalty/redeem
// @access  Private
const redeemPoints = async (req, res, next) => {
  try {
    const { points } = req.body;
    if (!points || points < 10) {
      res.status(400);
      return next(new Error('Minimum 10 points to redeem'));
    }

    const user = await User.findById(req.user._id);
    if (user.loyaltyPoints < points) {
      res.status(400);
      return next(new Error('Insufficient loyalty points'));
    }

    const discountLKR = points; // 1 point = Rs.1
    user.loyaltyPoints -= points;
    await user.save();

    await LoyaltyTransaction.create({
      userId: user._id,
      type: 'redeemed',
      points: -points,
      description: `Redeemed ${points} points for Rs.${discountLKR} discount`,
      balanceAfter: user.loyaltyPoints,
    });

    res.json({
      message: `Redeemed ${points} points`,
      discount: discountLKR,
      remainingPoints: user.loyaltyPoints,
    });
  } catch (error) { next(error); }
};

// @desc    Award bonus points (admin/manager)
// @route   POST /api/loyalty/bonus
// @access  Private/Admin
const issueBonusPoints = async (req, res, next) => {
  try {
    const { userId, points, reason } = req.body;
    if (!userId || !points) {
      res.status(400);
      return next(new Error('userId and points required'));
    }

    const user = await User.findById(userId);
    if (!user) { res.status(404); return next(new Error('User not found')); }

    user.loyaltyPoints = (user.loyaltyPoints || 0) + points;
    await user.save();

    await LoyaltyTransaction.create({
      userId: user._id,
      type: 'bonus',
      points,
      description: reason || `Bonus: ${points} points awarded`,
      balanceAfter: user.loyaltyPoints,
    });

    res.json({ message: `${points} bonus points awarded to ${user.name}`, newBalance: user.loyaltyPoints });
  } catch (error) { next(error); }
};

// @desc    Apply voucher code
// @route   POST /api/loyalty/voucher/apply
// @access  Private
const applyVoucher = async (req, res, next) => {
  try {
    const { code, orderAmount, items = [] } = req.body;
    const voucher = await Voucher.findOne({ code: code.toUpperCase(), isActive: true });

    if (!voucher) { res.status(404); return next(new Error('Invalid or expired voucher code')); }
    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      res.status(400); return next(new Error('Voucher has expired'));
    }
    if (voucher.maxUses && voucher.usedCount >= voucher.maxUses) {
      res.status(400); return next(new Error('Voucher usage limit reached'));
    }
    if (voucher.minOrderAmount && orderAmount < voucher.minOrderAmount) {
      res.status(400);
      return next(new Error(`Minimum order amount is Rs.${voucher.minOrderAmount}`));
    }

    // Optional product/category constraints
    if ((voucher.applicableProductIds?.length || voucher.applicableCategoryIds?.length) && Array.isArray(items) && items.length > 0) {
      const itemProductIds = items.map((it) => String(it.productId)).filter(Boolean);
      const allowedProductIds = new Set((voucher.applicableProductIds || []).map((id) => String(id)));
      if (allowedProductIds.size > 0 && !itemProductIds.some((id) => allowedProductIds.has(id))) {
        res.status(400);
        return next(new Error('Voucher does not match selected products'));
      }
      if ((voucher.applicableCategoryIds || []).length > 0) {
        const products = await Product.find({ _id: { $in: itemProductIds } }).select('_id categoryId').lean();
        const allowedCategoryIds = new Set((voucher.applicableCategoryIds || []).map((id) => String(id)));
        const hasMatchingCategory = products.some((p) => allowedCategoryIds.has(String(p.categoryId)));
        if (!hasMatchingCategory) {
          res.status(400);
          return next(new Error('Voucher does not match selected product categories'));
        }
      }
    }

    const userUsageCount = (voucher.usedBy || []).filter(
      (entry) => String(entry?.userId) === String(req.user._id)
    ).length;
    if (voucher.perUserMaxUses && userUsageCount >= voucher.perUserMaxUses) {
      res.status(400); return next(new Error('You have already used this voucher'));
    }

    let discount = 0;
    if (voucher.type === 'percentage') {
      discount = Math.round((orderAmount * voucher.value) / 100);
      if (voucher.maxDiscountAmount) discount = Math.min(discount, voucher.maxDiscountAmount);
    } else {
      discount = voucher.value;
    }

    res.json({
      valid: true,
      code: voucher.code,
      type: voucher.type,
      discount,
      description: voucher.description,
    });
  } catch (error) { next(error); }
};

// @desc    Apply promo code (same as voucher for now)
// @route   POST /api/loyalty/promo/apply
// @access  Private
const applyPromoCode = async (req, res, next) => {
  req.body.code = req.body.promoCode || req.body.code;
  return applyVoucher(req, res, next);
};

// @desc    Claim a voucher to user account
// @route   POST /api/loyalty/vouchers/:code/claim
// @access  Private
const claimVoucher = async (req, res, next) => {
  try {
    const code = String(req.params.code || '').toUpperCase();
    if (!code) {
      res.status(400);
      return next(new Error('Voucher code is required'));
    }

    const voucher = await Voucher.findOne({ code, isActive: true });
    if (!voucher) {
      res.status(404);
      return next(new Error('Voucher not found'));
    }
    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      res.status(400);
      return next(new Error('Voucher has expired'));
    }

    const user = await User.findById(req.user._id);
    user.vouchers.push({
      voucherId: voucher._id,
      code: voucher.code,
      type: voucher.type,
      value: voucher.value,
      minOrderAmount: voucher.minOrderAmount || 0,
      expiresAt: voucher.expiresAt,
      isUsed: false,
      claimedAt: new Date(),
    });
    await user.save();

    res.json({ message: 'Voucher claimed successfully' });
  } catch (error) { next(error); }
};

// @desc    Get available vouchers for user
// @route   GET /api/loyalty/vouchers
// @access  Private
const getAvailableVouchers = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('vouchers').lean();
    const claimedCodes = new Set((user?.vouchers || []).map(v => v.code));

    const vouchers = await Voucher.find({
      isActive: true,
      $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }, { expiresAt: { $exists: false } }],
    }).select('code type value minOrderAmount maxDiscountAmount description expiresAt perUserMaxUses maxUses usedCount applicableProductIds applicableCategoryIds').lean();
    
    // Deduplicate by code so UI does not show duplicate options.
    const deduped = new Map();
    for (const voucher of vouchers) {
      if (claimedCodes.has(voucher.code)) continue;
      if ((voucher.usedCount || 0) >= (voucher.maxUses || 9999)) continue;
      if (!deduped.has(voucher.code)) deduped.set(voucher.code, voucher);
    }
    res.json([...deduped.values()]);
  } catch (error) { next(error); }
};

// @desc    Get all vouchers for admin/manager
// @route   GET /api/loyalty/vouchers/admin
// @access  Private/Admin/Manager
const getAllVouchers = async (req, res, next) => {
  try {
    const vouchers = await Voucher.find({})
      .sort({ createdAt: -1 })
      .select('code type value minOrderAmount maxDiscountAmount maxUses perUserMaxUses usedCount expiresAt isActive description source applicableProductIds applicableCategoryIds');
    res.json(vouchers);
  } catch (error) { next(error); }
};

// @desc    Create voucher
// @route   POST /api/loyalty/vouchers
// @access  Private/Admin/Manager
const createVoucher = async (req, res, next) => {
  try {
    const {
      code, type, value, minOrderAmount, maxDiscountAmount, maxUses, description, expiresAt, source,
      perUserMaxUses, applicableProductIds = [], applicableCategoryIds = [],
    } = req.body;
    const exists = await Voucher.findOne({ code: code.toUpperCase() });
    if (exists) { res.status(400); return next(new Error('Voucher code already exists')); }
    const voucher = await Voucher.create({
      code: code.toUpperCase(),
      type,
      value,
      minOrderAmount: minOrderAmount || 0,
      maxDiscountAmount,
      maxUses: maxUses || 9999,
      perUserMaxUses: perUserMaxUses || 1,
      description,
      expiresAt: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      source: source || 'admin',
      isActive: true,
      usedCount: 0,
      applicableProductIds,
      applicableCategoryIds,
    });
    res.status(201).json(voucher);
  } catch (error) { next(error); }
};

// @desc    Update voucher
// @route   PUT /api/loyalty/vouchers/:id
// @access  Private/Admin/Manager
const updateVoucher = async (req, res, next) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) { res.status(404); return next(new Error('Voucher not found')); }
    Object.assign(voucher, req.body);
    if (req.body.code) voucher.code = req.body.code.toUpperCase();
    await voucher.save();
    res.json(voucher);
  } catch (error) { next(error); }
};

// @desc    Delete voucher
// @route   DELETE /api/loyalty/vouchers/:id
// @access  Private/Admin/Manager
const deleteVoucher = async (req, res, next) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) { res.status(404); return next(new Error('Voucher not found')); }
    await voucher.deleteOne();
    res.json({ message: 'Voucher deleted' });
  } catch (error) { next(error); }
};

/**
 * Helper: Award loyalty points after order (called from orderController)
 */
const awardOrderPoints = async (userId, orderTotal, currency = 'LKR') => {
  try {
    const POINTS_PER_100_LKR = parseInt(process.env.LOYALTY_POINTS_PER_100_LKR) || 1;
    const POINTS_PER_1_USD = parseInt(process.env.LOYALTY_POINTS_PER_1_USD) || 3;
    let points = 0;
    if (currency === 'USD') { points = Math.floor(orderTotal * POINTS_PER_1_USD); }
    else { points = Math.floor(orderTotal / 100) * POINTS_PER_100_LKR; }
    if (points > 0) {
      const user = await User.findById(userId);
      user.loyaltyPoints = (user.loyaltyPoints || 0) + points;
      await user.save();
      await LoyaltyTransaction.create({ userId, type: 'earned', points, description: `Earned from order (${currency} ${orderTotal.toFixed(2)})`, balanceAfter: user.loyaltyPoints });
    }
    return points;
  } catch (error) { console.error('Failed to award loyalty points:', error.message); return 0; }
};

/**
 * Helper: Mark a voucher as used after successful payment
 */
const markVoucherAsUsed = async (userId, code) => {
  try {
    const voucher = await Voucher.findOne({ code: String(code).toUpperCase() });
    if (!voucher) return false;

    voucher.usedCount = Number(voucher.usedCount || 0) + 1;
    if (!Array.isArray(voucher.usedBy)) voucher.usedBy = [];
    voucher.usedBy.push({ userId, usedAt: new Date() });
    await voucher.save();

    const userDoc = await User.findById(userId);
    if (userDoc) {
      const voucherIndex = (userDoc.vouchers || []).findIndex(
        (v) => v.code === voucher.code && v.isUsed !== true
      );
      if (voucherIndex >= 0) {
        userDoc.vouchers[voucherIndex].isUsed = true;
        userDoc.vouchers[voucherIndex].usedAt = new Date();
        await userDoc.save();
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Failed to mark voucher as used:', error);
    return false;
  }
};

module.exports = {
  getMyPoints, getLoyaltyHistory, redeemPoints, issueBonusPoints,
  applyVoucher, applyPromoCode, getAvailableVouchers,
  getAllVouchers,
  claimVoucher,
  createVoucher, updateVoucher, deleteVoucher,
  awardOrderPoints, markVoucherAsUsed,
};

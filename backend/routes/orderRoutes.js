const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public IPN callbacks (no auth)
router.post('/payhere-notify', payHereNotify);
router.post('/koko-notify', kokoNotify);

// Protected routes
router.route('/').post(protect, createOrder);
router.route('/my').get(protect, getMyOrders);
router.route('/store').get(protect, authorize('manager'), getStoreOrders);
router.route('/pos/payhere-hash').post(protect, generatePosPayHereHash);
router.route('/:id').get(protect, getOrderById);
router.route('/:id/status').put(protect, authorize('manager', 'admin'), updateOrderStatus);
router.route('/:id/payhere-hash').post(protect, generatePayHereHash);
router.route('/:id/payment-otp/request').post(protect, requestPaymentOtp);
router.route('/:id/payment-otp/verify').post(protect, verifyPaymentOtp);
router.route('/:id/cancel').put(protect, cancelMyOrder);

module.exports = router;


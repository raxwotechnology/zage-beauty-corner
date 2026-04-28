const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/posController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All POS routes require cashier, manager or admin role
router.use(protect, authorize('cashier', 'manager', 'admin'));

router.get('/products', getPosProducts);
router.get('/products/barcode/:code', getProductByBarcode);
router.post('/checkout', posCheckout);
router.get('/orders', getPosOrders);
router.get('/orders/:id', getPosOrderById);
router.get('/session/active', getActiveSession);
router.post('/session/start', startSession);
router.post('/session/end', endSession);
router.get('/cashier-report', getCashierSalesReport);
router.get('/credit-orders', getCreditOrders);
router.put('/credit-orders/:id/settle', settleCreditOrder);

module.exports = router;

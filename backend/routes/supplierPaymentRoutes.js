const express = require('express');
const router = express.Router();
const {
  getSupplierSummary,
  getSupplierPayments,
  getSupplierLedger,
  recordPayment,
  recordPurchase,
} = require('../controllers/supplierPaymentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary', authorize('admin', 'manager'), getSupplierSummary);
router.get('/payments', authorize('admin', 'manager'), getSupplierPayments);
router.get('/:supplierId/ledger', authorize('admin', 'manager'), getSupplierLedger);
router.post('/:supplierId/pay', authorize('admin', 'manager'), recordPayment);
router.post('/:supplierId/purchase', authorize('admin', 'manager'), recordPurchase);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createStockReceipt,
  listStockReceipts,
  getReceiptByGRN,
  createSupplierReturn,
  listSupplierReturns,
} = require('../controllers/stockController');

router.use(protect, authorize('admin', 'manager', 'stockEmployee', 'cashier'));

router.route('/receipts')
  .get(listStockReceipts)
  .post(createStockReceipt);

router.get('/receipts/grn/:grnNumber', getReceiptByGRN);

router.route('/supplier-returns')
  .get(listSupplierReturns)
  .post(createSupplierReturn);

module.exports = router;

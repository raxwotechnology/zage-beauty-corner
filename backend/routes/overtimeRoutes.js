const express = require('express');
const router = express.Router();
const {
  getOvertimeRecords,
  getOvertimeSummary,
  createOvertimeRecord,
  markOvertimePaid,
  deleteOvertimeRecord,
  getEmployeeOTReport,
  getMyOvertime,
  rejectOvertimeRecord,
} = require('../controllers/overtimeController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Employee self-service route (must be before admin-only middleware)
router.get('/my', protect, getMyOvertime);

// Admin-only routes
router.get('/', protect, authorize('admin'), getOvertimeRecords);
router.post('/', protect, authorize('admin'), createOvertimeRecord);
router.get('/summary', protect, authorize('admin'), getOvertimeSummary);
router.get('/employee/:employeeId', protect, authorize('admin'), getEmployeeOTReport);
router.put('/:id/pay', protect, authorize('admin'), markOvertimePaid);
router.put('/:id/reject', protect, authorize('admin'), rejectOvertimeRecord);
router.delete('/:id', protect, authorize('admin'), deleteOvertimeRecord);

module.exports = router;

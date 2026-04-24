const express = require('express');
const router = express.Router();
const {
  checkIn, checkOut, getMyAttendance, getAttendanceReport,
  requestLeave, getMyLeaves, getStoreLeaves, approveLeave, rejectLeave,
  getEmployees, addEmployee, updateEmployee,
  startBreak, endBreak, getBreakHistory, getActiveBreak,
  createTarget, getTargets, getMyTargets, updateTargetProgress, payTargetBonus,
  getEmployeePerformance,
  adminMarkAttendance, adminCreateLeave, deleteTarget
} = require('../controllers/hrController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Attendance
router.post('/attendance/check-in', authorize('cashier', 'deliveryGuy', 'stockEmployee', 'manager'), checkIn);
router.post('/attendance/check-out', authorize('cashier', 'deliveryGuy', 'stockEmployee', 'manager'), checkOut);
router.get('/attendance', getMyAttendance);
router.get('/attendance/report', authorize('manager', 'admin'), getAttendanceReport);
router.post('/attendance/mark', authorize('manager', 'admin'), adminMarkAttendance);

// Leaves
router.post('/leaves', requestLeave);
router.get('/leaves', getMyLeaves);
router.get('/leaves/store', authorize('manager', 'admin'), getStoreLeaves);
router.put('/leaves/:id/approve', authorize('manager', 'admin'), approveLeave);
router.put('/leaves/:id/reject', authorize('manager', 'admin'), rejectLeave);
router.post('/leaves/create-for-employee', authorize('manager', 'admin'), adminCreateLeave);

// Employees
router.get('/employees', authorize('manager', 'admin'), getEmployees);
router.post('/employees', authorize('manager', 'admin'), addEmployee);
router.put('/employees/:id', authorize('manager', 'admin'), updateEmployee);

// Breaks
router.post('/breaks/start', authorize('cashier', 'deliveryGuy', 'stockEmployee', 'manager'), startBreak);
router.post('/breaks/end', authorize('cashier', 'deliveryGuy', 'stockEmployee', 'manager'), endBreak);
router.get('/breaks/active', getActiveBreak);
router.get('/breaks', getBreakHistory);

// Targets
router.post('/targets', authorize('manager', 'admin'), createTarget);
router.get('/targets/me', getMyTargets);
router.get('/targets', authorize('manager', 'admin'), getTargets);
router.put('/targets/:id/progress', authorize('manager', 'admin'), updateTargetProgress);
router.put('/targets/:id/pay-bonus', authorize('manager', 'admin'), payTargetBonus);
router.delete('/targets/:id', authorize('manager', 'admin'), deleteTarget);

// Performance
router.get('/performance/:employeeId', authorize('manager', 'admin'), getEmployeePerformance);

module.exports = router;

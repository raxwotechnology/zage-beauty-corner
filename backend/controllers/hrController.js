const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const User = require('../models/User');
const Store = require('../models/Store');
const { sendNotification } = require('../utils/notificationService');

const notifyAdmins = async ({ type, title, message, link, metadata }) => {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id email').lean();
  await Promise.all(
    (admins || []).map((a) =>
      sendNotification({
        userId: a._id,
        userEmail: a.email,
        type,
        title,
        message,
        link,
        metadata,
      })
    )
  );
};

const notifyStoreManager = async ({ storeId, type, title, message, link, metadata }) => {
  if (!storeId) return;
  const store = await Store.findById(storeId).select('managerId').lean();
  if (!store?.managerId) return;
  const manager = await User.findById(store.managerId).select('_id email isActive').lean();
  if (!manager?.isActive) return;
  await sendNotification({
    userId: manager._id,
    userEmail: manager.email,
    type,
    title,
    message,
    link,
    metadata,
  });
};

// @desc    Delete target
// @route   DELETE /api/hr/targets/:id
const deleteTarget = async (req, res, next) => {
  try {
    const target = await EmployeeTarget.findById(req.params.id);
    if (!target) { res.status(404); return next(new Error('Target not found')); }
    await target.deleteOne();
    res.json({ message: 'Target removed' });
  } catch (error) { next(error); }
};

// =================== PERFORMANCE ===================

// =================== ATTENDANCE ===================

// @desc    Check in
// @route   POST /api/hr/attendance/check-in
// @access  Private (cashier, deliveryGuy, manager)
const checkIn = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await Attendance.findOne({
      employeeId: req.user._id,
      date: { $gte: today },
    });

    if (existing) {
      res.status(400);
      return next(new Error('Already checked in today'));
    }

    const attendance = await Attendance.create({
      employeeId: req.user._id,
      storeId: req.user.assignedStore || null,
      date: new Date(),
      checkIn: new Date(),
      status: 'present',
    });

    res.status(201).json(attendance);
  } catch (error) { next(error); }
};

// @desc    Check out
// @route   POST /api/hr/attendance/check-out
// @access  Private
const checkOut = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employeeId: req.user._id,
      date: { $gte: today },
      checkOut: null,
    });

    if (!attendance) {
      res.status(400);
      return next(new Error('No active check-in found for today'));
    }

    attendance.checkOut = new Date();
    const diff = attendance.checkOut - attendance.checkIn;
    attendance.hoursWorked = parseFloat((diff / (1000 * 60 * 60)).toFixed(2));
    if (attendance.hoursWorked >= 8) attendance.overtime = parseFloat((attendance.hoursWorked - 8).toFixed(2));

    await attendance.save();
    res.json(attendance);
  } catch (error) { next(error); }
};

// @desc    Get my attendance records
// @route   GET /api/hr/attendance
// @access  Private
const getMyAttendance = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const filter = { employeeId: req.user._id };

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const records = await Attendance.find(filter).sort({ date: -1 }).limit(31);
    res.json(records);
  } catch (error) { next(error); }
};

// @desc    Get attendance report for store (manager)
// @route   GET /api/hr/attendance/report
// @access  Private/Manager/Admin
const getAttendanceReport = async (req, res, next) => {
  try {
    const { month, year, storeId } = req.query;
    const filter = {};

    if (storeId) {
      filter.storeId = storeId;
    }
    // Note: Removed automatic storeId filtering for managers so they can view all employees' attendance.

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const records = await Attendance.find(filter)
      .populate('employeeId', 'name email role phone')
      .sort({ date: -1 });

    res.json(records);
  } catch (error) { next(error); }
};

// =================== LEAVES ===================

// @desc    Request leave
// @route   POST /api/hr/leaves
// @access  Private
const requestLeave = async (req, res, next) => {
  try {
    const { type, startDate, endDate, reason } = req.body;

    // Calculate days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await Leave.create({
      employeeId: req.user._id,
      storeId: req.user.assignedStore || null,
      leaveType: type || 'casual',
      startDate: start,
      endDate: end,
      totalDays,
      reason,
      status: 'pending',
    });

    const metadata = {
      leaveId: leave._id,
      storeId: leave.storeId,
      employeeId: leave.employeeId,
      status: leave.status,
    };
    const title = 'New Leave Request';
    const message = `${req.user.name} requested ${leave.leaveType} leave (${leave.totalDays} day${leave.totalDays > 1 ? 's' : ''}).`;

    // Always notify Admin(s)
    await notifyAdmins({
      type: 'leave_request',
      title,
      message,
      link: '/admin/employees',
      metadata,
    });

    // Notify Manager only if requester is not the manager
    if (req.user.role !== 'manager') {
      await notifyStoreManager({
        storeId: leave.storeId,
        type: 'leave_request',
        title,
        message,
        link: '/manager/employees',
        metadata,
      });
    }

    res.status(201).json(leave);
  } catch (error) { next(error); }
};

// @desc    Get my leaves
// @route   GET /api/hr/leaves
// @access  Private
const getMyLeaves = async (req, res, next) => {
  try {
    const leaves = await Leave.find({ employeeId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) { next(error); }
};

// @desc    Get all leaves for store (manager)
// @route   GET /api/hr/leaves/store
// @access  Private/Manager/Admin
const getStoreLeaves = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.storeId) {
      filter.storeId = req.query.storeId;
    }
    if (req.query.status) filter.status = req.query.status;

    const leaves = await Leave.find(filter)
      .populate('employeeId', 'name email role employeeInfo')
      .sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) { next(error); }
};

// @desc    Approve leave
// @route   PUT /api/hr/leaves/:id/approve
// @access  Private/Manager/Admin
const approveLeave = async (req, res, next) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) { res.status(404); return next(new Error('Leave not found')); }

    leave.status = 'approved';
    leave.approvedBy = req.user._id;
    await leave.save();

    // Mark attendance as 'leave' for the period
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      await Attendance.findOneAndUpdate(
        { employeeId: leave.employeeId, date: { $gte: new Date(d.setHours(0,0,0,0)), $lt: new Date(d.setHours(23,59,59,999)) } },
        { employeeId: leave.employeeId, date: new Date(d), status: 'leave', storeId: leave.storeId },
        { upsert: true }
      );
    }

    // Notify employee
    await sendNotification({
      userId: leave.employeeId,
      type: 'leave_update',
      title: 'Leave Approved ✅',
      message: `Your ${leave.leaveType} leave from ${leave.startDate.toLocaleDateString()} to ${leave.endDate.toLocaleDateString()} has been approved.`,
      link: '/employee/leaves',
    });

    const meta = { leaveId: leave._id, storeId: leave.storeId, employeeId: leave.employeeId, status: leave.status, approvedBy: req.user._id };
    if (req.user.role === 'manager') {
      await notifyAdmins({
        type: 'leave_decision',
        title: 'Leave Approved',
        message: `Manager approved a ${leave.leaveType} leave request.`,
        link: '/admin/employees',
        metadata: meta,
      });
    }
    if (req.user.role === 'admin') {
      await notifyStoreManager({
        storeId: leave.storeId,
        type: 'leave_decision',
        title: 'Leave Approved',
        message: `Admin approved ${leave.leaveType} leave.`,
        link: '/manager/employees',
        metadata: meta,
      });
    }

    res.json(leave);
  } catch (error) { next(error); }
};

// @desc    Reject leave
// @route   PUT /api/hr/leaves/:id/reject
// @access  Private/Manager/Admin
const rejectLeave = async (req, res, next) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) { res.status(404); return next(new Error('Leave not found')); }

    leave.status = 'rejected';
    leave.rejectionReason = req.body.reason || 'Request denied';
    leave.approvedBy = req.user._id;
    await leave.save();

    await sendNotification({
      userId: leave.employeeId,
      type: 'leave_update',
      title: 'Leave Rejected ❌',
      message: `Your ${leave.leaveType} leave request was rejected. Reason: ${leave.rejectionReason}`,
      link: '/employee/leaves',
    });

    const meta = { leaveId: leave._id, storeId: leave.storeId, employeeId: leave.employeeId, status: leave.status, approvedBy: req.user._id };
    if (req.user.role === 'manager') {
      await notifyAdmins({
        type: 'leave_decision',
        title: 'Leave Rejected',
        message: `Manager rejected ${leave.leaveType} leave. Reason: ${leave.rejectionReason}`,
        link: '/admin/employees',
        metadata: meta,
      });
    }
    if (req.user.role === 'admin') {
      await notifyStoreManager({
        storeId: leave.storeId,
        type: 'leave_decision',
        title: 'Leave Rejected',
        message: `Admin rejected ${leave.leaveType} leave. Reason: ${leave.rejectionReason}`,
        link: '/manager/employees',
        metadata: meta,
      });
    }

    res.json(leave);
  } catch (error) { next(error); }
};

// =================== EMPLOYEES ===================

// @desc    Get employees (for manager's store)
// @route   GET /api/hr/employees
// @access  Private/Manager/Admin
const getEmployees = async (req, res, next) => {
  try {
    const roles = ['cashier', 'deliveryGuy', 'stockEmployee'];
    if (String(req.query.includeManagers || '').toLowerCase() === 'true' || req.user.role === 'manager' || req.user.role === 'admin') {
      roles.push('manager');
    }
    const filter = { role: { $in: roles } };
    if (req.query.storeId) filter.assignedStore = req.query.storeId;

    // By user request, managers should see all employees in the system, including themselves and other managers.
    // So we do not apply any store-specific filtering here.

    const employees = await User.find(filter)
      .select('name email phone role assignedStore employeeInfo createdAt')
      .populate('assignedStore', 'name')
      .sort({ createdAt: -1 });

    res.json(employees);
  } catch (error) { next(error); }
};

// @desc    Update employee info
// @route   PUT /api/hr/employees/:id
// @access  Private/Manager/Admin
const updateEmployee = async (req, res, next) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) { res.status(404); return next(new Error('Employee not found')); }

    if (req.body.salary !== undefined) employee.employeeInfo.salary = req.body.salary;
    if (req.body.department) employee.employeeInfo.department = req.body.department;
    if (req.body.bankAccount) employee.employeeInfo.bankAccount = req.body.bankAccount;
    if (req.body.bankName) employee.employeeInfo.bankName = req.body.bankName;
    if (req.body.epfNo) employee.employeeInfo.epfNo = req.body.epfNo;
    if (req.body.etfNo) employee.employeeInfo.etfNo = req.body.etfNo;
    if (req.body.assignedStore) employee.assignedStore = req.body.assignedStore;

    await employee.save();
    res.json(employee);
  } catch (error) { next(error); }
};

// @desc    Register new employee (cashier/deliveryGuy)
// @route   POST /api/hr/employees
// @access  Private/Manager/Admin
const addEmployee = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, salary, department, bankAccount, bankName, epfNo, etfNo } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      return next(new Error('Name, email and password are required'));
    }

    const allowedRoles = req.user.role === 'admin'
      ? ['cashier', 'deliveryGuy', 'stockEmployee', 'manager']
      : ['cashier', 'deliveryGuy', 'stockEmployee'];
    if (!allowedRoles.includes(role)) {
      res.status(400);
      return next(new Error('Employee role is not allowed for your account'));
    }

    // Check if email exists
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400);
      return next(new Error('A user with this email already exists'));
    }

    // Get manager's store
    let storeId = req.body.assignedStore;
    if (!storeId && req.user.role === 'manager') {
      const store = await Store.findOne({ managerId: req.user._id });
      if (store) storeId = store._id;
    }

    const employee = await User.create({
      name,
      email,
      password,
      phone: phone || '',
      role,
      assignedStore: storeId || undefined,
      employeeInfo: {
        salary: salary || 0,
        department: department || '',
        joinDate: new Date(),
        bankAccount: bankAccount || '',
        bankName: bankName || '',
        epfNo: epfNo || '',
        etfNo: etfNo || '',
      },
    });

    const result = await User.findById(employee._id)
      .select('-password')
      .populate('assignedStore', 'name');

    res.status(201).json(result);
  } catch (error) { next(error); }
};

// =================== BREAKS ===================

const EmployeeBreak = require('../models/EmployeeBreak');

// @desc    Start break
// @route   POST /api/hr/breaks/start
const startBreak = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already on break
    const activeBreak = await EmployeeBreak.findOne({
      employeeId: req.user._id,
      date: { $gte: today },
      breakEnd: null,
    });
    if (activeBreak) {
      res.status(400);
      return next(new Error('You are already on a break'));
    }

    const brk = await EmployeeBreak.create({
      employeeId: req.user._id,
      storeId: req.user.assignedStore || null,
      date: new Date(),
      breakStart: new Date(),
      type: req.body.type || 'short',
    });

    res.status(201).json(brk);
  } catch (error) { next(error); }
};

// @desc    End break
// @route   POST /api/hr/breaks/end
const endBreak = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const brk = await EmployeeBreak.findOne({
      employeeId: req.user._id,
      date: { $gte: today },
      breakEnd: null,
    });

    if (!brk) {
      res.status(400);
      return next(new Error('No active break found'));
    }

    brk.breakEnd = new Date();
    brk.duration = Math.round((brk.breakEnd - brk.breakStart) / 60000); // minutes
    await brk.save();

    res.json(brk);
  } catch (error) { next(error); }
};

// @desc    Get break history
// @route   GET /api/hr/breaks
const getBreakHistory = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { employeeId: req.user._id };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    const breaks = await EmployeeBreak.find(filter).sort({ date: -1 }).limit(100);
    res.json(breaks);
  } catch (error) { next(error); }
};

// @desc    Get today's active break (if any)
// @route   GET /api/hr/breaks/active
const getActiveBreak = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const brk = await EmployeeBreak.findOne({
      employeeId: req.user._id,
      date: { $gte: today },
      breakEnd: null,
    });
    res.json(brk || null);
  } catch (error) { next(error); }
};

// =================== TARGETS ===================

const EmployeeTarget = require('../models/EmployeeTarget');

// @desc    Create target for employee
// @route   POST /api/hr/targets
const createTarget = async (req, res, next) => {
  try {
    const { employeeId, targetType, targetValue, month, year, bonusAmount, notes } = req.body;

    // Determine store
    let storeId = req.body.storeId;
    if (!storeId && req.user.role === 'manager') {
      const store = await Store.findOne({ managerId: req.user._id });
      if (store) storeId = store._id;
    }

    const target = await EmployeeTarget.create({
      employeeId,
      storeId,
      targetType,
      targetValue,
      month,
      year,
      bonusAmount: bonusAmount || 0,
      notes: notes || '',
      createdBy: req.user._id,
    });

    const populated = await EmployeeTarget.findById(target._id).populate('employeeId', 'name email role');
    res.status(201).json(populated);
  } catch (error) { next(error); }
};

// @desc    Get targets (filtered by store/employee/month)
// @route   GET /api/hr/targets
const getTargets = async (req, res, next) => {
  try {
    const { employeeId, month, year } = req.query;
    const filter = {};

    // Managers and Admins can see all targets
    // Removed storeId filter for managers so they can see targets across the platform

    if (employeeId) filter.employeeId = employeeId;
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);

    const targets = await EmployeeTarget.find(filter)
      .populate('employeeId', 'name email role')
      .sort({ year: -1, month: -1 });

    res.json(targets);
  } catch (error) { next(error); }
};

// @desc    Get my targets (for employee)
// @route   GET /api/hr/targets/me
const getMyTargets = async (req, res, next) => {
  try {
    const now = new Date();
    const targets = await EmployeeTarget.find({
      employeeId: req.user._id,
      $or: [
        { status: 'active' },
        { month: now.getMonth() + 1, year: now.getFullYear() },
      ],
    }).sort({ year: -1, month: -1 });

    res.json(targets);
  } catch (error) { next(error); }
};

// @desc    Update target progress
// @route   PUT /api/hr/targets/:id/progress
const updateTargetProgress = async (req, res, next) => {
  try {
    const target = await EmployeeTarget.findById(req.params.id);
    if (!target) { res.status(404); return next(new Error('Target not found')); }

    target.achievedValue = req.body.achievedValue || target.achievedValue;
    if (target.achievedValue >= target.targetValue) {
      target.status = 'completed';
    }
    if (req.body.notes) target.notes = req.body.notes;

    await target.save();
    const populated = await EmployeeTarget.findById(target._id).populate('employeeId', 'name email role');
    res.json(populated);
  } catch (error) { next(error); }
};

// @desc    Mark target bonus as paid
// @route   PUT /api/hr/targets/:id/pay-bonus
const payTargetBonus = async (req, res, next) => {
  try {
    const target = await EmployeeTarget.findById(req.params.id);
    if (!target) { res.status(404); return next(new Error('Target not found')); }

    if (target.status !== 'completed') {
      res.status(400);
      return next(new Error('Can only pay bonus for completed targets'));
    }

    target.bonusPaid = true;
    await target.save();

    await sendNotification({
      userId: target.employeeId,
      type: 'payroll',
      title: 'Bonus Paid! 🎉',
      message: `Your bonus of Rs. ${target.bonusAmount} for meeting your ${target.targetType} target has been processed.`,
    });

    res.json(target);
  } catch (error) { next(error); }
};

// @desc    Get employee performance summary
// @route   GET /api/hr/performance/:employeeId
const getEmployeePerformance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Attendance this month
    const attendance = await Attendance.find({
      employeeId,
      date: { $gte: startOfMonth },
    });
    const totalWorkDays = Math.ceil((now - startOfMonth) / (1000 * 60 * 60 * 24));
    const presentDays = attendance.filter(a => a.status === 'present').length;
    const attendanceRate = totalWorkDays > 0 ? Math.round((presentDays / totalWorkDays) * 100) : 0;

    // Average hours
    const totalHours = attendance.reduce((s, a) => s + (a.totalHours || 0), 0);
    const avgHours = presentDays > 0 ? (totalHours / presentDays).toFixed(1) : 0;

    // Breaks this month
    const breaks = await EmployeeBreak.find({
      employeeId,
      date: { $gte: startOfMonth },
    });
    const totalBreakMinutes = breaks.reduce((s, b) => s + (b.duration || 0), 0);
    const avgBreakMinutes = presentDays > 0 ? Math.round(totalBreakMinutes / presentDays) : 0;

    // Targets
    const targets = await EmployeeTarget.find({
      employeeId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
    const completedTargets = targets.filter(t => t.status === 'completed').length;
    const totalBonusEarned = targets.filter(t => t.status === 'completed').reduce((s, t) => s + (t.bonusAmount || 0), 0);

    // Leaves this month
    const leaves = await Leave.find({
      employeeId,
      startDate: { $gte: startOfMonth },
    });

    const user = await User.findById(employeeId).select('name email role');

    res.json({
      employee: user,
      attendance: {
        presentDays,
        totalWorkDays,
        attendanceRate,
        avgHours: parseFloat(avgHours),
      },
      breaks: {
        totalBreakMinutes,
        avgBreakMinutes,
        breakCount: breaks.length,
      },
      targets: {
        total: targets.length,
        completed: completedTargets,
        inProgress: targets.filter(t => t.status === 'active').length,
        totalBonusEarned,
      },
      leaves: {
        total: leaves.length,
        approved: leaves.filter(l => l.status === 'approved').length,
        pending: leaves.filter(l => l.status === 'pending').length,
      },
    });
  } catch (error) { next(error); }
};

// @desc    Admin/Manager mark attendance for an employee
// @route   POST /api/hr/attendance/mark
// @access  Private/Admin/Manager
const adminMarkAttendance = async (req, res, next) => {
  try {
    const { employeeId, date, checkInTime, checkOutTime, status, notes } = req.body;

    if (!employeeId) { res.status(400); return next(new Error('employeeId is required')); }

    const employee = await User.findById(employeeId);
    if (!employee) { res.status(404); return next(new Error('Employee not found')); }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Check if attendance already exists for this date
    let attendance = await Attendance.findOne({
      employeeId,
      date: { $gte: targetDate, $lt: new Date(targetDate.getTime() + 86400000) },
    });

    if (attendance) {
      // Update existing
      if (checkInTime) attendance.checkIn = new Date(checkInTime);
      if (checkOutTime) {
        attendance.checkOut = new Date(checkOutTime);
        const diffMs = attendance.checkOut - attendance.checkIn;
        attendance.hoursWorked = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        if (attendance.hoursWorked >= 8) attendance.overtime = parseFloat((attendance.hoursWorked - 8).toFixed(2));
      }
      if (status) attendance.status = status;
      if (notes) attendance.notes = notes;
      attendance.markedBy = req.user._id;
      await attendance.save();

      const { sendNotification } = require('../utils/notificationService');
      await sendNotification({
        userId: employee._id,
        userEmail: employee.email,
        type: 'attendance',
        title: 'Attendance Updated',
        message: `Your attendance for ${targetDate.toLocaleDateString()} was updated to ${status || attendance.status}.`,
        link: '/employee/attendance',
      });

      return res.json(attendance);
    }

    // Create new
    const ciTime = checkInTime ? new Date(checkInTime) : new Date(targetDate.getTime() + 9 * 3600000);
    let hoursWorked = 0;
    let overtime = 0;
    let coTime = null;

    if (checkOutTime) {
      coTime = new Date(checkOutTime);
      const diffMs = coTime - ciTime;
      hoursWorked = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
      if (hoursWorked >= 8) overtime = parseFloat((hoursWorked - 8).toFixed(2));
    }

    attendance = await Attendance.create({
      employeeId,
      storeId: employee.assignedStore || null,
      date: targetDate,
      checkIn: ciTime,
      checkOut: coTime,
      hoursWorked,
      overtime,
      status: status || 'present',
      notes: notes || `Marked by ${req.user.name}`,
      markedBy: req.user._id,
    });

    const { sendNotification } = require('../utils/notificationService');
    await sendNotification({
      userId: employee._id,
      userEmail: employee.email,
      type: 'attendance',
      title: 'Attendance Marked',
      message: `Your attendance for ${targetDate.toLocaleDateString()} was marked as ${status || 'present'}.`,
      link: '/employee/attendance',
    });

    res.status(201).json(attendance);
  } catch (error) { next(error); }
};

// @desc    Admin/Manager create leave for an employee
// @route   POST /api/hr/leaves/create-for-employee
// @access  Private/Admin/Manager
const adminCreateLeave = async (req, res, next) => {
  try {
    const { employeeId, type, startDate, endDate, reason, status } = req.body;

    if (!employeeId) { res.status(400); return next(new Error('employeeId is required')); }

    const employee = await User.findById(employeeId);
    if (!employee) { res.status(404); return next(new Error('Employee not found')); }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await Leave.create({
      employeeId,
      storeId: employee.assignedStore || null,
      leaveType: type || 'casual',
      startDate: start,
      endDate: end,
      totalDays,
      reason: reason || `Created by ${req.user.name}`,
      status: status || 'approved', // Admin-created leaves are auto-approved
      approvedBy: req.user._id,
    });

    // Notify the employee
    const { sendNotification } = require('../utils/notificationService');
    await sendNotification({
      userId: employee._id,
      userEmail: employee.email,
      type: 'leave_approved',
      title: 'Leave Created',
      message: `${req.user.name} created ${leave.leaveType} leave for you (${totalDays} day${totalDays > 1 ? 's' : ''}).`,
      link: '/employee/leaves',
    });

    res.status(201).json(leave);
  } catch (error) { next(error); }
};

module.exports = {
  checkIn, checkOut, getMyAttendance, getAttendanceReport,
  requestLeave, getMyLeaves, getStoreLeaves, approveLeave, rejectLeave,
  getEmployees, addEmployee, updateEmployee,
  startBreak, endBreak, getBreakHistory, getActiveBreak,
  createTarget, getTargets, getMyTargets, updateTargetProgress, payTargetBonus,
  getEmployeePerformance,
  adminMarkAttendance, adminCreateLeave, deleteTarget
};

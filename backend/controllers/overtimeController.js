const OvertimePay = require('../models/OvertimePay');
const User = require('../models/User');

// @desc    Get all OT records (with optional employee filter)
// @route   GET /api/overtime
// @access  Private/Admin
const getOvertimeRecords = async (req, res, next) => {
  try {
    const { employeeId, status, startDate, endDate } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const records = await OvertimePay.find(filter)
      .populate('employeeId', 'name email role')
      .populate('createdBy', 'name')
      .sort({ date: -1 });

    res.json(records);
  } catch (error) { next(error); }
};

// @desc    Get OT summary per employee
// @route   GET /api/overtime/summary
// @access  Private/Admin
const getOvertimeSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }

    const summary = await OvertimePay.aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      {
        $group: {
          _id: '$employeeId',
          totalHours: { $sum: '$hours' },
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$totalAmount', 0] },
          },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$totalAmount', 0] },
          },
          recordCount: { $sum: 1 },
          lastOT: { $max: '$date' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Populate employee names
    const userIds = summary.map((s) => s._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select('name email role')
      .lean();
    const userMap = {};
    users.forEach((u) => { userMap[String(u._id)] = u; });

    const result = summary.map((s) => ({
      employee: userMap[String(s._id)] || { name: 'Unknown', email: '', role: '' },
      employeeId: s._id,
      totalHours: s.totalHours,
      totalAmount: s.totalAmount,
      paidAmount: s.paidAmount,
      pendingAmount: s.pendingAmount,
      recordCount: s.recordCount,
      lastOT: s.lastOT,
    }));

    res.json(result);
  } catch (error) { next(error); }
};

// @desc    Create OT record
// @route   POST /api/overtime
// @access  Private/Admin
const createOvertimeRecord = async (req, res, next) => {
  try {
    const { employeeId, date, hours, ratePerHour, description } = req.body;

    if (!employeeId || !date || !hours || !ratePerHour) {
      res.status(400);
      return next(new Error('employeeId, date, hours, and ratePerHour are required'));
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      res.status(404);
      return next(new Error('Employee not found'));
    }

    const totalAmount = Number(hours) * Number(ratePerHour);

    const record = await OvertimePay.create({
      employeeId,
      date: new Date(date),
      hours: Number(hours),
      ratePerHour: Number(ratePerHour),
      totalAmount,
      description: description || `OT for ${employee.name}`,
      status: 'pending',
      createdBy: req.user._id,
    });

    const populated = await OvertimePay.findById(record._id)
      .populate('employeeId', 'name email role')
      .populate('createdBy', 'name');

    // Notify employee about new OT
    const { sendNotification } = require('../utils/notificationService');
    await sendNotification({
      userId: employeeId,
      type: 'ot_created',
      title: 'New Overtime Record',
      message: `New overtime record added for ${new Date(date).toLocaleDateString()}, Amount: Rs.${totalAmount.toLocaleString()}`,
      link: '/employee/overtime',
    });

    res.status(201).json(populated);
  } catch (error) { next(error); }
};

// @desc    Mark OT record as paid
// @route   PUT /api/overtime/:id/pay
// @access  Private/Admin
const markOvertimePaid = async (req, res, next) => {
  try {
    const record = await OvertimePay.findById(req.params.id);
    if (!record) {
      res.status(404);
      return next(new Error('OT record not found'));
    }

    record.status = 'paid';
    record.paidAt = new Date();
    await record.save();

    const populated = await OvertimePay.findById(record._id)
      .populate('employeeId', 'name email role')
      .populate('createdBy', 'name');

    const { sendNotification } = require('../utils/notificationService');
    await sendNotification({
      userId: populated.employeeId._id,
      userEmail: populated.employeeId.email,
      type: 'ot_paid',
      title: '🕒 Overtime Paid',
      message: `Your overtime payment of Rs.${record.totalAmount.toLocaleString()} for ${record.hours} hours has been processed.`,
      link: '/employee/overtime',
    });

    res.json(populated);
  } catch (error) { next(error); }
};

// @desc    Reject OT record
// @route   PUT /api/overtime/:id/reject
// @access  Private/Admin
const rejectOvertimeRecord = async (req, res, next) => {
  try {
    const record = await OvertimePay.findById(req.params.id);
    if (!record) {
      res.status(404);
      return next(new Error('OT record not found'));
    }

    record.status = 'rejected';
    await record.save();

    const populated = await OvertimePay.findById(record._id)
      .populate('employeeId', 'name email role')
      .populate('createdBy', 'name');

    const { sendNotification } = require('../utils/notificationService');
    await sendNotification({
      userId: populated.employeeId._id,
      userEmail: populated.employeeId.email,
      type: 'ot_rejected',
      title: '❌ Overtime Rejected',
      message: `Your overtime request for ${new Date(record.date).toLocaleDateString()} has been rejected.`,
      link: '/employee/overtime',
    });

    res.json(populated);
  } catch (error) { next(error); }
};

// @desc    Delete OT record
// @route   DELETE /api/overtime/:id
// @access  Private/Admin
const deleteOvertimeRecord = async (req, res, next) => {
  try {
    const record = await OvertimePay.findById(req.params.id);
    if (!record) {
      res.status(404);
      return next(new Error('OT record not found'));
    }
    await record.deleteOne();
    res.json({ message: 'OT record deleted' });
  } catch (error) { next(error); }
};

// @desc    Get OT report for a specific employee
// @route   GET /api/overtime/employee/:employeeId
// @access  Private/Admin
const getEmployeeOTReport = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;
    const filter = { employeeId };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const records = await OvertimePay.find(filter)
      .populate('createdBy', 'name')
      .sort({ date: -1 });

    const employee = await User.findById(employeeId).select('name email role').lean();

    const totalHours = records.reduce((s, r) => s + r.hours, 0);
    const totalAmount = records.reduce((s, r) => s + r.totalAmount, 0);
    const paidAmount = records.filter((r) => r.status === 'paid').reduce((s, r) => s + r.totalAmount, 0);
    const pendingAmount = totalAmount - paidAmount;

    res.json({
      employee: employee || { name: 'Unknown' },
      records,
      summary: { totalHours, totalAmount, paidAmount, pendingAmount, recordCount: records.length },
    });
  } catch (error) { next(error); }
};

// @desc    Get my OT records (employee self-service)
// @route   GET /api/overtime/my
// @access  Private (any authenticated user)
const getMyOvertime = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { employeeId: req.user._id };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const records = await OvertimePay.find(filter)
      .populate('createdBy', 'name')
      .sort({ date: -1 });

    const totalHours = records.reduce((s, r) => s + r.hours, 0);
    const totalAmount = records.reduce((s, r) => s + r.totalAmount, 0);
    const paidAmount = records.filter((r) => r.status === 'paid').reduce((s, r) => s + r.totalAmount, 0);
    const pendingAmount = totalAmount - paidAmount;

    res.json({
      records,
      summary: { totalHours, totalAmount, paidAmount, pendingAmount, recordCount: records.length },
    });
  } catch (error) { next(error); }
};

module.exports = {
  getOvertimeRecords,
  getOvertimeSummary,
  createOvertimeRecord,
  markOvertimePaid,
  rejectOvertimeRecord,
  deleteOvertimeRecord,
  getEmployeeOTReport,
  getMyOvertime,
};


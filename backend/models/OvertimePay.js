const mongoose = require('mongoose');

const overtimePaySchema = mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    date: {
      type: Date,
      required: true,
    },
    hours: {
      type: Number,
      required: true,
      min: 0.5,
    },
    ratePerHour: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'rejected'],
      default: 'pending',
    },
    paidAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

overtimePaySchema.index({ employeeId: 1, date: -1 });

const OvertimePay = mongoose.model('OvertimePay', overtimePaySchema);

module.exports = OvertimePay;

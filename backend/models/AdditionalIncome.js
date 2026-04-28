const mongoose = require('mongoose');

const additionalIncomeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Income title is required'],
      trim: true,
    },
    source: {
      type: String,
      required: [true, 'Source is required'],
      enum: [
        'Sales',
        'Interest',
        'Rent Income',
        'Commission',
        'Refund',
        'Insurance Claim',
        'Asset Sale',
        'Sponsorship',
        'Other Income',
        'Custom',
        'Other',
      ],
    },
    customSource: {
      type: String,
      trim: true,
      default: '',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

additionalIncomeSchema.index({ date: -1 });

module.exports = mongoose.model('AdditionalIncome', additionalIncomeSchema);

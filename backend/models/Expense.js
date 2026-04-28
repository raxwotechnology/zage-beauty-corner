const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Marketing',
        'Utilities',
        'Water Bill',
        'Electricity',
        'Transport',
        'Rent',
        'Salaries',
        'Employee Payments',
        'Supplies',
        'Maintenance',
        'Insurance',
        'Internet & Phone',
        'Equipment',
        'Packaging',
        'Cleaning',
        'Security',
        'Overtime',
        'Miscellaneous',
        'Custom',
        'Other',
      ],
    },
    customCategory: {
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
    status: {
      type: String,
      enum: ['Paid', 'Pending'],
      default: 'Pending',
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
    receipt: {
      type: String, // URL to receipt image
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ storeId: 1, date: -1 });
expenseSchema.index({ status: 1 });

module.exports = mongoose.model('Expense', expenseSchema);

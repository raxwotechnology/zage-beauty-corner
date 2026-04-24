const mongoose = require('mongoose');

const supplierPaymentSchema = mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Supplier',
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Store',
    },
    type: {
      type: String,
      enum: ['purchase', 'payment'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockReceipt',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'cheque', 'other'],
      default: 'cash',
    },
    chequeNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    chequeDate: { type: Date },
    accountNumber: { type: String, trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

supplierPaymentSchema.index({ supplierId: 1, date: -1 });
supplierPaymentSchema.index({ storeId: 1, supplierId: 1 });

const SupplierPayment = mongoose.model('SupplierPayment', supplierPaymentSchema);

module.exports = SupplierPayment;

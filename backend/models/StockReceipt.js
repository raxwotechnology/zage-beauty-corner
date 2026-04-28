const mongoose = require('mongoose');

const stockReceiptItemSchema = mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
    qty: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const stockReceiptSchema = mongoose.Schema(
  {
    grnNumber: { type: String, unique: true, sparse: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Store' },
    supplierId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Supplier' },
    receivedAt: { type: Date, default: Date.now },
    invoiceNo: { type: String, trim: true },
    items: { type: [stockReceiptItemSchema], required: true, validate: (v) => Array.isArray(v) && v.length > 0 },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

stockReceiptSchema.index({ storeId: 1, receivedAt: -1 });

// Auto-generate GRN number before save
stockReceiptSchema.pre('save', async function () {
  if (!this.grnNumber) {
    const date = new Date();
    const prefix = `GRN-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = await mongoose.model('StockReceipt').countDocuments({
      grnNumber: { $regex: `^${prefix}` }
    });
    this.grnNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
});

const StockReceipt = mongoose.model('StockReceipt', stockReceiptSchema);

module.exports = StockReceipt;

const mongoose = require('mongoose');

const priceRowSchema = mongoose.Schema({
  costPrice: { type: Number, required: true },
  qty: { type: Number, required: true, default: 0 },
  receivedAt: { type: Date, default: Date.now },
}, { _id: true });

const variantSchema = mongoose.Schema({
  name: { type: String, required: true }, // e.g., '500g', '1L'
  price: { type: Number, required: true },
  priceLKR: { type: Number },
  priceUSD: { type: Number },
  mrp: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
});

const productSchema = mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Store',
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Category',
    },
    subCategory: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    // Default price (kept for backward compat, same as priceLKR)
    price: {
      type: Number,
      required: true,
    },
    // Multi-currency prices
    priceLKR: {
      type: Number,
    },
    priceUSD: {
      type: Number,
    },
    mrp: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      required: true,
    },
    variants: [variantSchema],
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    images: [
      {
        type: String,
      },
    ],
    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isOnSale: {
      type: Boolean,
      default: false,
    },
    allowKokoOnline: {
      type: Boolean,
      default: true,
    },
    allowKokoPos: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'out_of_stock'],
      default: 'active',
    },
    barcode: {
      type: String,
      sparse: true,
    },
    sku: {
      type: String,
    },
    // Inventory valuation (for supplier receiving/returns)
    lastCost: {
      type: Number,
      default: 0,
    },
    avgCost: {
      type: Number,
      default: 0,
    },
    defaultSupplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
    },
    // Stock tracking: old vs new
    stockType: {
      type: String,
      enum: ['new', 'old', 'mixed'],
      default: 'new',
    },
    oldStock: {
      type: Number,
      default: 0,
    },
    newStock: {
      type: Number,
      default: 0,
    },
    costPrice: {
      type: Number,
      default: 0,
    },
    priceRows: [priceRowSchema],
  },
  {
    timestamps: true,
  }
);

// Auto-set priceLKR from price if not provided
productSchema.pre('save', function () {
  if (!this.priceLKR && this.price) {
    this.priceLKR = this.price;
  }
});

productSchema.index({ name: 'text', description: 'text' });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;

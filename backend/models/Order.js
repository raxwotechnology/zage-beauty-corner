const mongoose = require('mongoose');

const orderSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Store',
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: 'Product',
        },
        name: String,
        image: String,
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        unitCostAtSale: { type: Number, default: 0 },
      },
    ],
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    deliverySlot: {
      date: Date,
      timeSlot: String,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    // Currency used for this order
    currency: {
      type: String,
      enum: ['LKR', 'USD'],
      default: 'LKR',
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'upi', 'cod', 'wallet', 'payhere', 'cash', 'mobile_money', 'koko'],
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    orderStatus: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'assigned_delivery',
        'packed',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'completed',
      ],
      default: 'pending',
    },
    isPosOrder: {
      type: Boolean,
      default: false,
    },
    invoiceNumber: {
      type: String,
      sparse: true,
    },
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    posSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PosSession',
    },
    // Delivery Guy assignment
    deliveryGuyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    tenderedAmount: {
      type: Number,
    },
    changeGiven: {
      type: Number,
    },
    // Loyalty & Promo
    loyaltyPointsEarned: {
      type: Number,
      default: 0,
    },
    loyaltyPointsRedeemed: {
      type: Number,
      default: 0,
    },
    promoCode: {
      type: String,
    },
    voucherCode: {
      type: String,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    // POS customer info
    customerName: {
      type: String,
    },
    customerPhone: {
      type: String,
    },
    couponCode: {
      type: String,
    },
    paymentOtpRequired: {
      type: Boolean,
      default: false,
    },
    paymentOtpVerifiedAt: {
      type: Date,
    },
    sendReceiptEmail: {
      type: Boolean,
      default: false,
    },
    receiptEmail: {
      type: String,
    },
    receiptEmailSentAt: {
      type: Date,
    },
    receiptEmailError: {
      type: String,
    },
    sendSmsReceipt: {
      type: Boolean,
      default: false,
    },
    printReceipt: {
      type: Boolean,
      default: true,
    },
    // Returns (customer)
    returnStatus: {
      type: String,
      enum: ['none', 'requested', 'approved', 'on_hold', 'rejected', 'resolved'],
      default: 'none',
    },
    customerReturnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerReturn',
    },
    returnedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    // Credit sale tracking
    isCredit: {
      type: Boolean,
      default: false,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    creditBalance: {
      type: Number,
      default: 0,
    },
    creditPaidAt: {
      type: Date,
    },
    creditNote: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;

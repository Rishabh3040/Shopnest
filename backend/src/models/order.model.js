import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        qty: {
          type: Number,
          required: true,
          min: 1,
          validate: Number.isInteger,
        },
        price: { type: Number, required: true, min: 0 },
        name: { type: String, trim: true },
        imageUrl: { type: String, trim: true },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0.01 },
    totalAmountPaise: {
      type: Number,
      min: 1,
      validate: Number.isSafeInteger,
    },
    address: {
      fullName: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    paymentProvider: {
      type: String,
      enum: ["razorpay"],
      default: "razorpay",
    },
    paymentOrderId: { type: String },
    paymentId: { type: String },
    paymentStatus: {
      type: String,
      enum: [
        "creating",
        "created",
        "authorized",
        "captured",
        "failed",
        "refunded",
      ],
    },
    inventoryStatus: {
      type: String,
      enum: ["unallocated", "allocated", "review"],
    },
    checkoutKey: { type: String },
    checkoutHash: { type: String },
    activeCheckoutKey: { type: String },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered"],
      default: "pending",
    },
  },
  { timestamps: true },
);

orderSchema.index(
  { checkoutKey: 1 },
  {
    unique: true,
    partialFilterExpression: { checkoutKey: { $type: "string" } },
  },
);
orderSchema.index(
  { paymentOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentOrderId: { $type: "string" } },
  },
);
orderSchema.index(
  { paymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      paymentId: { $type: "string", $gt: "" },
    },
  },
);
orderSchema.index(
  { activeCheckoutKey: 1 },
  {
    unique: true,
    partialFilterExpression: { activeCheckoutKey: { $type: "string" } },
  },
);
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });

const orderModel = mongoose.model("Oders", orderSchema);

export default orderModel;

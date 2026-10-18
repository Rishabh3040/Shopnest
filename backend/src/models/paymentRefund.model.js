import mongoose from "mongoose";

const paymentRefundSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Oders",
      required: true,
      index: true,
    },
    capturedPaymentId: {
      type: String,
      required: true,
      unique: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    status: {
      type: String,
      enum: ["pending", "refunding", "refunded", "failed"],
      default: "pending",
      index: true,
    },
    refundId: { type: String },
    lockExpiresAt: { type: Date },
    failureReason: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

paymentRefundSchema.index({ order: 1, createdAt: -1 });

const paymentRefundModel = mongoose.model("PaymentRefund", paymentRefundSchema);

export default paymentRefundModel;

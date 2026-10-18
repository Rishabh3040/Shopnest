import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import orderModel from "../src/models/order.model.js";
import paymentRefundModel from "../src/models/paymentRefund.model.js";
import productModel from "../src/models/product.model.js";
import {
  createPaymentOrder,
  markPaymentCaptured,
  refundDuplicateCapturedPayment,
} from "../src/controllers/payment.controller.js";
import { createTransaction } from "../src/controllers/transaction.controller.js";
import {
  allocateInventory,
  updateOrderStatus,
} from "../src/controllers/order.Controller.js";

const invoke = async (handler, req) => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await handler(req, res);
  return res;
};

test("checkout rejects requests without a valid idempotency key", async () => {
  const response = await invoke(createPaymentOrder, {
    get: () => "short",
    body: {},
    user: { _id: new mongoose.Types.ObjectId() },
  });

  assert.equal(response.statusCode, 400);
});

test("captured payment replay and a second capture do not deduct stock twice", async (t) => {
  const paymentOrderId = "order_razorpay";
  const order = {
    _id: new mongoose.Types.ObjectId(),
    paymentStatus: "created",
    items: [{ productId: new mongoose.Types.ObjectId(), qty: 2 }],
    save: async () => order,
  };
  let stockUpdates = 0;
  const session = {
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  };

  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(orderModel, "findById", () => ({
    session: async () => order,
  }));
  t.mock.method(productModel, "findOneAndUpdate", async () => {
    stockUpdates += 1;
    return { stock: 5 };
  });

  const first = await markPaymentCaptured(order, {
    id: "pay_primary",
    order_id: paymentOrderId,
  });
  const replay = await markPaymentCaptured(order, {
    id: "pay_primary",
    order_id: paymentOrderId,
  });
  const additionalCapture = await markPaymentCaptured(order, {
    id: "pay_duplicate",
    order_id: paymentOrderId,
  });

  assert.equal(first.order.paymentStatus, "captured");
  assert.equal(replay.alreadyCaptured, true);
  assert.equal(additionalCapture.duplicatePayment, true);
  assert.equal(stockUpdates, 1);
});

test("duplicate captured payment is refunded and repeated processing is idempotent", async (t) => {
  const refundId = new mongoose.Types.ObjectId();
  const order = {
    _id: new mongoose.Types.ObjectId(),
    paymentStatus: "captured",
    paymentId: "pay_primary",
    paymentOrderId: "order_razorpay",
    totalAmountPaise: 2500,
  };
  const payment = {
    id: "pay_duplicate",
    order_id: order.paymentOrderId,
    amount: order.totalAmountPaise,
    currency: "INR",
    status: "captured",
  };
  let record = null;
  let refundCalls = 0;
  const gateway = {
    payments: {
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async (paymentId, options) => {
        refundCalls += 1;
        assert.equal(paymentId, payment.id);
        assert.equal(options.amount, payment.amount);
        assert.equal(options.notes.paymentRefundId, refundId.toString());
        return { id: "rfnd_test", status: "processed" };
      },
    },
  };

  t.mock.method(paymentRefundModel, "findOneAndUpdate", async (filter, update) => {
    if (filter.capturedPaymentId) {
      record ||= {
        _id: refundId,
        order: order._id,
        capturedPaymentId: payment.id,
        amountPaise: payment.amount,
        status: "pending",
      };
      return record;
    }
    if (filter.$or) {
      if (!["pending", "failed"].includes(record.status)) return null;
    }
    Object.assign(record, update.$set);
    return record;
  });
  t.mock.method(paymentRefundModel, "findById", async () => record);

  const result = await refundDuplicateCapturedPayment(order, payment, gateway);
  assert.equal(result.status, "refunded");
  assert.equal(result.refundId, "rfnd_test");

  const repeated = await refundDuplicateCapturedPayment(order, payment, gateway);
  assert.equal(repeated.status, "refunded");
  assert.equal(refundCalls, 1);
});

test("failed duplicate refund can be retried without creating duplicate refunds", async (t) => {
  const order = {
    _id: new mongoose.Types.ObjectId(),
    paymentStatus: "captured",
    paymentId: "pay_primary",
    paymentOrderId: "order_razorpay",
    totalAmountPaise: 2500,
  };
  const payment = {
    id: "pay_duplicate_retry",
    order_id: order.paymentOrderId,
    amount: order.totalAmountPaise,
    currency: "INR",
    status: "captured",
  };
  let record = null;
  let refundCalls = 0;
  const gateway = {
    payments: {
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async () => {
        refundCalls += 1;
        if (refundCalls === 1) throw new Error("Temporary provider failure");
        return { id: "rfnd_retry", status: "processed" };
      },
    },
  };

  t.mock.method(paymentRefundModel, "findOneAndUpdate", async (filter, update) => {
    if (filter.capturedPaymentId) {
      record ||= {
        _id: new mongoose.Types.ObjectId(),
        order: order._id,
        capturedPaymentId: payment.id,
        amountPaise: payment.amount,
        status: "pending",
      };
      return record;
    }
    if (filter.$or && !["pending", "failed"].includes(record.status)) return null;
    Object.assign(record, update.$set);
    return record;
  });
  t.mock.method(paymentRefundModel, "updateOne", async (filter, update) => {
    Object.assign(record, update.$set);
  });
  t.mock.method(paymentRefundModel, "findById", async () => record);

  const failed = await refundDuplicateCapturedPayment(order, payment, gateway);
  assert.equal(failed.status, "failed");

  const retried = await refundDuplicateCapturedPayment(order, payment, gateway);
  assert.equal(retried.status, "refunded");
  assert.equal(retried.refundId, "rfnd_retry");
  assert.equal(refundCalls, 2);
});

test("ledger transfer rejects invalid account IDs before database writes", async () => {
  const response = await invoke(createTransaction, {
    body: {
      fromAccount: "invalid",
      toAccount: "invalid",
      amount: -1,
      idempotencyKey: "transfer-001",
    },
    user: { _id: new mongoose.Types.ObjectId() },
  });

  assert.equal(response.statusCode, 400);
});

test("fulfillment only allows paid orders to advance one step", async (t) => {
  const orderId = new mongoose.Types.ObjectId().toString();
  let order = {
    status: "pending",
    paymentStatus: "created",
    inventoryStatus: "allocated",
    save: async () => order,
  };
  t.mock.method(orderModel, "findById", async () => order);

  let response = await invoke(updateOrderStatus, {
    params: { id: orderId },
    body: { status: "processing" },
  });
  assert.equal(response.statusCode, 409);

  order = {
    status: "pending",
    paymentStatus: "captured",
    inventoryStatus: "allocated",
    save: async () => order,
  };
  response = await invoke(updateOrderStatus, {
    params: { id: orderId },
    body: { status: "delivered" },
  });
  assert.equal(response.statusCode, 409);

  order.status = "processing";
  response = await invoke(updateOrderStatus, {
    params: { id: orderId },
    body: { status: "shipped" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(order.status, "shipped");
});

test("inventory allocation is idempotent and refuses insufficient stock", async (t) => {
  const orderId = new mongoose.Types.ObjectId().toString();
  let order = {
    _id: orderId,
    paymentStatus: "captured",
    inventoryStatus: "review",
    items: [{ productId: new mongoose.Types.ObjectId(), qty: 2 }],
    save: async () => order,
  };
  let stockAvailable = true;
  let stockUpdates = 0;
  const session = {
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  };

  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(orderModel, "findById", () => ({
    session: async () => order,
  }));
  t.mock.method(productModel, "findOneAndUpdate", async () => {
    stockUpdates += 1;
    return stockAvailable ? { stock: 0 } : null;
  });

  let response = await invoke(allocateInventory, { params: { id: orderId } });
  assert.equal(response.statusCode, 200);
  assert.equal(order.inventoryStatus, "allocated");

  response = await invoke(allocateInventory, { params: { id: orderId } });
  assert.equal(response.statusCode, 200);
  assert.equal(stockUpdates, 1);

  order.inventoryStatus = "review";
  stockAvailable = false;
  response = await invoke(allocateInventory, { params: { id: orderId } });
  assert.equal(response.statusCode, 409);
  assert.equal(order.inventoryStatus, "review");
});

import crypto from "node:crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import config from "../config/config.js";
import orderModel from "../models/order.model.js";
import paymentRefundModel from "../models/paymentRefund.model.js";
import productModel from "../models/product.model.js";
import { sendEmail } from "../services/email.service.js";

class CheckoutError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

class InventoryUnavailableError extends Error {}

const runPaymentPipeline = async (context, stages) => {
  for (const stage of stages) {
    if (context.response) break;
    context = await stage(context);
  }
  return context;
};

const createGateway = () => {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    throw new CheckoutError("Online payments are not configured.", 503);
  }
  if (config.NODE_ENV === "production" && !config.RAZORPAY_WEBHOOK_SECRET) {
    throw new CheckoutError(
      "Payment webhooks must be configured before checkout is enabled.",
      503,
    );
  }

  return new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET,
  });
};

const normalizeAddress = (address) => {
  const normalized = {
    fullName: String(address?.fullName || "").trim(),
    street: String(address?.street || "").trim(),
    city: String(address?.city || "").trim(),
    postalCode: String(address?.postalCode || "").trim(),
    country: String(address?.country || "").trim(),
  };

  if (Object.values(normalized).some((value) => !value || value.length > 200)) {
    throw new CheckoutError("A complete, valid shipping address is required.");
  }

  return normalized;
};

const normalizeCheckout = async (items, address) => {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    throw new CheckoutError("Your cart must contain between 1 and 50 items.");
  }

  const quantities = new Map();
  for (const item of items) {
    const productId = String(item?.productId?._id || item?.productId || "");
    const qty = Number(item?.qty);
    if (
      !mongoose.isValidObjectId(productId) ||
      !Number.isSafeInteger(qty) ||
      qty < 1
    ) {
      throw new CheckoutError("Cart contains an invalid product or quantity.");
    }

    const combinedQty = (quantities.get(productId) || 0) + qty;
    if (!Number.isSafeInteger(combinedQty)) {
      throw new CheckoutError("Cart quantity is too large.");
    }
    quantities.set(productId, combinedQty);
  }

  const products = await productModel.find({
    _id: { $in: [...quantities.keys()] },
  });
  if (products.length !== quantities.size) {
    throw new CheckoutError("A product in your cart is no longer available.");
  }

  const normalizedItems = products
    .map((product) => {
      const qty = quantities.get(String(product._id));
      if (product.stock < qty) {
        throw new CheckoutError(`${product.name} does not have enough stock.`);
      }

      const pricePaise = Math.round(product.price * 100);
      if (!Number.isSafeInteger(pricePaise) || pricePaise < 1) {
        throw new CheckoutError(`${product.name} has an invalid price.`);
      }

      return {
        productId: product._id,
        qty,
        price: pricePaise / 100,
        name: product.name,
        imageUrl: product.imageUrl || "",
      };
    })
    .sort((a, b) => String(a.productId).localeCompare(String(b.productId)));

  const totalAmountPaise = normalizedItems.reduce(
    (total, item) => total + Math.round(item.price * 100) * item.qty,
    0,
  );
  if (!Number.isSafeInteger(totalAmountPaise) || totalAmountPaise < 1) {
    throw new CheckoutError("Order total must be greater than zero.");
  }

  const normalizedAddress = normalizeAddress(address);
  const checkoutHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        items: normalizedItems.map((item) => ({
          productId: String(item.productId),
          qty: item.qty,
          price: item.price,
        })),
        address: normalizedAddress,
      }),
    )
    .digest("hex");

  return {
    items: normalizedItems,
    address: normalizedAddress,
    totalAmountPaise,
    checkoutHash,
  };
};

const paymentOrderResponse = (order) => ({
  id: order.paymentOrderId,
  amount: order.totalAmountPaise,
  currency: "INR",
  keyId: config.RAZORPAY_KEY_ID,
  orderId: order._id,
});

const getExistingCheckout = async (checkoutKey, userId, checkoutHash) => {
  const order = await orderModel.findOne({ checkoutKey });
  if (!order) return null;

  if (
    String(order.user) !== String(userId) ||
    order.checkoutHash !== checkoutHash
  ) {
    throw new CheckoutError(
      "This idempotency key was already used for a different checkout.",
      409,
    );
  }

  if (
    order.paymentOrderId &&
    ["created", "authorized"].includes(order.paymentStatus)
  ) {
    return paymentOrderResponse(order);
  }

  throw new CheckoutError(
    "This checkout attempt cannot be reused. Start a new payment attempt.",
    409,
  );
};

const getActiveCheckout = async (activeCheckoutKey) => {
  const order = await orderModel.findOne({
    activeCheckoutKey,
    paymentStatus: { $in: ["creating", "created", "authorized"] },
  });
  if (!order) return null;
  if (!order.paymentOrderId || order.paymentStatus === "creating") {
    throw new CheckoutError(
      "Your checkout is still being initialized. Please retry shortly.",
      409,
    );
  }
  return paymentOrderResponse(order);
};

export const createPaymentOrder = async (req, res) => {
  const context = { req, order: null, response: null };
  try {
    const result = await runPaymentPipeline(context, [
      async (state) => {
        state.checkoutKey = String(
          state.req.get("Idempotency-Key") || "",
        ).trim();
        if (!/^[A-Za-z0-9._:-]{8,128}$/.test(state.checkoutKey)) {
          throw new CheckoutError(
            "A valid Idempotency-Key header is required.",
          );
        }
        state.checkout = await normalizeCheckout(
          state.req.body?.items,
          state.req.body?.address,
        );
        state.activeCheckoutKey = crypto
          .createHash("sha256")
          .update(`${state.req.user._id}:${state.checkout.checkoutHash}`)
          .digest("hex");
        return state;
      },
      async (state) => {
        const existing = await getExistingCheckout(
          state.checkoutKey,
          state.req.user._id,
          state.checkout.checkoutHash,
        );
        const active =
          existing || (await getActiveCheckout(state.activeCheckoutKey));
        if (active) state.response = { status: 200, body: active };
        return state;
      },
      async (state) => {
        state.gateway = createGateway();
        try {
          state.order = await orderModel.create({
            user: state.req.user._id,
            items: state.checkout.items,
            totalAmount: state.checkout.totalAmountPaise / 100,
            totalAmountPaise: state.checkout.totalAmountPaise,
            address: state.checkout.address,
            paymentStatus: "creating",
            inventoryStatus: "unallocated",
            status: "pending",
            checkoutKey: state.checkoutKey,
            checkoutHash: state.checkout.checkoutHash,
            activeCheckoutKey: state.activeCheckoutKey,
          });
        } catch (error) {
          if (error.code !== 11000) throw error;
          const existing = await getExistingCheckout(
            state.checkoutKey,
            state.req.user._id,
            state.checkout.checkoutHash,
          );
          const active =
            existing || (await getActiveCheckout(state.activeCheckoutKey));
          if (!active) throw error;
          state.response = { status: 200, body: active };
        }
        return state;
      },
      async (state) => {
        const providerOrder = await state.gateway.orders.create({
          amount: state.checkout.totalAmountPaise,
          currency: "INR",
          receipt: `shopnest_${state.order._id}`,
          notes: {
            orderId: String(state.order._id),
            userId: String(state.req.user._id),
          },
        });
        state.order.paymentOrderId = providerOrder.id;
        state.order.paymentStatus = "created";
        await state.order.save();
        state.response = {
          status: 201,
          body: paymentOrderResponse(state.order),
        };
        return state;
      },
    ]);
    return res.status(result.response.status).json(result.response.body);
  } catch (error) {
    if (context.order?._id && context.order.paymentStatus === "creating") {
      context.order.paymentStatus = "failed";
      context.order.activeCheckoutKey = undefined;
      await context.order.save().catch((saveError) => {
        console.error(
          "Failed to mark payment initialization error:",
          saveError,
        );
      });
    }

    if (error.status && error.status < 500) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error("Payment order creation failed:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Payment order could not be created.",
    });
  }
};

const verifySignature = (orderId, paymentId, signature) => {
  const expectedSignature = crypto
    .createHmac("sha256", config.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const received = Buffer.from(String(signature));
  const expected = Buffer.from(expectedSignature);

  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
};

export const markPaymentCaptured = async (order, payment) => {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const currentOrder = await orderModel
        .findById(order._id)
        .session(session);

      if (!currentOrder) {
        throw new CheckoutError("Order not found.", 404);
      }

      if (currentOrder.paymentStatus === "captured") {
        if (currentOrder.paymentId !== payment.id) {
          result = { order: currentOrder, duplicatePayment: true };
          return;
        }
        result = { order: currentOrder, alreadyCaptured: true };
        return;
      }

      for (const item of currentOrder.items) {
        const product = await productModel.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.qty } },
          { $inc: { stock: -item.qty } },
          { new: true, session },
        );
        if (!product) throw new InventoryUnavailableError();
      }

      currentOrder.paymentId = payment.id;
      currentOrder.paymentStatus = "captured";
      currentOrder.inventoryStatus = "allocated";
      currentOrder.activeCheckoutKey = undefined;
      result = { order: await currentOrder.save({ session }) };
    });
  } catch (error) {
    if (!(error instanceof InventoryUnavailableError)) throw error;

    const reviewOrder = await orderModel.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $ne: "captured" } },
      {
        $set: {
          paymentId: payment.id,
          paymentStatus: "captured",
          inventoryStatus: "review",
        },
        $unset: { activeCheckoutKey: 1 },
      },
      { new: true },
    );

    if (!reviewOrder) {
      const existingOrder = await orderModel.findById(order._id);
      if (existingOrder?.paymentStatus !== "captured") throw error;
      result = { order: existingOrder, alreadyCaptured: true };
    } else {
      result = { order: reviewOrder, inventoryReview: true };
    }
  } finally {
    await session.endSession();
  }

  return result;
};

export const refundDuplicateCapturedPayment = async (
  order,
  payment,
  gateway = createGateway(),
) => {
  if (
    order.paymentStatus !== "captured" ||
    !order.paymentId ||
    payment.id === order.paymentId ||
    payment.order_id !== order.paymentOrderId ||
    payment.amount !== order.totalAmountPaise ||
    payment.currency !== "INR" ||
    payment.status !== "captured"
  ) {
    throw new CheckoutError(
      "Payment is not an eligible duplicate capture for this order.",
      409,
    );
  }

  let refundRecord;
  try {
    refundRecord = await paymentRefundModel.findOneAndUpdate(
      { capturedPaymentId: payment.id },
      {
        $setOnInsert: {
          order: order._id,
          capturedPaymentId: payment.id,
          amountPaise: payment.amount,
          status: "pending",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    refundRecord = await paymentRefundModel.findOne({
      capturedPaymentId: payment.id,
    });
  }

  if (!refundRecord || String(refundRecord.order) !== String(order._id)) {
    throw new CheckoutError(
      "Duplicate captured payment needs manual reconciliation.",
      409,
    );
  }
  if (refundRecord.amountPaise !== payment.amount) {
    throw new CheckoutError(
      "Duplicate payment refund amount requires manual reconciliation.",
      409,
    );
  }
  if (refundRecord.status === "refunded") return refundRecord;

  const now = new Date();
  const claimedRefund = await paymentRefundModel.findOneAndUpdate(
    {
      _id: refundRecord._id,
      $or: [
        { status: { $in: ["pending", "failed"] } },
        { status: "refunding", lockExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "refunding",
        lockExpiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        failureReason: "",
      },
    },
    { new: true },
  );

  if (!claimedRefund) {
    return paymentRefundModel.findById(refundRecord._id);
  }

  const findExistingProviderRefund = async () => {
    const response = await gateway.payments.fetchMultipleRefund(payment.id, {
      count: 100,
    });
    const matchingRefunds = (response.items || []).filter(
      (refund) => refund.notes?.paymentRefundId === String(claimedRefund._id),
    );
    return (
      matchingRefunds.find((refund) => refund.status === "processed") ||
      matchingRefunds.find((refund) => refund.status === "pending") ||
      matchingRefunds.sort(
        (a, b) => (b.created_at || 0) - (a.created_at || 0),
      )[0]
    );
  };

  const saveProviderRefundState = async (providerRefund) => {
    const status =
      providerRefund.status === "processed"
        ? "refunded"
        : providerRefund.status === "failed"
          ? "failed"
          : "refunding";
    return paymentRefundModel.findOneAndUpdate(
      { _id: claimedRefund._id },
      {
        $set: {
          status,
          refundId: providerRefund.id,
          lockExpiresAt:
            status === "refunding"
              ? new Date(Date.now() + 5 * 60 * 1000)
              : null,
          failureReason:
            status === "failed"
              ? "Razorpay reported that the refund failed."
              : "",
        },
      },
      { new: true },
    );
  };

  try {
    let providerRefund = await findExistingProviderRefund();
    if (!providerRefund || providerRefund.status === "failed") {
      providerRefund = await gateway.payments.refund(payment.id, {
        amount: payment.amount,
        notes: {
          paymentRefundId: String(claimedRefund._id),
          orderId: String(order._id),
          reason: "Duplicate ShopNest checkout payment",
        },
      });
    }

    return await saveProviderRefundState(providerRefund);
  } catch (error) {
    try {
      const providerRefund = await findExistingProviderRefund();
      if (providerRefund && providerRefund.status !== "failed") {
        return await saveProviderRefundState(providerRefund);
      }
    } catch (reconciliationError) {
      console.error(
        "Duplicate refund reconciliation failed:",
        reconciliationError,
      );
    }

    const failureReason = String(error.message || "Provider refund failed.")
      .replace(/[\r\n]/g, " ")
      .slice(0, 500);
    await paymentRefundModel.updateOne(
      { _id: claimedRefund._id, status: "refunding" },
      {
        $set: {
          status: "failed",
          lockExpiresAt: null,
          failureReason,
        },
      },
    );
    console.error("Duplicate payment refund failed:", error);
    return paymentRefundModel.findById(claimedRefund._id);
  }
};

const verifyProviderPayment = async (gateway, order, paymentId) => {
  const [gatewayOrder, payment] = await Promise.all([
    gateway.orders.fetch(order.paymentOrderId),
    gateway.payments.fetch(paymentId),
  ]);

  if (
    gatewayOrder.id !== order.paymentOrderId ||
    gatewayOrder.amount !== order.totalAmountPaise ||
    gatewayOrder.currency !== "INR" ||
    payment.order_id !== order.paymentOrderId ||
    payment.amount !== order.totalAmountPaise ||
    payment.currency !== "INR"
  ) {
    throw new CheckoutError("Payment does not match this order.", 400);
  }

  if (payment.status === "authorized") {
    await gateway.payments.capture(payment.id, order.totalAmountPaise, "INR");
    return gateway.payments.fetch(payment.id);
  }

  return payment;
};

const sendOrderConfirmation = async (order, user) => {
  try {
    await sendEmail(
      user.email,
      "ShopNest payment received",
      `Your payment for order ${order._id} was received. Total: ₹${order.totalAmount}.`,
    );
  } catch (error) {
    console.error("Order confirmation email failed:", error);
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const result = await runPaymentPipeline(
      { req, order: null, payment: null, settlement: null },
      [
        async (state) => {
          state.paymentOrderId = state.req.body?.razorpay_order_id;
          state.paymentId = state.req.body?.razorpay_payment_id;
          state.signature = state.req.body?.razorpay_signature;
          if (!state.paymentOrderId || !state.paymentId || !state.signature) {
            throw new CheckoutError(
              "Payment verification details are required.",
            );
          }
          return state;
        },
        async (state) => {
          state.order = await orderModel.findOne({
            paymentOrderId: state.paymentOrderId,
            user: state.req.user._id,
          });
          if (!state.order) {
            throw new CheckoutError("Payment order not found.", 404);
          }
          return state;
        },
        async (state) => {
          if (
            !verifySignature(
              state.paymentOrderId,
              state.paymentId,
              state.signature,
            )
          ) {
            throw new CheckoutError("Payment signature is invalid.", 400);
          }
          state.gateway = createGateway();
          return state;
        },
        async (state) => {
          state.payment = await verifyProviderPayment(
            state.gateway,
            state.order,
            state.paymentId,
          );
          if (state.payment.status !== "captured") {
            if (state.payment.status === "failed") {
              await orderModel.updateOne(
                {
                  _id: state.order._id,
                  paymentStatus: { $ne: "captured" },
                },
                {
                  $set: { paymentStatus: "failed" },
                  $unset: { activeCheckoutKey: 1 },
                },
              );
            }
            throw new CheckoutError("Payment has not been captured.", 409);
          }
          return state;
        },
        async (state) => {
          state.settlement = await markPaymentCaptured(
            state.order,
            state.payment,
          );
          if (state.settlement.duplicatePayment) {
            state.refund = await refundDuplicateCapturedPayment(
              state.settlement.order,
              state.payment,
              state.gateway,
            );
          } else if (!state.settlement.alreadyCaptured) {
            await sendOrderConfirmation(state.settlement.order, state.req.user);
          }
          return state;
        },
      ],
    );

    if (result.settlement.duplicatePayment) {
      return res.status(200).json({
        message:
          result.refund?.status === "refunded"
            ? "Duplicate payment detected and refunded."
            : "Order is paid. Duplicate payment refund needs review.",
        order: result.settlement.order,
        duplicatePaymentRefund: {
          status: result.refund?.status || "pending",
          refundId: result.refund?.refundId,
        },
      });
    }

    return res.status(200).json({
      message: result.settlement.inventoryReview
        ? "Payment received. The order requires inventory review."
        : "Payment verified successfully.",
      order: result.settlement.order,
    });
  } catch (error) {
    if (error.status && error.status < 500) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error("Payment verification failed:", error);
    return res.status(500).json({
      message: "Payment verification could not be completed.",
    });
  }
};

const verifyWebhookSignature = (rawBody, signature, secret) => {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const received = Buffer.from(String(signature || ""));
  const expected = Buffer.from(expectedSignature);

  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
};

export const handlePaymentWebhook = async (req, res) => {
  try {
    const result = await runPaymentPipeline(
      { req, response: null, event: null, payment: null, order: null },
      [
        async (state) => {
          if (!config.RAZORPAY_WEBHOOK_SECRET) {
            state.response = {
              status: 503,
              body: { message: "Payment webhooks are not configured." },
            };
            return state;
          }
          if (
            !Buffer.isBuffer(state.req.rawBody) ||
            !verifyWebhookSignature(
              state.req.rawBody,
              state.req.get("x-razorpay-signature"),
              config.RAZORPAY_WEBHOOK_SECRET,
            )
          ) {
            state.response = {
              status: 400,
              body: { message: "Webhook signature is invalid." },
            };
            return state;
          }
          state.event = JSON.parse(state.req.rawBody.toString("utf8"));
          return state;
        },
        async (state) => {
          state.providerRefund = state.event.payload?.refund?.entity;
          if (
            !["refund.processed", "refund.failed"].includes(
              state.event.event,
            ) ||
            !state.providerRefund?.id
          ) {
            return state;
          }

          const refundRecord = state.providerRefund.notes?.paymentRefundId
            ? await paymentRefundModel.findById(
                state.providerRefund.notes.paymentRefundId,
              )
            : await paymentRefundModel.findOne({
                capturedPaymentId: state.providerRefund.payment_id,
              });
          if (refundRecord) {
            await paymentRefundModel.updateOne(
              { _id: refundRecord._id },
              {
                $set:
                  state.event.event === "refund.processed"
                    ? {
                        status: "refunded",
                        refundId: state.providerRefund.id,
                        lockExpiresAt: null,
                        failureReason: "",
                      }
                    : {
                        status: "failed",
                        refundId: state.providerRefund.id,
                        lockExpiresAt: null,
                        failureReason:
                          "Razorpay reported that the refund failed.",
                      },
              },
            );
          }
          state.response = { status: 200, body: { received: true } };
          return state;
        },
        async (state) => {
          if (state.response) return state;
          state.payment = state.event.payload?.payment?.entity;
          if (!state.payment?.order_id || !state.payment?.id) {
            state.response = { status: 200, body: { received: true } };
          }
          return state;
        },
        async (state) => {
          if (state.response) return state;
          state.order = await orderModel.findOne({
            paymentOrderId: state.payment.order_id,
          });
          if (!state.order) {
            console.error(
              "Received payment webhook for unknown order:",
              state.payment.order_id,
            );
            state.response = { status: 200, body: { received: true } };
          }
          return state;
        },
        async (state) => {
          if (state.response) return state;
          if (
            state.payment.amount !== state.order.totalAmountPaise ||
            state.payment.currency !== "INR"
          ) {
            console.error(
              "Payment webhook amount mismatch for order:",
              state.order._id,
            );
            state.response = {
              status: 400,
              body: { message: "Webhook payment does not match order." },
            };
          }
          return state;
        },
        async (state) => {
          if (state.response) return state;
          if (state.event.event === "payment.captured") {
            if (state.payment.status !== "captured") {
              state.response = {
                status: 400,
                body: { message: "Payment is not captured." },
              };
              return state;
            }
            const settlement = await markPaymentCaptured(
              state.order,
              state.payment,
            );
            if (settlement.duplicatePayment) {
              const refund = await refundDuplicateCapturedPayment(
                settlement.order,
                state.payment,
              );
              if (refund?.status !== "refunded") {
                console.error(
                  "Duplicate captured payment requires refund review:",
                  refund?.capturedPaymentId,
                );
              }
            }
          } else if (state.event.event === "payment.failed") {
            await orderModel.updateOne(
              {
                _id: state.order._id,
                paymentStatus: { $ne: "captured" },
              },
              {
                $set: { paymentStatus: "failed" },
                $unset: { activeCheckoutKey: 1 },
              },
            );
          }
          state.response = { status: 200, body: { received: true } };
          return state;
        },
      ],
    );
    return res.status(result.response.status).json(result.response.body);
  } catch (error) {
    console.error("Payment webhook processing failed:", error);
    return res.status(500).json({ message: "Webhook processing failed." });
  }
};

export const retryPaymentRefund = async (req, res) => {
  try {
    const result = await runPaymentPipeline(
      { req, response: null, order: null, refundRecord: null },
      [
        async (state) => {
          if (
            !mongoose.isValidObjectId(state.req.params.id) ||
            !mongoose.isValidObjectId(state.req.params.refundId)
          ) {
            throw new CheckoutError("Invalid order or refund ID.");
          }
          return state;
        },
        async (state) => {
          [state.order, state.refundRecord] = await Promise.all([
            orderModel.findById(state.req.params.id),
            paymentRefundModel.findById(state.req.params.refundId),
          ]);
          if (
            !state.order ||
            !state.refundRecord ||
            String(state.refundRecord.order) !== String(state.order._id)
          ) {
            throw new CheckoutError("Refund record not found.", 404);
          }
          if (state.refundRecord.status === "refunded") {
            state.response = {
              status: 200,
              body: {
                message: "Duplicate payment is already refunded.",
                refund: state.refundRecord,
              },
            };
          }
          return state;
        },
        async (state) => {
          state.gateway = createGateway();
          state.payment = await state.gateway.payments.fetch(
            state.refundRecord.capturedPaymentId,
          );
          if (
            state.payment.status !== "captured" ||
            state.payment.order_id !== state.order.paymentOrderId ||
            state.payment.amount !== state.refundRecord.amountPaise
          ) {
            throw new CheckoutError(
              "Provider payment is not captured for the recorded amount.",
              409,
            );
          }
          return state;
        },
        async (state) => {
          state.refund = await refundDuplicateCapturedPayment(
            state.order,
            state.payment,
            state.gateway,
          );
          if (state.refund?.status === "refunded") {
            state.response = {
              status: 200,
              body: {
                message: "Duplicate payment refunded.",
                refund: state.refund,
              },
            };
          } else if (state.refund?.status === "refunding") {
            state.response = {
              status: 200,
              body: {
                message: "Refund is still pending with Razorpay.",
                refund: state.refund,
              },
            };
          } else {
            state.response = {
              status: 502,
              body: {
                message:
                  "Refund is still pending or failed. Retry after checking Razorpay.",
                refund: state.refund,
              },
            };
          }
          return state;
        },
      ],
    );
    return res.status(result.response.status).json(result.response.body);
  } catch (error) {
    console.error("Payment refund retry failed:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Refund could not be retried.",
    });
  }
};

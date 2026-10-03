import Razorpay from "razorpay";
import crypto from "node:crypto";
import mongoose from "mongoose";
import config from "../config/config.js";
import orderModel from "../models/order.model.js";
import productModel from "../models/product.model.js";
import { sendEmail } from "../services/email.service.js";

const createGateway = () => {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    const error = new Error("Online payments are not configured.");
    error.status = 503;
    throw error;
  }

  return new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET,
  });
};

const normalizeCheckout = async (items, address) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Your cart is empty.");
  }

  const normalizedAddress = {
    fullName: String(address?.fullName || "").trim(),
    street: String(address?.street || "").trim(),
    city: String(address?.city || "").trim(),
    postalCode: String(address?.postalCode || "").trim(),
    country: String(address?.country || "").trim(),
  };
  if (Object.values(normalizedAddress).some((value) => !value)) {
    throw new Error("Complete shipping address is required.");
  }

  const quantities = new Map();
  for (const item of items) {
    const productId = String(item.productId?._id || item.productId || "");
    const qty = Number(item.qty);
    if (
      !mongoose.isValidObjectId(productId) ||
      !Number.isInteger(qty) ||
      qty < 1
    ) {
      throw new Error("Cart contains an invalid product or quantity.");
    }
    quantities.set(productId, (quantities.get(productId) || 0) + qty);
  }

  const products = await productModel.find({
    _id: { $in: [...quantities.keys()] },
  });
  if (products.length !== quantities.size) {
    throw new Error("A product in your cart is no longer available.");
  }

  const normalizedItems = products
    .map((product) => {
      const qty = quantities.get(String(product._id));
      if (product.stock < qty) {
        throw new Error(`${product.name} does not have enough stock.`);
      }
      return {
        productId: product._id,
        qty,
        price: product.price,
      };
    })
    .sort((a, b) => String(a.productId).localeCompare(String(b.productId)));

  const totalPaise = normalizedItems.reduce(
    (total, item) => total + Math.round(item.price * 100) * item.qty,
    0,
  );
  if (totalPaise < 1) throw new Error("Order total must be greater than zero.");

  const cartHash = crypto
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
    totalPaise,
    cartHash,
  };
};

export const createPaymentOrder = async (req, res) => {
  try {
    const checkout = await normalizeCheckout(req.body.items, req.body.address);
    const gateway = createGateway();
    const paymentOrder = await gateway.orders.create({
      amount: checkout.totalPaise,
      currency: "INR",
      receipt: `shopnest_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      notes: {
        userId: String(req.user._id),
        cartHash: checkout.cartHash,
      },
    });

    return res.status(201).json({
      id: paymentOrder.id,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      keyId: config.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    return res
      .status(error.status || 400)
      .json({
        message: error.message || "Payment order could not be created.",
      });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      address,
    } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ message: "Payment verification details are required." });
    }

    const gateway = createGateway();
    const expectedSignature = crypto
      .createHmac("sha256", config.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    const received = Buffer.from(String(razorpay_signature));
    const expected = Buffer.from(expectedSignature);
    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(received, expected)
    ) {
      return res.status(400).json({ message: "Payment signature is invalid." });
    }

    const [paymentOrder, payment] = await Promise.all([
      gateway.orders.fetch(razorpay_order_id),
      gateway.payments.fetch(razorpay_payment_id),
    ]);
    const checkout = await normalizeCheckout(items, address);
    if (
      String(paymentOrder.notes?.userId) !== String(req.user._id) ||
      paymentOrder.notes?.cartHash !== checkout.cartHash ||
      paymentOrder.amount !== checkout.totalPaise ||
      payment.order_id !== paymentOrder.id ||
      payment.amount !== checkout.totalPaise ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    ) {
      return res
        .status(400)
        .json({ message: "Payment could not be verified for this order." });
    }

    const existingOrder = await orderModel.findOne({
      paymentId: razorpay_payment_id,
    });
    if (existingOrder) return res.status(200).json({ order: existingOrder });

    const order = await orderModel.create({
      user: req.user._id,
      items: checkout.items,
      totalAmount: checkout.totalPaise / 100,
      address: checkout.address,
      paymentId: razorpay_payment_id,
    });

    await sendEmail(
      req.user.email,
      "Order Created",
      `Your ShopNest order ${order._id} was created successfully. Total: ₹${order.totalAmount}.`,
    );

    return res.status(201).json({ order });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res
      .status(error.status || 500)
      .json({ message: error.message || "Payment verification failed." });
  }
};

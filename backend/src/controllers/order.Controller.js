import mongoose from "mongoose";
import orderModel from "../models/order.model.js";
import paymentRefundModel from "../models/paymentRefund.model.js";
import productModel from "../models/product.model.js";

const isPaidOrder = (order) =>
  order.paymentStatus === "captured" ||
  (!order.paymentStatus && Boolean(order.paymentId));

class InventoryUnavailableError extends Error {}

export const myOrders = async (req, res) => {
  try {
    const orders = await orderModel
      .find({ user: req.user._id })
      .populate("items.productId", "name price imageUrl")
      .sort({ createdAt: -1 });

    return res.status(200).json(orders);
  } catch (error) {
    console.error("My orders fetch failed:", error);
    return res.status(500).json({ message: "Orders could not be fetched." });
  }
};

export const getOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 25),
    );
    const filter = {};

    if (req.query.status) {
      if (
        !["pending", "processing", "shipped", "delivered"].includes(
          req.query.status,
        )
      ) {
        return res.status(400).json({ message: "Invalid order status filter." });
      }
      filter.status = req.query.status;
    }

    if (req.query.paymentStatus) {
      if (
        ![
          "creating",
          "created",
          "authorized",
          "captured",
          "failed",
          "refunded",
        ].includes(req.query.paymentStatus)
      ) {
        return res.status(400).json({ message: "Invalid payment status filter." });
      }
      if (req.query.paymentStatus === "captured") {
        filter.$or = [
          { paymentStatus: "captured" },
          {
            paymentStatus: { $exists: false },
            paymentId: { $exists: true, $ne: "" },
          },
        ];
      } else {
        filter.paymentStatus = req.query.paymentStatus;
      }
    }

    const [orders, total] = await Promise.all([
      orderModel
        .find(filter)
        .populate("user", "name email")
        .populate("items.productId", "name price imageUrl")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      orderModel.countDocuments(filter),
    ]);

    const refunds = await paymentRefundModel
      .find({ order: { $in: orders.map((order) => order._id) } })
      .sort({ createdAt: -1 })
      .lean();
    const refundsByOrder = new Map();
    for (const refund of refunds) {
      const key = String(refund.order);
      const existing = refundsByOrder.get(key) || [];
      existing.push(refund);
      refundsByOrder.set(key, existing);
    }

    const normalizedOrders = orders.map((order) => ({
      ...order,
      paymentStatus:
        order.paymentStatus || (order.paymentId ? "captured" : "unknown"),
      inventoryStatus:
        order.inventoryStatus ||
        (order.paymentId ? "legacy" : "unallocated"),
      duplicatePaymentRefunds: refundsByOrder.get(String(order._id)) || [],
    }));

    return res.status(200).json({
      orders: normalizedOrders,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Admin orders fetch failed:", error);
    return res.status(500).json({ message: "Orders could not be fetched." });
  }
};

const allowedTransitions = {
  pending: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order id." });
    }

    if (!["pending", "processing", "shipped", "delivered"].includes(status)) {
      return res.status(400).json({ message: "Invalid order status." });
    }

    const order = await orderModel.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.status === status) {
      return res.status(200).json({ message: "Order status unchanged.", order });
    }

    if (!isPaidOrder(order)) {
      return res.status(409).json({
        message: "Only paid orders can move to fulfillment.",
      });
    }

    if (order.inventoryStatus === "review") {
      return res.status(409).json({
        message: "Resolve the inventory review before fulfilling this order.",
      });
    }

    if (!allowedTransitions[order.status]?.includes(status)) {
      return res.status(409).json({
        message: `Order cannot transition from ${order.status} to ${status}.`,
      });
    }

    order.status = status;
    await order.save();

    return res.status(200).json({
      message: "Order status updated.",
      order,
    });
  } catch (error) {
    console.error("Order status update failed:", error);
    return res
      .status(500)
      .json({ message: "Order status could not be updated." });
  }
};

export const allocateInventory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid order id." });
  }

  const session = await mongoose.startSession();
  let order;

  try {
    await session.withTransaction(async () => {
      order = await orderModel.findById(req.params.id).session(session);
      if (!order) {
        const error = new Error("Order not found.");
        error.status = 404;
        throw error;
      }
      if (order.paymentStatus !== "captured") {
        const error = new Error("Only paid orders can allocate inventory.");
        error.status = 409;
        throw error;
      }
      if (order.inventoryStatus === "allocated") return;
      if (order.inventoryStatus !== "review") {
        const error = new Error("Order is not waiting for inventory review.");
        error.status = 409;
        throw error;
      }

      for (const item of order.items) {
        const product = await productModel.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.qty } },
          { $inc: { stock: -item.qty } },
          { new: true, session },
        );
        if (!product) throw new InventoryUnavailableError();
      }

      order.inventoryStatus = "allocated";
      await order.save({ session });
    });

    return res.status(200).json({
      message: "Inventory allocated successfully.",
      order,
    });
  } catch (error) {
    if (error instanceof InventoryUnavailableError) {
      return res.status(409).json({
        message: "There is still not enough stock to fulfill this order.",
      });
    }
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Order inventory allocation failed:", error);
    return res.status(500).json({ message: "Inventory could not be allocated." });
  } finally {
    await session.endSession();
  }
};

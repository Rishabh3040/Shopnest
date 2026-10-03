import orderModel from "../models/order.model.js";
import { sendEmail } from "../services/email.service.js";

// ==========================================
// CREATE ORDER
// ==========================================
const createOrder = async (req, res) => {
  try {
    const { items, totalAmount, address, paymentId } = req.body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Order items are required",
      });
    }

    // Validate total amount
    if (!totalAmount) {
      return res.status(400).json({
        message: "Total amount is required",
      });
    }

    // Validate address
    if (
      !address ||
      !address.fullName ||
      !address.street ||
      !address.city ||
      !address.postalCode ||
      !address.country
    ) {
      return res.status(400).json({
        message: "Complete address is required",
      });
    }

    // Validate payment ID
    if (!paymentId) {
      return res.status(400).json({
        message: "Payment ID is required",
      });
    }

    // Create order
    const order = new orderModel({
      user: req.user._id,
      items,
      totalAmount,
      address,
      paymentId,
    });

    // Save order
    await order.save();

    // Email message
    const message = `Dear ${req.user.name},

Thanks for your order!

Your order has been successfully created.

Order ID: ${order._id}
Total Amount: ₹${totalAmount}

Shipping Address:
${address.fullName}
${address.street}
${address.city}
${address.postalCode}
${address.country}

We will notify you once your order is shipped.

Best regards,
ShopNest Team`;

    // Send email
    await sendEmail(req.user.email, "Order Created", message);

    // Response
    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    console.error("Create Order Error:", error);

    res.status(500).json({
      message: "Error creating order",
      error: error.message,
    });
  }
};

// ==========================================
// GET MY ORDERS
// ==========================================
const myOrders = async (req, res) => {
  try {
    const orders = await orderModel
      .find({
        user: req.user._id,
      })
      .populate("items.productId", "name price")
      .sort({
        createdAt: -1,
      });

    res.status(200).json(orders);
  } catch (error) {
    console.error("My Orders Error:", error);

    res.status(500).json({
      message: "Error fetching orders",
      error: error.message,
    });
  }
};

// ==========================================
// GET ALL ORDERS
// ==========================================
const getorders = async (req, res) => {
  try {
    const orders = await orderModel
      .find({})
      .populate("user", "name email")
      .populate("items.productId", "name price")
      .sort({
        createdAt: -1,
      });

    res.status(200).json(orders);
  } catch (error) {
    console.error("Get Orders Error:", error);

    res.status(500).json({
      message: "Error fetching orders",
      error: error.message,
    });
  }
};

// ==========================================
// UPDATE ORDER STATUS
// ==========================================
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    // Allowed statuses
    const allowedStatuses = ["pending", "shipped", "delivered"];

    // Validate status
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid order status",
      });
    }

    // Find order
    const order = await orderModel.findById(req.params.id);

    // Order not found
    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Update status
    order.status = status;

    // Save order
    await order.save();

    // Response
    res.status(200).json({
      message: "Order status updated",
      order,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);

    res.status(500).json({
      message: "Error updating order status",
      error: error.message,
    });
  }
};

// ==========================================
// EXPORT
// ==========================================
export { createOrder, myOrders, getorders, updateOrderStatus };

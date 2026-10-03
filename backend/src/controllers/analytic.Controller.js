import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";

const getAdminStats = async (req, res) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments({
      role: "user",
    });

    // Total orders
    const totalOrders = await Order.countDocuments({});

    // Total products
    const totalProducts = await Product.countDocuments({});

    // Get all orders
    const orders = await Order.find({});

    // Calculate total revenue
    const totalRevenue = orders.reduce(
      (acc, order) => acc + order.totalAmount,
      0,
    );

    // Send response
    res.status(200).json({
      success: true,
      totalUsers,
      totalOrders,
      totalProducts,
      totalRevenue,
    });
  } catch (error) {
    console.error("Analytics Error:", error);

    res.status(500).json({
      success: false,
      message: "Error fetching admin statistics",
      error: error.message,
    });
  }
};

export default {
  getAdminStats,
};

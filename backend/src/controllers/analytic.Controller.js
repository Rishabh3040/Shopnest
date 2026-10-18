import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";

const getAdminStats = async (req, res) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments({
      role: "user",
    });

    const paidOrderFilter = {
      $or: [
        { paymentStatus: "captured" },
        {
          paymentStatus: { $exists: false },
          paymentId: { $exists: true, $ne: "" },
        },
      ],
    };

    const [totalOrders, totalProducts, totalRevenue] = await Promise.all([
      Order.countDocuments(paidOrderFilter),
      Product.countDocuments({}),
      Order.aggregate([
        { $match: paidOrderFilter },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]).then((result) => result[0]?.total || 0),
    ]);

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
    });
  }
};

export default {
  getAdminStats,
};

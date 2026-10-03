import jwt from "jsonwebtoken";
import config from "../config/config.js";
import userModel from "../models/user.model.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized: No token provided",
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await userModel.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized: User not found",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Unauthorized: Invalid token",
    });
  }
};

export const Protect = protect;

// export const admin = (req, res, next) => {
//   if (!req.user) {
//     return res.status(401).json({
//       message: "Unauthorized: Please login first",
//     });
//   }

//   if (req.user.role !== "admin") {
//     return res.status(403).json({
//       message: "Access denied: Admin only",
//     });
//   }

//   next();
// };

// export default {
//   protect,
//   Protect,
//   admin,
// };

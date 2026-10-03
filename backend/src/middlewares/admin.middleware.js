export const admin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Unauthorized: Please login first",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Access denied: Admin only",
    });
  }

  next();
};

export default admin;

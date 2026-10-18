import accountModel from "../models/account.model.js";

export const createAccountController = async (req, res) => {
  try {
    const user = req.user;

    if (!user?._id) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const account = await accountModel.create({
      user: user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      account,
    });
  } catch (error) {
    console.error("Create account error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create account",
    });
  }
};

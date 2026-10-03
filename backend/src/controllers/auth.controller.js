import userModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import sessionModel from "../models/session.model.js";
import { sendEmail } from "../services/email.service.js";
import { generateOtp, getOtpHtml } from "../utils/utils.js";
import otpModel from "../models/otp.model.js";
import cloudinary from "../config/cloudinary.js";

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    const isAlreadyRegistered = await userModel.findOne({
      $or: [{ name }, { email }],
    });

    if (isAlreadyRegistered) {
      return res.status(409).json({
        message: "name or email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await userModel.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
    });

    const otp = generateOtp();

    const html = getOtpHtml(
      otp,
      `Welcome to the ShopNest ${name} Your OTP for the ShopNest`,
    );

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    await otpModel.create({
      email,
      user: user._id,
      otpHash,
    });

    await sendEmail(
      email,
      "OTP Verification",
      `Your OTP for the ShopNest\nYour OTP code is ${otp}`,
      html,
    );

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage || "",
        verified: user.verified,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);

    return res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.verified) {
      return res.status(401).json({
        message: "Email not verified",
      });
    }

    const usesBcrypt = user.password.startsWith("$2");
    const isPasswordValid = usesBcrypt
      ? await bcrypt.compare(password, user.password)
      : crypto.createHash("sha256").update(password).digest("hex") ===
        user.password;

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!usesBcrypt) {
      user.password = await bcrypt.hash(password, 12);
      await user.save();
    }

    const refreshToken = jwt.sign(
      {
        id: user._id,
      },
      config.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const session = await sessionModel.create({
      user: user._id,
      refreshTokenHash,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const accessToken = jwt.sign(
      {
        id: user._id,
        sessionId: session._id,
      },
      config.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Logged in successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage || "",
        verified: user.verified,
      },
      accessToken,
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
}

export async function getUsers(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized: Please login first",
      });
    }

    const isAdminRoute =
      req.path === "/admin" || req.originalUrl?.includes("/admin");

    if (isAdminRoute) {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          message: "Access denied: Admin only",
        });
      }

      const users = await userModel.find({}).select("-password");

      return res.status(200).json({
        message: "Users fetched successfully",
        users,
      });
    }

    const user = await userModel.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User fetched successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Get Users Error:", error);

    return res.status(500).json({
      message: "Failed to fetch user(s)",
      error: error.message,
    });
  }
}

export async function refreshToken(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        message: "Refresh token not found",
      });
    }

    const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const session = await sessionModel.findOne({
      refreshTokenHash,
      revoked: false,
    });

    if (!session) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    const user = await userModel.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const accessToken = jwt.sign(
      {
        id: user._id,
        sessionId: session._id,
      },
      config.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );

    const newRefreshToken = jwt.sign(
      {
        id: user._id,
      },
      config.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    const newRefreshTokenHash = crypto
      .createHash("sha256")
      .update(newRefreshToken)
      .digest("hex");

    session.refreshTokenHash = newRefreshTokenHash;

    await session.save();

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Access token refreshed successfully",
      accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified,
      },
    });
  } catch (error) {
    console.error("Refresh Token Error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Refresh token expired. Please login again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    return res.status(401).json({
      message: "Refresh token authentication failed",
    });
  }
}

export async function logout(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      return res.status(200).json({ message: "Logged out successfully" });
    }

    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const session = await sessionModel.findOne({
      refreshTokenHash,
      revoked: false,
    });

    if (!session) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      return res.status(200).json({ message: "Logged out successfully" });
    }

    session.revoked = true;

    await session.save();

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout Error:", error);

    return res.status(500).json({
      message: "Logout failed",
      error: error.message,
    });
  }
}

export async function logoutAll(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        message: "Refresh token not found",
      });
    }

    const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

    await sessionModel.updateMany(
      {
        user: decoded.id,
        revoked: false,
      },
      {
        revoked: true,
      },
    );

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      message: "Logged out from all devices successfully",
    });
  } catch (error) {
    console.error("Logout All Error:", error.message);

    return res.status(401).json({
      message: "Logout all failed",
    });
  }
}

export async function verifyEmail(req, res) {
  try {
    const { otp, email } = req.body;

    if (!otp || !email) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    const otpDoc = await otpModel.findOne({
      email,
      otpHash,
    });

    if (!otpDoc) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    const user = await userModel.findByIdAndUpdate(
      otpDoc.user,
      {
        verified: true,
      },
      {
        new: true,
      },
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await otpModel.deleteMany({
      user: otpDoc.user,
    });

    return res.status(200).json({
      message: "Email verified successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified,
      },
    });
  } catch (error) {
    console.error("Verify Email Error:", error);

    return res.status(500).json({
      message: "Email verification failed",
      error: error.message,
    });
  }
}

export async function updateProfileImage(req, res) {
  try {
    if (!req.file?.path) {
      return res.status(400).json({ message: "Choose an image to upload." });
    }

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: "shopnest/profiles",
      resource_type: "image",
      quality: "auto",
      fetch_format: "auto",
    });

    const user = await userModel
      .findByIdAndUpdate(
        req.user._id,
        { profileImage: uploadResult.secure_url },
        { new: true },
      )
      .select("-password");

    return res.status(200).json({
      message: "Profile picture updated successfully.",
      user: { profileImage: user.profileImage },
    });
  } catch (error) {
    console.error("Profile image update error:", error);
    return res
      .status(500)
      .json({ message: "Profile picture could not be updated." });
  }
}

import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import admin from "../middlewares/admin.middleware.js";
import multer from "multer";

const upload = multer({ dest: "upload" });

const authRouter = Router();

/**
 * POST /api/auth/register
 */
authRouter.post("/register", authController.register);

/**
 * POST /api/auth/login
 */
authRouter.post("/login", authController.login);

/**
 * POST /api/auth/verify-otp
 */
authRouter.post("/verify-otp", authController.verifyEmail);

authRouter.post(
  "/profile-image",
  protect,
  admin,
  upload.single("image"),
  authController.updateProfileImage,
);

/**
 * GET /api/auth/user
 * Only logged-in user can access
 */
authRouter.get("/user", protect, authController.getUsers);

/**
 * GET /api/auth/admin
 * Only admin can access
 */
authRouter.get("/admin", protect, admin, authController.getUsers);

/**
 * POST /api/auth/refresh
 */
authRouter.post("/refresh", authController.refreshToken);
authRouter.get("/refresh-token", authController.refreshToken);

authRouter.post("/logout", authController.logout);
authRouter.get("/logout", authController.logout);

/**
 * GET /api/auth/logout-all
 */
authRouter.get("/logout-all", authController.logoutAll);

export default authRouter;

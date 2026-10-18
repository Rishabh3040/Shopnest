import { Router } from "express";
import {
  createPaymentOrder,
  handlePaymentWebhook,
  verifyPayment,
} from "../controllers/payment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const paymentRouter = Router();

paymentRouter.post("/order", protect, createPaymentOrder);
paymentRouter.post("/verify", protect, verifyPayment);
paymentRouter.post("/webhook", handlePaymentWebhook);

export default paymentRouter;

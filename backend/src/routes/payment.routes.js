import { Router } from "express";
import * as paymentController from "../controllers/paymnet.Controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const paymentRouter = Router();

paymentRouter.post("/order", protect, paymentController.createPaymentOrder);
paymentRouter.post("/verify", protect, paymentController.verifyPayment);

export default paymentRouter;

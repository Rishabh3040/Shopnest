import { Router } from "express";
import * as orderController from "../controllers/order.Controller.js";
import { retryPaymentRefund } from "../controllers/payment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import admin from "../middlewares/admin.middleware.js";

const orderRouter = Router();

orderRouter.route("/").get(protect, admin, orderController.getOrders);

orderRouter.route("/myorders").get(protect, orderController.myOrders);

orderRouter
  .route("/:id/status")
  .put(protect, admin, orderController.updateOrderStatus);

orderRouter
  .route("/:id/inventory/allocate")
  .put(protect, admin, orderController.allocateInventory);

orderRouter
  .route("/:id/payment-refunds/:refundId/retry")
  .post(protect, admin, retryPaymentRefund);

export default orderRouter;

import { Router } from "express";
import * as orderController from "../controllers/order.Controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import admin from "../middlewares/admin.middleware.js";

const orderRouter = Router();

orderRouter.route("/").get(protect, admin, orderController.getorders);

orderRouter.route("/myorders").get(protect, orderController.myOrders);

orderRouter
  .route("/:id/status")
  .put(protect, admin, orderController.updateOrderStatus);

export default orderRouter;

// import { Router } from "express";
// import * as orderController from "../controllers/order.Controller.js";
// import { protect } from "../middlewares/auth.middleware.js";
// import admin from "../middlewares/admin.middleware.js";

// const orderRouter = Router();

// orderRouter
//   .route("/")
//   .post(protect, orderController.createOrder)
//   .get(protect, admin, orderController.getOrders);

// orderRouter.route("/myorders").get(protect, orderController.myOrders);

// orderRouter
//   .route("/:id/status")
//   .put(protect, admin, orderController.updateOrderStatus);

// export default orderRouter;

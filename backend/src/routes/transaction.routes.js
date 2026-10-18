import { Router } from "express";
import * as transactionController from "../controllers/transaction.controller.js";
import {
  authSystemUserMiddleware,
  protect,
} from "../middlewares/auth.middleware.js";

const transactionRoutes = Router();

transactionRoutes.post("/", protect, transactionController.createTransaction);
transactionRoutes.post(
  "/system/initial-funds",
  authSystemUserMiddleware,
  transactionController.createInitialFundsTransaction,
);

export default transactionRoutes;

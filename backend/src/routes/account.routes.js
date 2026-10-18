import { Router } from "express";
import * as accountController from "../controllers/account.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const accountRouter = Router();

accountRouter.post("/", protect, accountController.createAccountController);

export default accountRouter;

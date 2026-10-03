import { Router } from "express";
import analyticController from "../controllers/analytic.Controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { admin } from "../middlewares/admin.middleware.js";

const analyticRouter = Router();

analyticRouter.get("/", protect, admin, analyticController.getAdminStats);

export default analyticRouter;

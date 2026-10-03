import { Router } from "express";
import * as productController from "../controllers/product.Controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import admin from "../middlewares/admin.middleware.js";
import multer from "multer";
const upload = multer({ dest: "upload" });

const productRouter = Router();

productRouter
  .route("/")
  .get(productController.getProducts)
  .post(
    upload.single("image"),
    protect,
    admin,
    productController.createProduct,
  );

productRouter
  .route("/:id")
  .get(productController.getProductById)
  .put(upload.single("image"), protect, admin, productController.updateProduct)
  .delete(protect, admin, productController.deleteProduct);

export default productRouter;

import express from "express";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import productsRouter from "./routes/product.routes.js";
import orderRouter from "./routes/order.routes.js";
import paymentRouter from "./routes/payment.routes.js";
import analyticRouter from "./routes/analytic.routes.js";
import { notFound, errorHandler } from "./middlewares/error.middleware.js";

const app = express();
app.set("trust proxy", 1);
const frontendDistPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../frontend/dist",
);
const frontendIndexPath = join(frontendDistPath, "index.html");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "https://checkout.razorpay.com"],
        "connect-src": ["'self'", "https://api.razorpay.com"],
        "frame-src": [
          "'self'",
          "https://api.razorpay.com",
          "https://checkout.razorpay.com",
        ],
        "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
      },
    },
  }),
);
const configuredOrigins = process.env.FRONTEND_URL?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? configuredOrigins || []
    : ["http://localhost:3000", "http://127.0.0.1:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/analytics", analyticRouter);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

if (existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/")) {
      return res.sendFile(frontendIndexPath);
    }
    return next();
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;

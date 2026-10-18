import app from "./src/app.js";
import connectDB from "./src/config/database.js";
import config from "./src/config/config.js";

try {
  await connectDB();
  console.log("Payment environment configured:", {
    razorpayKeyId: Boolean(config.RAZORPAY_KEY_ID),
    razorpayKeySecret: Boolean(config.RAZORPAY_KEY_SECRET),
    razorpayWebhookSecret: Boolean(config.RAZORPAY_WEBHOOK_SECRET),
  });
  app.listen(config.PORT, () => {
    console.log(`Server is running on port ${config.PORT}`);
  });
} catch (error) {
  console.error("Server startup failed:", error);
  process.exitCode = 1;
}

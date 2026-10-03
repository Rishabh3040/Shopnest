import mongoose from "mongoose";
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Product category is required"],
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, "Stock is required"],
      min: [0, "Stock cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Stock must be a whole number",
      },
    },
    imageUrl: { type: String, default: "" },
    rating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
    },
    numReview: {
      type: Number,
      default: 0,
      min: [0, "Review count cannot be negative"],
    },
  },
  { timestamps: true },
);
const Product = mongoose.model("Product", productSchema);
export default Product;

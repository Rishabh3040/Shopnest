import mongoose from "mongoose";
import productModel from "../models/product.model.js";
import cloudinary from "../config/cloudinary.js";

const getErrorResponse = (res, statusCode, message, error) => {
  const payload = {
    success: false,
    message,
  };

  if (process.env.NODE_ENV !== "production" && error) {
    payload.error = error.message;
  }

  return res.status(statusCode).json(payload);
};

const normalizeProductData = (body) => {
  const { name, description, price, category, stock, rating, numReview } = body;

  const normalized = {};

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      throw new Error("Product name is required");
    }
    normalized.name = trimmedName;
  }

  if (description !== undefined) {
    const trimmedDescription = String(description).trim();
    if (!trimmedDescription) {
      throw new Error("Product description is required");
    }
    normalized.description = trimmedDescription;
  }

  if (price !== undefined) {
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      throw new Error("Price must be a valid non-negative number");
    }
    normalized.price = numericPrice;
  }

  if (category !== undefined) {
    const trimmedCategory = String(category).trim();
    if (!trimmedCategory) {
      throw new Error("Product category is required");
    }
    normalized.category = trimmedCategory;
  }

  if (stock !== undefined) {
    const numericStock = Number(stock);
    if (Number.isNaN(numericStock) || numericStock < 0) {
      throw new Error("Stock must be a valid non-negative number");
    }
    normalized.stock = numericStock;
  }

  if (rating !== undefined) {
    const numericRating = Number(rating);
    if (Number.isNaN(numericRating) || numericRating < 0 || numericRating > 5) {
      throw new Error("Rating must be between 0 and 5");
    }
    normalized.rating = numericRating;
  }

  if (numReview !== undefined) {
    const numericReviewCount = Number(numReview);
    if (!Number.isInteger(numericReviewCount) || numericReviewCount < 0) {
      throw new Error("Review count must be a non-negative whole number");
    }
    normalized.numReview = numericReviewCount;
  }

  return normalized;
};

const uploadImageToCloudinary = async (image) => {
  if (!image) return "";

  const uploadResult = await cloudinary.uploader.upload(image, {
    folder: "shopnest/products",
    resource_type: "image",
    quality: "auto",
    fetch_format: "auto",
  });

  return uploadResult.secure_url;
};

export const getProducts = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      stock,
      page = 1,
      limit = 10,
    } = req.query;

    const filters = {};

    if (name) {
      filters.name = { $regex: name, $options: "i" };
    }

    if (description) {
      filters.description = { $regex: description, $options: "i" };
    }

    if (category) {
      filters.category = { $regex: category, $options: "i" };
    }

    if (price) {
      filters.price = Number(price);
    }

    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNumber - 1) * limitNumber;

    const [products, total] = await Promise.all([
      productModel
        .find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      productModel.countDocuments(filters),
    ]);

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      data: products,
    });
  } catch (error) {
    return getErrorResponse(res, 500, "Products fetch failed", error);
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    const product = await productModel.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    return getErrorResponse(res, 500, "Product fetch by id failed", error);
  }
};

export const createProduct = async (req, res) => {
  try {
    const { image, ...rest } = req.body;
    const payload = normalizeProductData(rest);

    if (
      !payload.name ||
      !payload.description ||
      !payload.price ||
      !payload.category
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, description, price and category are required",
      });
    }

    if (payload.stock === undefined) {
      payload.stock = 0;
    }

    const filePath = req.file?.path;
    if (filePath) {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: "shopnest/products",
      });
      console.log("Cloudinary upload result:", result);
      payload.imageUrl = result.secure_url;
    } else if (image) {
      payload.imageUrl = await uploadImageToCloudinary(image);
    }

    const product = await productModel.create(payload);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    if (
      error.message.includes("required") ||
      error.message.includes("number") ||
      error.message.includes("negative")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return getErrorResponse(res, 500, "Product creation failed", error);
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    const product = await productModel.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    Object.assign(product, normalizeProductData(req.body));

    if (req.file?.path) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "shopnest/products",
      });

      product.imageUrl = result.secure_url;
    }

    const updatedProduct = await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    if (
      error.message.includes("required") ||
      error.message.includes("number") ||
      error.message.includes("negative") ||
      error.message.includes("Rating") ||
      error.message.includes("Review count")
    ) {
      return res.status(400).json({ message: error.message });
    }
    return getErrorResponse(res, 500, "Product update failed", error);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    const product = await productModel.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: product,
    });
  } catch (error) {
    return getErrorResponse(res, 500, "Product deletion failed", error);
  }
};

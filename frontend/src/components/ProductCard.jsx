import React from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { addToCart } from "../redux/cartSlice";
import "../styles/product.css";

const ProductCard = ({ product }) => {
  const dispatch = useDispatch();
  const productId = product?._id || product?.id;
  const stock = Number(product?.stock || 0);

  if (!product || !productId) return null;

  const handleAddToCart = () => {
    if (stock < 1) return;
    dispatch(
      addToCart({
        productId,
        name: product.name,
        price: Number(product.price || 0),
        imageUrl: product.imageUrl || "",
        stock,
        qty: 1,
      }),
    );
  };

  return (
    <div className="product-card">
      <Link to={`/product/${productId}`} className="product-card-image-link">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="product-image"
          />
        ) : (
          <div
            className="product-image-placeholder"
            aria-label="No image available"
          >
            No image
          </div>
        )}
      </Link>
      <div className="product-info">
        <p className="product-category">
          {product.category || "Uncategorized"}
        </p>
        <Link to={`/product/${productId}`} className="product-card-title">
          <h3>{product.name}</h3>
        </Link>
        <p className="product-card-description">{product.description}</p>
        <p className="price">₹{product.price}</p>
        <p
          className={`product-stock ${stock > 0 ? "in-stock" : "out-of-stock"}`}
        >
          {stock > 0 ? `${stock} in stock` : "Out of stock"}
        </p>
        <div className="product-card-actions">
          <button
            type="button"
            className="btn"
            onClick={handleAddToCart}
            disabled={stock < 1}
          >
            {stock > 0 ? "Add to Cart" : "Unavailable"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { addToCart } from "../redux/cartSlice";
import "../styles/product.css";

const ProductDetail = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/products/${id}`);
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "Product could not be loaded.");
        setProduct(data.data || data.product || data);
      } catch (fetchError) {
        setError(fetchError.message || "Product could not be loaded.");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading)
    return <div className="product-detail-state">Loading product...</div>;
  if (error || !product)
    return (
      <div className="product-detail-state" role="alert">
        {error || "Product not found."}
      </div>
    );

  const productId = product._id || product.id;
  const name = product.name || "Unnamed Product";
  const description = product.description || "No description available.";
  const price = Number(product.price || 0);
  const stock = Number(product.stock || 0);
  const imageUrl = product.imageUrl || "";
  const category = product.category || "Uncategorized";

  const isInStock = stock > 0;

  const handleAddToCart = () => {
    if (!isInStock) {
      alert("This product is currently out of stock.");
      return;
    }

    dispatch(
      addToCart({
        productId,
        name,
        price,
        imageUrl,
        stock,
        qty: 1,
      }),
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <main className="product-detail-page">
      <Link to="/shop" className="product-back-link">
        Back to shop
      </Link>
      <section className="product-detail">
        <div className="product-detail-media">
          {imageUrl ? (
            <img className="detail-image" src={imageUrl} alt={name} />
          ) : (
            <div className="detail-image-placeholder">No image available</div>
          )}
        </div>
        <div className="detail-info">
          <span className="product-category">{category}</span>
          <h1>{name}</h1>
          <div className="detail-price">₹{price.toFixed(2)}</div>
          <p>{description}</p>
          <span
            className={`product-stock ${isInStock ? "in-stock" : "out-of-stock"}`}
          >
            {isInStock ? `${stock} available` : "Out of stock"}
          </span>
          <button
            className="btn"
            type="button"
            onClick={handleAddToCart}
            disabled={!isInStock}
          >
            {added
              ? "Added to Cart"
              : isInStock
                ? "Add to Cart"
                : "Out of Stock"}
          </button>
        </div>
      </section>
    </main>
  );
};

export default ProductDetail;

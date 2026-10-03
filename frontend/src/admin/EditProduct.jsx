import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiFetch from "../utils/api";

const EditProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    stock: "",
    rating: 0,
    numReview: 0,
  });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await apiFetch(`/api/products/${id}`);
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Product could not be loaded.");
        const product = data.data || data.product || data;
        setFormData({
          name: product.name || "",
          description: product.description || "",
          price: product.price ?? "",
          category: product.category || "",
          stock: product.stock ?? 0,
          rating: product.rating ?? 0,
          numReview: product.numReview ?? 0,
        });
      } catch (fetchError) {
        setError(fetchError.message || "Product could not be loaded.");
      }
    };
    fetchProduct();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData();
    data.append("name", formData.name);
    data.append("description", formData.description);
    data.append("price", formData.price);
    data.append("category", formData.category);
    data.append("stock", formData.stock);
    data.append("rating", formData.rating);
    data.append("numReview", formData.numReview);
    if (image) data.append("image", image);

    try {
      const res = await apiFetch(`/api/products/${id}`, {
        method: "PUT",
        body: data,
      });
      const responseData = await res.json();
      if (!res.ok)
        throw new Error(
          responseData.message || "Product could not be updated.",
        );
      navigate("/admin/products");
    } catch (submitError) {
      setError(submitError.message || "Product could not be updated.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "40px auto",
        background: "#10221b",
        padding: "40px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <h2 style={{ color: "#48c9a1", marginBottom: "20px" }}>Edit Product</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        <input
          id="edit-product-name"
          name="name"
          type="text"
          placeholder="Product Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          style={inputStyle}
        />
        <textarea
          id="edit-product-description"
          name="description"
          placeholder="Description"
          required
          rows="4"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          style={inputStyle}
        />
        <input
          id="edit-product-price"
          name="price"
          type="number"
          placeholder="Price"
          required
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          style={inputStyle}
        />
        <input
          id="edit-product-category"
          name="category"
          type="text"
          placeholder="Category"
          required
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
          style={inputStyle}
        />
        <input
          id="edit-product-stock"
          name="stock"
          type="number"
          placeholder="Stock"
          required
          value={formData.stock}
          onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
          style={inputStyle}
        />
        <input
          id="edit-product-rating"
          name="rating"
          type="number"
          placeholder="Rating"
          required
          min="0"
          max="5"
          step="0.1"
          value={formData.rating}
          onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
          style={inputStyle}
        />
        <input
          id="edit-product-reviews"
          name="numReview"
          type="number"
          placeholder="Review Count"
          required
          min="0"
          step="1"
          value={formData.numReview}
          onChange={(e) =>
            setFormData({ ...formData, numReview: e.target.value })
          }
          style={inputStyle}
        />
        <div
          style={{
            padding: "15px",
            border: "1px dashed #48c9a1",
            borderRadius: "8px",
          }}
        >
          <label
            htmlFor="edit-product-image"
            style={{ display: "block", marginBottom: "10px", color: "#a9b9ae" }}
          >
            Replace Image (Optional)
          </label>
          <input
            id="edit-product-image"
            name="image"
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files[0])}
            style={{ color: "#fff" }}
          />
        </div>
        {error && (
          <p role="alert" style={{ color: "#fca5a5" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn"
          style={{ marginTop: "10px" }}
        >
          {loading ? "Updating..." : "Update Product"}
        </button>
      </form>
    </div>
  );
};

const inputStyle = {
  padding: "12px",
  background: "#091510",
  border: "1px solid #1b3026",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "15px",
  outline: "none",
};
export default EditProduct;

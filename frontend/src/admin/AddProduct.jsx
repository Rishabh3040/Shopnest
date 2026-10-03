import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import apiFetch from "../utils/api";

const AddProduct = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    stock: "",
  });

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Admin check
  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Image validation
    if (!image) {
      return alert("Please select an image");
    }

    setLoading(true);

    // FormData for text + image
    const data = new FormData();

    data.append("name", formData.name);
    data.append("description", formData.description);
    data.append("price", formData.price);
    data.append("category", formData.category);
    data.append("stock", formData.stock);
    data.append("image", image);

    try {
      /*
        apiFetch automatically:
        1. Adds access token
        2. Sends refresh cookie
        3. Refreshes access token if old token expires
        4. Retries the request
        5. Does NOT manually set Content-Type for FormData
      */
      const res = await apiFetch("/api/products", {
        method: "POST",
        body: data,
      });

      // Server response safely read
      const text = await res.text();

      let responseData;

      try {
        responseData = JSON.parse(text);
      } catch (error) {
        console.error("Server returned non-JSON response:", text);

        alert(`Server error (${res.status})`);
        return;
      }

      if (res.ok) {
        alert("Product created successfully with Cloudinary Image URL!");

        // Reset form
        setFormData({
          name: "",
          description: "",
          price: "",
          category: "",
          stock: "",
        });

        setImage(null);

        // Go to shop
        navigate("/shop");
      } else {
        alert(responseData.message || "Error creating product");
      }
    } catch (error) {
      console.error("Add Product Error:", error);
      alert("Something went wrong while creating the product.");
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
      <h2
        style={{
          color: "#48c9a1",
          marginBottom: "20px",
        }}
      >
        Add New Product
      </h2>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
        }}
      >
        {/* Product Name */}
        <input
          id="add-product-name"
          name="name"
          type="text"
          placeholder="Product Name"
          required
          value={formData.name}
          onChange={(e) =>
            setFormData({
              ...formData,
              name: e.target.value,
            })
          }
          style={inputStyle}
        />

        {/* Description */}
        <textarea
          id="add-product-description"
          name="description"
          placeholder="Description"
          required
          rows="4"
          value={formData.description}
          onChange={(e) =>
            setFormData({
              ...formData,
              description: e.target.value,
            })
          }
          style={inputStyle}
        />

        {/* Price */}
        <input
          id="add-product-price"
          name="price"
          type="number"
          placeholder="Price"
          required
          min="0"
          step="0.01"
          value={formData.price}
          onChange={(e) =>
            setFormData({
              ...formData,
              price: e.target.value,
            })
          }
          style={inputStyle}
        />

        {/* Category */}
        <input
          id="add-product-category"
          name="category"
          type="text"
          placeholder="Category"
          required
          value={formData.category}
          onChange={(e) =>
            setFormData({
              ...formData,
              category: e.target.value,
            })
          }
          style={inputStyle}
        />

        {/* Stock */}
        <input
          id="add-product-stock"
          name="stock"
          type="number"
          placeholder="Stock Quantity"
          required
          min="0"
          step="1"
          value={formData.stock}
          onChange={(e) =>
            setFormData({
              ...formData,
              stock: e.target.value,
            })
          }
          style={inputStyle}
        />

        {/* Image Upload */}
        <div
          style={{
            padding: "15px",
            border: "1px dashed #48c9a1",
            borderRadius: "8px",
          }}
        >
          <label
            htmlFor="add-product-image"
            style={{
              display: "block",
              marginBottom: "10px",
              color: "#a9b9ae",
            }}
          >
            Upload Product Image (Cloudinary)
          </label>

          <input
            id="add-product-image"
            name="image"
            type="file"
            accept="image/*"
            required
            onChange={(e) => setImage(e.target.files[0])}
            style={{
              color: "#fff",
            }}
          />

          {/* Selected image name */}
          {image && (
            <p
              style={{
                color: "#a9b9ae",
                marginTop: "10px",
                fontSize: "13px",
              }}
            >
              Selected: {image.name}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="btn"
          style={{
            marginTop: "10px",
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Uploading & Creating..." : "Publish Product"}
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

export default AddProduct;

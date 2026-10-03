import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiFetch from "../utils/api";

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await apiFetch("/api/products?page=1&limit=50");
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Products could not be loaded.");
        const allProducts = Array.isArray(data)
          ? data
          : data.data || data.products || [];
        for (let page = 2; page <= (data.pages || 1); page += 1) {
          const pageResponse = await apiFetch(
            `/api/products?page=${page}&limit=50`,
          );
          const pageData = await pageResponse.json();
          if (!pageResponse.ok)
            throw new Error(
              pageData.message || "Products could not be loaded.",
            );
          allProducts.push(
            ...(Array.isArray(pageData)
              ? pageData
              : pageData.data || pageData.products || []),
          );
        }
        setProducts(allProducts);
      } catch (fetchError) {
        setError(fetchError.message || "Products could not be loaded.");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you strictly sure you want to delete this?")) {
      const res = await apiFetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProducts((currentProducts) =>
          currentProducts.filter((p) => p._id !== id),
        );
      }
    }
  };

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ color: "#48c9a1" }}>Manage Products</h2>
        <Link to="/admin/add-product" className="btn">
          + Add Product
        </Link>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={rowStyle}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>IMAGE</th>
              <th style={thStyle}>NAME</th>
              <th style={thStyle}>DESCRIPTION</th>
              <th style={thStyle}>PRICE</th>
              <th style={thStyle}>CATEGORY</th>
              <th style={thStyle}>STOCK</th>
              <th style={thStyle}>RATING</th>
              <th style={thStyle}>REVIEWS</th>
              <th style={thStyle}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              !error &&
              products.map((product) => (
                <tr key={product._id} style={rowStyle}>
                  <td style={tdStyle}>{product._id?.substring(0, 8)}...</td>
                  <td style={tdStyle}>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        style={{
                          width: 64,
                          height: 64,
                          objectFit: "cover",
                          borderRadius: 6,
                        }}
                      />
                    ) : (
                      "No image"
                    )}
                  </td>
                  <td style={tdStyle}>{product.name}</td>
                  <td style={{ ...tdStyle, minWidth: 220, maxWidth: 340 }}>
                    {product.description}
                  </td>
                  <td style={tdStyle}>
                    ₹{Number(product.price || 0).toFixed(2)}
                  </td>
                  <td style={tdStyle}>{product.category}</td>
                  <td style={tdStyle}>{product.stock}</td>
                  <td style={tdStyle}>
                    {Number(product.rating || 0).toFixed(1)}
                  </td>
                  <td style={tdStyle}>{product.numReview || 0}</td>
                  <td style={tdStyle}>
                    <Link
                      to={`/admin/edit-product/${product._id}`}
                      style={editBtn}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(product._id)}
                      style={deleteBtn}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            {loading && (
              <tr>
                <td style={tdStyle} colSpan="10">
                  Loading products...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td style={tdStyle} colSpan="10" role="alert">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && products.length === 0 && (
              <tr>
                <td style={tdStyle} colSpan="10">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const containerStyle = {
  maxWidth: "1200px",
  margin: "40px auto",
  padding: "30px",
  background: "#10221b",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.05)",
  color: "#f2f7f3",
};
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const rowStyle = { borderBottom: "1px solid rgba(255,255,255,0.1)" };
const thStyle = {
  padding: "15px",
  textAlign: "left",
  color: "#a9b9ae",
  fontSize: "0.9rem",
};
const tdStyle = { padding: "15px", textAlign: "left" };
const editBtn = {
  background: "#3b82f6",
  color: "#fff",
  padding: "6px 12px",
  borderRadius: "4px",
  marginRight: "10px",
};
const deleteBtn = {
  background: "#ef4444",
  color: "#fff",
  padding: "6px 12px",
  borderRadius: "4px",
  border: "none",
  cursor: "pointer",
};

export default AdminProducts;

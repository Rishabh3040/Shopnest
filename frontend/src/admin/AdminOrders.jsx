import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import apiFetch from "../utils/api";

const AdminOrders = () => {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await apiFetch("/api/orders");
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Orders could not be loaded.");
        setOrders(Array.isArray(data) ? data : data.orders || []);
      } catch (fetchError) {
        setError(fetchError.message || "Orders could not be loaded.");
      }
    };
    if (user?.token) fetchOrders();
  }, [user?.token]);

  const updateStatus = async (id, status) => {
    const res = await apiFetch(`/api/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order._id === id ? { ...order, status } : order,
        ),
      );
    } else {
      const data = await res.json();
      setError(data.message || "Order status could not be updated.");
    }
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ color: "#48c9a1", marginBottom: "20px" }}>Manage Orders</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={rowStyle}>
              <th style={thStyle}>ORDER ID</th>
              <th style={thStyle}>USER</th>
              <th style={thStyle}>PRODUCTS</th>
              <th style={thStyle}>TOTAL</th>
              <th style={thStyle}>DATE</th>
              <th style={thStyle}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id} style={rowStyle}>
                <td style={tdStyle}>{order._id?.substring(0, 8)}...</td>
                <td style={tdStyle}>{order.user?.name || "Deleted User"}</td>
                <td style={tdStyle}>
                  <div
                    style={{ display: "grid", gap: "8px", minWidth: "220px" }}
                  >
                    {(order.items || []).map((item, index) => {
                      const product = item.productId;
                      return (
                        <div
                          key={
                            item._id || product?._id || `${order._id}-${index}`
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          {product?.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name || "Ordered product"}
                              style={{
                                width: 44,
                                height: 44,
                                objectFit: "cover",
                                borderRadius: 4,
                              }}
                            />
                          ) : (
                            <div
                              aria-label="No product image"
                              style={{
                                width: 44,
                                height: 44,
                                display: "grid",
                                placeItems: "center",
                                background: "#1b3026",
                                color: "#a9b9ae",
                                borderRadius: 4,
                                fontSize: 11,
                              }}
                            >
                              No image
                            </div>
                          )}
                          <span>
                            {product?.name || "Product unavailable"} ×{" "}
                            {item.qty}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td style={tdStyle}>
                  ₹{Number(order.totalAmount || 0).toFixed(2)}
                </td>
                <td style={tdStyle}>
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
                <td style={tdStyle}>
                  <select
                    id={`order-status-${order._id}`}
                    name={`orderStatus-${order._id}`}
                    value={
                      order.status === "delivere"
                        ? "delivered"
                        : (order.status || "pending").toLowerCase()
                    }
                    onChange={(e) => updateStatus(order._id, e.target.value)}
                    style={{
                      background: "#091510",
                      color: "#fff",
                      padding: "6px",
                      border: "1px solid #1b3026",
                      borderRadius: "4px",
                      outline: "none",
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && (
          <p role="alert" style={{ color: "#fca5a5" }}>
            {error}
          </p>
        )}
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

export default AdminOrders;

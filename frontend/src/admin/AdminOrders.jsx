import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import apiFetch from "../utils/api";

const AdminOrders = () => {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [allocatingOrderId, setAllocatingOrderId] = useState("");
  const [retryingRefundId, setRetryingRefundId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/orders?page=${page}&limit=25`);
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Orders could not be loaded.");
        if (!cancelled) {
          setOrders(Array.isArray(data) ? data : data.orders || []);
          setPages(data.pages || 1);
          setError("");
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message || "Orders could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user?.token) {
      fetchOrders();
    } else {
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [user?.token, page]);

  const updateStatus = async (id, status) => {
    try {
      const res = await apiFetch(`/api/orders/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Order status could not be updated.");
      }
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order._id === id ? { ...order, status } : order,
        ),
      );
      setError("");
    } catch (updateError) {
      setError(updateError.message || "Order status could not be updated.");
    }
  };

  const allocateInventory = async (orderId) => {
    setAllocatingOrderId(orderId);
    setError("");
    setNotice("");
    try {
      const res = await apiFetch(
        `/api/orders/${orderId}/inventory/allocate`,
        { method: "PUT" },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Inventory could not be allocated.");
      }
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order._id === orderId
            ? { ...order, inventoryStatus: "allocated" }
            : order,
        ),
      );
      setNotice(data.message || "Inventory allocated successfully.");
    } catch (allocationError) {
      setError(allocationError.message || "Inventory could not be allocated.");
    } finally {
      setAllocatingOrderId("");
    }
  };

  const retryRefund = async (orderId, refundId) => {
    setRetryingRefundId(refundId);
    setError("");
    setNotice("");
    try {
      const res = await apiFetch(
        `/api/orders/${orderId}/payment-refunds/${refundId}/retry`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Refund could not be retried.");
      }
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order._id === orderId
            ? {
                ...order,
                duplicatePaymentRefunds: order.duplicatePaymentRefunds.map(
                  (refund) =>
                    refund._id === refundId ? data.refund : refund,
                ),
              }
            : order,
        ),
      );
      setNotice(data.message || "Refund processed.");
    } catch (retryError) {
      setError(retryError.message || "Refund could not be retried.");
    } finally {
      setRetryingRefundId("");
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
              <th style={thStyle}>SHIP TO</th>
              <th style={thStyle}>TOTAL</th>
              <th style={thStyle}>PAYMENT</th>
              <th style={thStyle}>DATE</th>
              <th style={thStyle}>FULFILLMENT</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id} style={rowStyle}>
                <td style={tdStyle}>{order._id?.substring(0, 8)}...</td>
                <td style={tdStyle}>
                  <div>{order.user?.name || "Deleted User"}</div>
                  {order.user?.email && (
                    <small style={{ color: "#a9b9ae" }}>
                      {order.user.email}
                    </small>
                  )}
                </td>
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
                          {product?.imageUrl || item.imageUrl ? (
                            <img
                              src={product?.imageUrl || item.imageUrl}
                              alt={
                                product?.name || item.name || "Ordered product"
                              }
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
                            {product?.name ||
                              item.name ||
                              "Product unavailable"}{" "}
                            ×{" "}
                            {item.qty}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td style={tdStyle}>
                  <div>{order.address?.fullName}</div>
                  <div>{order.address?.street}</div>
                  <div>
                    {order.address?.city}, {order.address?.postalCode}
                  </div>
                  <div>{order.address?.country}</div>
                </td>
                <td style={tdStyle}>
                  ₹{Number(order.totalAmount || 0).toFixed(2)}
                </td>
                <td style={tdStyle}>
                  <div>{order.paymentStatus || "unknown"}</div>
                  {order.paymentId && (
                    <small style={{ color: "#a9b9ae" }}>
                      Ref: {order.paymentId}
                    </small>
                  )}
                  {(order.duplicatePaymentRefunds || []).map((refund) => (
                    <div
                      key={refund._id}
                      style={{
                        marginTop: 8,
                        color:
                          refund.status === "refunded" ? "#48c9a1" : "#fca5a5",
                      }}
                    >
                      <div>
                        Duplicate payment {refund.capturedPaymentId}:{" "}
                        {refund.status}
                      </div>
                      {refund.failureReason && (
                        <small>{refund.failureReason}</small>
                      )}
                      {(refund.status === "failed" ||
                        (refund.status === "refunding" &&
                          (!refund.lockExpiresAt ||
                            new Date(refund.lockExpiresAt).getTime() <=
                              Date.now()))) && (
                        <button
                          type="button"
                          className="btn"
                          disabled={retryingRefundId === refund._id}
                          onClick={() => retryRefund(order._id, refund._id)}
                          style={{ display: "block", marginTop: 6, padding: "6px 10px" }}
                        >
                          {retryingRefundId === refund._id
                            ? "Checking..."
                            : refund.status === "failed"
                              ? "Retry duplicate-payment refund"
                              : "Check refund status"}
                        </button>
                      )}
                    </div>
                  ))}
                  {order.inventoryStatus === "review" && (
                    <div>
                      <strong
                        role="alert"
                        style={{ display: "block", color: "#fca5a5" }}
                      >
                        Inventory review required
                      </strong>
                      <button
                        type="button"
                        className="btn"
                        disabled={allocatingOrderId === order._id}
                        onClick={() => allocateInventory(order._id)}
                        style={{ marginTop: 8, padding: "6px 10px" }}
                      >
                        {allocatingOrderId === order._id
                          ? "Allocating..."
                          : "Allocate available stock"}
                      </button>
                    </div>
                  )}
                </td>
                <td style={tdStyle}>
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
                <td style={tdStyle}>
                  <select
                    id={`order-status-${order._id}`}
                    name={`orderStatus-${order._id}`}
                    value={
                      (order.status || "pending").toLowerCase()
                    }
                    onChange={(e) => updateStatus(order._id, e.target.value)}
                    disabled={
                      order.paymentStatus !== "captured" ||
                      order.inventoryStatus === "review"
                    }
                    style={{
                      background: "#091510",
                      color: "#fff",
                      padding: "6px",
                      border: "1px solid #1b3026",
                      borderRadius: "4px",
                      outline: "none",
                    }}
                  >
                    {(order.status === "pending"
                      ? ["pending", "processing"]
                      : order.status === "processing"
                        ? ["processing", "shipped"]
                        : order.status === "shipped"
                          ? ["shipped", "delivered"]
                          : ["delivered"]
                    ).map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && orders.length === 0 && (
          <p>No orders found.</p>
        )}
        {loading && <p>Loading orders...</p>}
        {error && (
          <p role="alert" style={{ color: "#fca5a5" }}>
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            className="btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="btn"
            disabled={page >= pages || loading}
            onClick={() => setPage((current) => Math.min(pages, current + 1))}
          >
            Next
          </button>
        </div>
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

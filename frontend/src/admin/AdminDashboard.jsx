import React, { useEffect, useState, useContext, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import apiFetch from "../utils/api";

const AdminDashboard = () => {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInput = useRef(null);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }

    const fetchStats = async () => {
      try {
        const res = await fetch("/api/analytics", {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setStats(data);
        } else {
          if (res.status === 401) {
            navigate("/login");
          }
          setStats({
            totalOrders: 0,
            totalProducts: 0,
            totalUsers: 0,
            totalRevenue: 0,
          });
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchStats();
  }, [user, navigate]);

  const handleAvatarChange = async (event) => {
    const image = event.target.files?.[0];
    if (!image) return;

    setAvatarLoading(true);
    setAvatarError("");
    const formData = new FormData();
    formData.append("image", image);

    try {
      const response = await apiFetch("/api/auth/profile-image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message || "Profile picture could not be updated.",
        );
      updateUser(data.user);
    } catch (error) {
      setAvatarError(error.message || "Profile picture could not be updated.");
    } finally {
      setAvatarLoading(false);
      event.target.value = "";
    }
  };

  const cardStyle = {
    padding: "25px",
    background: "#10221b",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "10px",
  };

  const numberStyle = {
    fontSize: "2.5rem",
    fontWeight: "700",
    color: "#48c9a1",
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "18px",
          marginBottom: "5px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            title="Edit profile picture"
            aria-label="Edit profile picture"
            disabled={avatarLoading}
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              border: "2px solid #48c9a1",
              padding: 0,
              overflow: "hidden",
              background: "#1b3026",
              color: "#fff",
              cursor: "pointer",
              fontSize: "22px",
              fontWeight: 700,
            }}
          >
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt="Admin profile"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (user?.name || "A").charAt(0).toUpperCase()
            )}
          </button>
          <input
            ref={avatarInput}
            id="admin-profile-image"
            name="profileImage"
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: "none" }}
          />
          <div>
            <h2 style={{ margin: 0 }}>Admin Dashboard</h2>
            <button
              type="button"
              className="btn"
              onClick={() => avatarInput.current?.click()}
              disabled={avatarLoading}
              style={{ marginTop: "8px", padding: "6px 12px" }}
            >
              {avatarLoading ? "Uploading..." : "Edit Photo"}
            </button>
          </div>
        </div>
      </div>
      {avatarError && (
        <p role="alert" style={{ color: "#fca5a5" }}>
          {avatarError}
        </p>
      )}
      <p style={{ color: "#a9b9ae", marginBottom: "30px", fontSize: "1.1rem" }}>
        Welcome back, <span style={{ color: "#fff" }}>{user?.name}</span>
      </p>

      {stats ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
          }}
        >
          <div style={cardStyle}>
            <h4 style={{ color: "#a9b9ae", fontSize: "1rem" }}>Total Orders</h4>
            <div style={numberStyle}>{stats.totalOrders}</div>
          </div>
          <div style={cardStyle}>
            <h4 style={{ color: "#a9b9ae", fontSize: "1rem" }}>
              Total Products
            </h4>
            <div style={numberStyle}>{stats.totalProducts}</div>
          </div>
          <div style={cardStyle}>
            <h4 style={{ color: "#a9b9ae", fontSize: "1rem" }}>Total Users</h4>
            <div style={numberStyle}>{stats.totalUsers}</div>
          </div>
          <div style={cardStyle}>
            <h4 style={{ color: "#a9b9ae", fontSize: "1rem" }}>
              Total Revenue
            </h4>
            <div style={numberStyle}>₹{stats.totalRevenue.toFixed(2)}</div>
          </div>
        </div>
      ) : (
        <div
          style={{ textAlign: "center", margin: "50px 0", color: "#48c9a1" }}
        >
          Loading metrics...
        </div>
      )}

      <div
        style={{
          marginTop: "40px",
          padding: "30px",
          background: "#10221b",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <h3 style={{ marginBottom: "25px", color: "#48c9a1" }}>
          Administrative Controls
        </h3>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          <button
            className="btn"
            onClick={() => navigate("/admin/add-product")}
          >
            + Add Product
          </button>
          <button
            className="btn"
            onClick={() => navigate("/admin/products")}
            style={{ background: "#2a4236" }}
          >
            📦 Manage Products
          </button>
          <button
            className="btn"
            onClick={() => navigate("/admin/orders")}
            style={{ background: "#2a4236" }}
          >
            🚚 Manage Orders
          </button>
          <button
            className="btn"
            onClick={() => navigate("/admin/users")}
            style={{ background: "#2a4236" }}
          >
            👥 Users Directory
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const Profile = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------
  // USER DATA
  // --------------------------------------------------

  // Different possible user response structures handle
  const userData = user?.user || user?.data || user;

  const name =
    userData?.name || userData?.fullName || userData?.username || "User";

  const email = userData?.email || "N/A";

  const role = String(
    userData?.role || userData?.userRole || "user",
  ).toLowerCase();

  const accountType = role === "admin" ? "Admin" : "User";

  // Token can be in different locations
  const token =
    user?.token ||
    userData?.token ||
    user?.accessToken ||
    userData?.accessToken;

  // --------------------------------------------------
  // FETCH ORDERS
  // --------------------------------------------------

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    // Admin ko user orders nahi dikhane
    if (role === "admin") {
      setLoading(false);
      return;
    }

    const fetchMyOrders = async () => {
      try {
        if (!token) {
          console.error("Authentication token not found.");
          setOrders([]);
          setLoading(false);
          return;
        }

        const res = await fetch("/api/orders/myorders", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data = await res.json();

        if (res.ok) {
          setOrders(Array.isArray(data) ? data : []);
        } else {
          console.error("Failed to fetch orders:", data);
          setOrders([]);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMyOrders();
  }, [user, navigate, role, token]);

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // --------------------------------------------------
  // USER NOT LOGGED IN
  // --------------------------------------------------

  if (!user) {
    return null;
  }

  // --------------------------------------------------
  // STYLES
  // --------------------------------------------------

  const containerStyle = {
    maxWidth: "1000px",
    margin: "40px auto",
    padding: "30px",
    background: "#10221b",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.05)",
    color: "#f2f7f3",
  };

  const badgeStyle = {
    background:
      role === "admin" ? "rgba(239,68,68,0.1)" : "rgba(72,201,161,0.1)",

    color: role === "admin" ? "#ef4444" : "#48c9a1",

    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: "bold",
    display: "inline-block",
  };

  // --------------------------------------------------
  // JSX
  // --------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* ============================================
          PROFILE HEADER
      ============================================ */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: "30px",
          marginBottom: "30px",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          {/* Heading */}

          <h2
            style={{
              color: "#fff",
              fontSize: "2.2rem",
              marginBottom: "10px",
            }}
          >
            My Profile
          </h2>

          {/* Name */}

          <p
            style={{
              color: "#a9b9ae",
              fontSize: "1.2rem",
              marginBottom: "5px",
            }}
          >
            <strong>Name:</strong> {name}
          </p>

          {/* Email */}

          <p
            style={{
              color: "#a9b9ae",
              fontSize: "1.2rem",
              marginBottom: "15px",
            }}
          >
            <strong>Email:</strong> {email}
          </p>

          {/* Account Type */}

          <span style={badgeStyle}>Account Type: {accountType}</span>
        </div>

        {/* Logout */}

        <button
          onClick={handleLogout}
          className="btn"
          style={{
            background: "#ef4444",
            boxShadow: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      {/* ============================================
          ADMIN PROFILE
      ============================================ */}

      {role === "admin" ? (
        <div>
          <h3
            style={{
              color: "#48c9a1",
              marginBottom: "20px",
              fontSize: "1.5rem",
            }}
          >
            Admin Account
          </h3>

          <div
            style={{
              background: "#091510",
              padding: "30px",
              borderRadius: "8px",
              border: "1px solid #1b3026",
            }}
          >
            <p
              style={{
                color: "#a9b9ae",
                marginBottom: "20px",
                fontSize: "1rem",
              }}
            >
              You are logged in as an administrator.
            </p>

            <Link
              to="/admin"
              className="btn"
              style={{
                display: "inline-block",
                textDecoration: "none",
              }}
            >
              Go to Admin Dashboard
            </Link>
          </div>
        </div>
      ) : (
        /* ==========================================
           NORMAL USER
        ========================================== */

        <>
          <h3
            style={{
              color: "#48c9a1",
              marginBottom: "20px",
              fontSize: "1.5rem",
            }}
          >
            Order History
          </h3>

          {/* Loading */}

          {loading ? (
            <p
              style={{
                color: "#a9b9ae",
              }}
            >
              Fetching your orders...
            </p>
          ) : orders.length === 0 ? (
            /* ======================================
               NO ORDERS
            ====================================== */

            <div
              style={{
                background: "#091510",
                padding: "30px",
                borderRadius: "8px",
                textAlign: "center",
                border: "1px solid #1b3026",
              }}
            >
              <p
                style={{
                  color: "#a9b9ae",
                  marginBottom: "15px",
                }}
              >
                You haven't placed any orders yet.
              </p>

              <Link to="/shop" className="btn">
                Start Shopping
              </Link>
            </div>
          ) : (
            /* ======================================
               ORDERS LIST
            ====================================== */

            <div
              style={{
                display: "grid",
                gap: "20px",
              }}
            >
              {orders.map((order) => {
                const status = String(order?.status || "pending").toLowerCase();

                const statusColor =
                  status === "delivered"
                    ? "#10b981"
                    : status === "shipped"
                      ? "#3b82f6"
                      : "#f59e0b";

                const statusBackground =
                  status === "delivered"
                    ? "rgba(16,185,129,0.1)"
                    : status === "shipped"
                      ? "rgba(59,130,246,0.1)"
                      : "rgba(245,158,11,0.1)";

                return (
                  <div
                    key={order?._id}
                    style={{
                      background: "#091510",
                      padding: "20px",
                      borderRadius: "12px",
                      border: "1px solid #1b3026",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "20px",
                    }}
                  >
                    {/* Order Details */}

                    <div>
                      <p
                        style={{
                          color: "#a9b9ae",
                          fontSize: "0.9rem",
                          marginBottom: "5px",
                        }}
                      >
                        Order ID:{" "}
                        <span
                          style={{
                            color: "#fff",
                          }}
                        >
                          {order?._id || "N/A"}
                        </span>
                      </p>

                      <p
                        style={{
                          color: "#a9b9ae",
                          fontSize: "0.9rem",
                          marginBottom: "5px",
                        }}
                      >
                        Placed On:{" "}
                        <span
                          style={{
                            color: "#fff",
                          }}
                        >
                          {order?.createdAt
                            ? new Date(order.createdAt).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </p>

                      <p
                        style={{
                          color: "#a9b9ae",
                          fontSize: "0.9rem",
                        }}
                      >
                        Total:{" "}
                        <strong
                          style={{
                            color: "#10b981",
                          }}
                        >
                          ₹{Number(order?.totalAmount || 0).toFixed(2)}
                        </strong>
                      </p>
                    </div>

                    {/* Status */}

                    <div>
                      <span
                        style={{
                          background: statusBackground,
                          color: statusColor,
                          padding: "8px 16px",
                          borderRadius: "20px",
                          fontWeight: "bold",
                          textTransform: "capitalize",
                        }}
                      >
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Profile;

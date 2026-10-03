import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import apiFetch from "../utils/api";

const AdminUsers = () => {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiFetch("/api/auth/admin");
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Users could not be loaded.");
        setUsers(data.users || []);
      } catch (fetchError) {
        setError(fetchError.message || "Users could not be loaded.");
      } finally {
        setLoading(false);
      }
    };
    if (user?.token) fetchUsers();
  }, [user?.token]);

  return (
    <div style={containerStyle}>
      <h2 style={{ color: "#48c9a1", marginBottom: "20px" }}>User Directory</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={rowStyle}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>NAME</th>
              <th style={thStyle}>EMAIL</th>
              <th style={thStyle}>ROLE</th>
              <th style={thStyle}>JOINED</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} style={rowStyle}>
                <td style={tdStyle}>{u._id?.substring(0, 8)}...</td>
                <td style={tdStyle}>{u.name}</td>
                <td style={tdStyle}>{u.email}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background:
                        u.role === "admin"
                          ? "rgba(20,121,91,0.2)"
                          : "rgba(16,185,129,0.2)",
                      color: u.role === "admin" ? "#48c9a1" : "#10b981",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                    }}
                  >
                    {(u.role || "user").toUpperCase()}
                  </span>
                </td>
                <td style={tdStyle}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td style={tdStyle} colSpan="5">
                  Loading users...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td style={tdStyle} colSpan="5" role="alert">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && users.length === 0 && (
              <tr>
                <td style={tdStyle} colSpan="5">
                  No users found.
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

export default AdminUsers;

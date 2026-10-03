import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/email.css";

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      alert("Email is missing. Please register again.");
      navigate("/register");
      return;
    }

    if (otp.length !== 6) {
      alert("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp,
        }),
      });

      const data = await res.json();

      console.log("OTP Response:", data);

      if (res.ok) {
        alert("Email verified successfully!");

        navigate("/login");
      } else {
        alert(data.message || "Invalid OTP.");
      }
    } catch (error) {
      console.error("OTP Verification Error:", error);

      alert("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form otp-form" onSubmit={handleSubmit}>
        <div className="otp-icon">✉️</div>

        <h2>Verify Your Email</h2>

        <p className="otp-description">We have sent a 6-digit OTP to</p>

        <p className="otp-email">{email || "your email address"}</p>

        <input
          id="verification-code"
          name="otp"
          type="text"
          inputMode="numeric"
          placeholder="Enter 6-digit OTP"
          value={otp}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 6);

            setOtp(value);
          }}
          maxLength={6}
          required
        />

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Verifying..." : "Verify Email"}
        </button>

        <p className="otp-help">
          Didn't receive the OTP? Check your spam folder.
        </p>

        <p>
          <Link to="/register">Back to Register</Link>
        </p>
      </form>
    </div>
  );
};

export default VerifyEmail;

import React, { useState, useContext, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { clearCart } from "../redux/cartSlice";
import apiFetch from "../utils/api";

const Checkout = () => {
  const { user } = useContext(AuthContext);
  const cartItems = useSelector((state) => state.cart.cartItems);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const idempotencyKey = useRef(null);
  const paymentInProgress = useRef(false);
  const [gatewayLoaded, setGatewayLoaded] = useState(
    () => Boolean(window.Razorpay),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.Razorpay) {
      setGatewayLoaded(true);
      return undefined;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setGatewayLoaded(true);
    script.onerror = () =>
      setError("Payment checkout could not be loaded. Refresh and try again.");
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  const [address, setAddress] = useState({
    fullName: "",
    street: "",
    city: "",
    postalCode: "",
    country: "",
  });

  const totalPrice = cartItems.reduce(
    (acc, item) => acc + item.price * item.qty,
    0,
  );

  const handlePayment = async () => {
    if (paymentInProgress.current) return;
    paymentInProgress.current = true;
    setError("");
    setLoading(true);

    try {
      if (!cartItems.length) {
        setError("Your cart is empty.");
        setLoading(false);
        paymentInProgress.current = false;
        return;
      }

      if (!gatewayLoaded || !window.Razorpay) {
        setError("Payment checkout is still loading. Please try again.");
        setLoading(false);
        paymentInProgress.current = false;
        return;
      }

      if (!idempotencyKey.current) {
        idempotencyKey.current =
          window.crypto?.randomUUID?.() ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }

      const orderRes = await apiFetch("/api/payment/order", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({ items: cartItems, address }),
      });
      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        idempotencyKey.current = null;
        setError(orderData.message || "Payment could not be initialized.");
        setLoading(false);
        paymentInProgress.current = false;
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "ShopNest",
        description: "ShopNest order",
        order_id: orderData.id,
        handler: async (response) => {
          try {
            const verifyRes = await apiFetch("/api/payment/verify", {
              method: "POST",
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              dispatch(clearCart());
              navigate("/ordersuccess", {
                state: {
                  duplicatePaymentRefund: verifyData.duplicatePaymentRefund,
                },
              });
            } else {
              setError(
                verifyData.message ||
                  "Payment was received but could not be verified. Contact support with your order reference.",
              );
            }
          } catch (verificationError) {
            console.error(verificationError);
            setError(
              "Payment was received but could not be verified. Contact support before trying again.",
            );
          } finally {
            setLoading(false);
            paymentInProgress.current = false;
          }
        },
        prefill: {
          name: address.fullName,
          email: user?.email,
        },
        theme: {
          color: "#48c9a1",
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            paymentInProgress.current = false;
          },
        },
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on("payment.failed", (response) => {
        idempotencyKey.current = null;
        setError(
          response.error?.description ||
            "Payment failed. Please try again with a new payment attempt.",
        );
        setLoading(false);
        paymentInProgress.current = false;
      });
      rzp1.open();
    } catch (error) {
      console.error(error);
      idempotencyKey.current = null;
      setError(error.message || "Payment could not be completed.");
      setLoading(false);
      paymentInProgress.current = false;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }
    void handlePayment();
  };

  return (
    <div className="checkout-container">
      <h2>Checkout</h2>
      <div className="checkout-content">
        <form onSubmit={handleSubmit} className="shipping-form">
          <h3>Shipping Address</h3>
          <input
            id="shipping-full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Full Name"
            required
            value={address.fullName}
            onChange={(e) =>
              setAddress({ ...address, fullName: e.target.value })
            }
          />
          <input
            id="shipping-street"
            name="street"
            type="text"
            autoComplete="street-address"
            placeholder="Street"
            required
            value={address.street}
            onChange={(e) => setAddress({ ...address, street: e.target.value })}
          />
          <input
            id="shipping-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            placeholder="City"
            required
            value={address.city}
            onChange={(e) => setAddress({ ...address, city: e.target.value })}
          />
          <input
            id="shipping-postal-code"
            name="postalCode"
            type="text"
            autoComplete="postal-code"
            placeholder="Postal Code"
            required
            value={address.postalCode}
            onChange={(e) =>
              setAddress({ ...address, postalCode: e.target.value })
            }
          />
          <input
            id="shipping-country"
            name="country"
            type="text"
            autoComplete="country-name"
            placeholder="Country"
            required
            value={address.country}
            onChange={(e) =>
              setAddress({ ...address, country: e.target.value })
            }
          />
          <div className="checkout-summary">
            <h4>Total to Pay: ₹{totalPrice.toFixed(2)}</h4>
            {error && <p role="alert">{error}</p>}
            <button
              type="submit"
              className="btn"
              disabled={loading || !gatewayLoaded || cartItems.length === 0}
            >
              {loading ? "Processing..." : "Pay Now"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;

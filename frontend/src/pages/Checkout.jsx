import React, { useState, useContext } from "react";
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
    try {
      if (!cartItems.length) {
        alert("Your cart is empty.");
        return;
      }

      const orderRes = await apiFetch("/api/payment/order", {
        method: "POST",
        body: JSON.stringify({ items: cartItems, address }),
      });
      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        alert(orderData.message || "Payment could not be initialized.");
        return;
      }
      if (!window.Razorpay) {
        alert("Payment checkout could not be loaded. Please try again.");
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
          const verifyRes = await apiFetch("/api/payment/verify", {
            method: "POST",
            body: JSON.stringify({ ...response, items: cartItems, address }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            dispatch(clearCart());
            navigate("/ordersuccess");
          } else {
            alert(verifyData.message || "Payment verification failed.");
          }
        },
        prefill: {
          name: address.fullName,
          email: user?.email,
          contact: "9999999999",
        },
        theme: {
          color: "#48c9a1",
        },
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.open();
    } catch (error) {
      console.error(error);
      alert(error.message || "Payment could not be completed.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!user) {
      alert("Please login first");
      navigate("/login");
      return;
    }
    handlePayment();
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
            <button type="submit" className="btn">
              Pay Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;

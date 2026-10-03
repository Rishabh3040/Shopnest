import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  cartItems: localStorage.getItem("cartItems")
    ? JSON.parse(localStorage.getItem("cartItems"))
    : [],
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const item = action.payload;
      const existItem = state.cartItems.find(
        (x) => x.productId === item.productId,
      );
      if (existItem) {
        existItem.stock = item.stock || existItem.stock;
        existItem.name = item.name;
        existItem.price = item.price;
        existItem.imageUrl = item.imageUrl;
        existItem.qty = Math.min(
          (existItem.qty || 0) + (item.qty || 1),
          item.stock || Infinity,
        );
      } else {
        state.cartItems.push(item);
      }
      localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
    },
    setCartItemQuantity: (state, action) => {
      const { productId, qty } = action.payload;
      const item = state.cartItems.find(
        (cartItem) => cartItem.productId === productId,
      );
      if (!item) return;
      if (qty <= 0) {
        state.cartItems = state.cartItems.filter(
          (cartItem) => cartItem.productId !== productId,
        );
      } else {
        item.qty = Math.min(qty, item.stock || Infinity);
      }
      localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
    },
    removeFromCart: (state, action) => {
      state.cartItems = state.cartItems.filter(
        (x) => x.productId !== action.payload,
      );
      localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
    },
    clearCart: (state) => {
      state.cartItems = [];
      localStorage.removeItem("cartItems");
    },
  },
});

export const { addToCart, setCartItemQuantity, removeFromCart, clearCart } =
  cartSlice.actions;
export default cartSlice.reducer;

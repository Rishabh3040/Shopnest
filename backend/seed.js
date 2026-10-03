import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "./src/models/user.model.js";
import Product from "./src/models/product.model.js";
import Order from "./src/models/order.model.js";
dotenv.config();

// ===============================
// Dummy Users
// ===============================

const users = [
  {
    username: "admin",
    name: "Admin User",
    email: "admin@shopnest.com",
    password: "Admin@123",
    role: "admin",
  },
  {
    username: "rahul",
    name: "Rahul Sharma",
    email: "rahul@gmail.com",
    password: "User@123",
    role: "user",
  },
  {
    username: "priya",
    name: "Priya Singh",
    email: "priya@gmail.com",
    password: "User@123",
    role: "user",
  },
  {
    username: "aman",
    name: "Aman Verma",
    email: "aman@gmail.com",
    password: "User@123",
    role: "user",
  },
];

// ===============================
// Dummy Products
// ===============================

const products = [
  {
    name: "Wireless Headphones",
    description: "High quality wireless headphones with noise cancellation.",
    price: 2499,
    stock: 50,
    category: "Electronics",
  },
  {
    name: "Mechanical Keyboard",
    description: "RGB mechanical keyboard for gaming and programming.",
    price: 3499,
    stock: 35,
    category: "Electronics",
  },
  {
    name: "Smart Watch",
    description: "Smart watch with fitness tracking and heart rate monitoring.",
    price: 2999,
    stock: 40,
    category: "Wearables",
  },
  {
    name: "Laptop Backpack",
    description:
      "Water resistant backpack suitable for laptops up to 15.6 inches.",
    price: 1299,
    stock: 60,
    category: "Accessories",
  },
  {
    name: "Running Shoes",
    description: "Lightweight running shoes suitable for daily workouts.",
    price: 1999,
    stock: 45,
    category: "Footwear",
  },
  {
    name: "USB-C Hub",
    description: "Multi-port USB-C hub with HDMI and USB 3.0 support.",
    price: 999,
    stock: 75,
    category: "Electronics",
  },
];

// ===============================
// Seed Function
// ===============================

const seedDatabase = async () => {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Seeding is disabled in production.");
    }
    if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
      throw new Error(
        "Set ALLOW_DESTRUCTIVE_SEED=true to confirm deleting existing seed data.",
      );
    }

    // Connect MongoDB
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    console.log("Old data deleted");

    // ===============================
    // Create Users
    // ===============================

    const hashedUsers = await Promise.all(
      users.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10),
      })),
    );

    const createdUsers = await User.insertMany(hashedUsers);

    console.log(`${createdUsers.length} users created`);

    // Get normal users
    const normalUsers = createdUsers.filter((user) => user.role === "user");

    // ===============================
    // Create Products
    // ===============================

    const createdProducts = await Product.insertMany(products);

    console.log(`${createdProducts.length} products created`);

    // ===============================
    // Create Orders
    // ===============================

    const orders = [
      {
        user: normalUsers[0]._id,

        items: [
          {
            productId: createdProducts[0]._id,
            qty: 2,
            price: createdProducts[0].price,
          },
          {
            productId: createdProducts[3]._id,
            qty: 1,
            price: createdProducts[3].price,
          },
        ],

        totalAmount: createdProducts[0].price * 2 + createdProducts[3].price,

        address: {
          fullName: "Rahul Sharma",
          street: "MG Road",
          city: "Delhi",
          postalCode: "110001",
          country: "India",
        },

        paymentId: "PAY_10001",

        status: "pending",
      },

      {
        user: normalUsers[1]._id,

        items: [
          {
            productId: createdProducts[1]._id,
            qty: 1,
            price: createdProducts[1].price,
          },
          {
            productId: createdProducts[5]._id,
            qty: 2,
            price: createdProducts[5].price,
          },
        ],

        totalAmount: createdProducts[1].price + createdProducts[5].price * 2,

        address: {
          fullName: "Priya Singh",
          street: "Sector 62",
          city: "Noida",
          postalCode: "201301",
          country: "India",
        },

        paymentId: "PAY_10002",

        status: "shipped",
      },

      {
        user: normalUsers[2]._id,

        items: [
          {
            productId: createdProducts[2]._id,
            qty: 1,
            price: createdProducts[2].price,
          },
          {
            productId: createdProducts[4]._id,
            qty: 1,
            price: createdProducts[4].price,
          },
        ],

        totalAmount: createdProducts[2].price + createdProducts[4].price,

        address: {
          fullName: "Aman Verma",
          street: "Vaishali",
          city: "Ghaziabad",
          postalCode: "201010",
          country: "India",
        },

        paymentId: "PAY_10003",

        status: "pending",
      },

      {
        user: normalUsers[0]._id,

        items: [
          {
            productId: createdProducts[2]._id,
            qty: 2,
            price: createdProducts[2].price,
          },
        ],

        totalAmount: createdProducts[2].price * 2,

        address: {
          fullName: "Rahul Sharma",
          street: "MG Road",
          city: "Delhi",
          postalCode: "110001",
          country: "India",
        },

        paymentId: "PAY_10004",

        status: "pending",
      },

      {
        user: normalUsers[1]._id,

        items: [
          {
            productId: createdProducts[0]._id,
            qty: 1,
            price: createdProducts[0].price,
          },
          {
            productId: createdProducts[5]._id,
            qty: 1,
            price: createdProducts[5].price,
          },
        ],

        totalAmount: createdProducts[0].price + createdProducts[5].price,

        address: {
          fullName: "Priya Singh",
          street: "Sector 62",
          city: "Noida",
          postalCode: "201301",
          country: "India",
        },

        paymentId: "PAY_10005",

        status: "shipped",
      },
    ];

    const createdOrders = await Order.insertMany(orders);

    console.log(`${createdOrders.length} orders created`);

    // ===============================
    // Summary
    // ===============================

    console.log("\n==============================");
    console.log("Database seeded successfully!");
    console.log("==============================");

    console.log(`Users: ${createdUsers.length}`);
    console.log(`Products: ${createdProducts.length}`);
    console.log(`Orders: ${createdOrders.length}`);

    console.log("\nAdmin Login:");
    console.log("Email: admin@shopnest.com");
    console.log("Password: Admin@123");

    console.log("\nUser Login:");
    console.log("Email: rahul@gmail.com");
    console.log("Password: User@123");

    // Close connection
    await mongoose.connection.close();

    console.log("\nMongoDB connection closed");

    process.exit(0);
  } catch (error) {
    console.error("Seed Error:", error);

    await mongoose.connection.close();

    process.exit(1);
  }
};

seedDatabase();

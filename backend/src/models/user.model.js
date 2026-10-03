import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    profileImage: { type: String, default: "" },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const userModel = mongoose.model("User", userSchema);
export default userModel;

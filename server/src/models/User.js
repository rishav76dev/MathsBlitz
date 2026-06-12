const { Schema, model } = require("mongoose");

const UserSchema = new Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: false, // Set by user after first login
      unique: true,
      sparse: true,    // Allows multiple null values with the unique index
      trim: true,
      minlength: 3,
      maxlength: 32,
    },
    wins: {
      type: Number,
      default: 0,
      min: 0,
    },
    losses: {
      type: Number,
      default: 0,
      min: 0,
    },
    matchesPlayed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const User = model("User", UserSchema);

module.exports = { User };

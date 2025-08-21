// backend/models/Entry.js
const mongoose = require("mongoose");

const EntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    media: [
      {
        url: { type: String, required: true }, // file path
        type: { type: String, enum: ["image", "video"], required: true }, // distinguish media type
      },
    ],
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    archived: { type: Boolean, default: false }, // for trash/archive functionality
  },
  { timestamps: true }
);

module.exports = mongoose.model("Entry", EntrySchema);

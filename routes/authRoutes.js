const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// ---------------- Multer for profile pic ---------------- //
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/profile");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ---------------- Helper to create token ---------------- //
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// ---------------- Routes ---------------- //

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (await User.findOne({ email })) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const user = await User.create({ name, email, password });

    const token = generateToken(user._id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none", // ✅ allow Netlify <-> Render
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic || "",
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ msg: "Invalid credentials" });

    const token = generateToken(user._id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none", // ✅ allow cross-site
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic || "",
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Get current user
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/me", authMiddleware, (req, res) => {
  res.json(req.user);
});

// Update profile
router.put("/me", authMiddleware, upload.single("profilePic"), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ msg: "User not found" });

    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = password; // pre-save hook will hash
    if (req.file) {
      user.profilePic = `/uploads/profile/${req.file.filename}`;
    }

    await user.save();
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic || "",
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ msg: "Logged out" });
});

module.exports = router;

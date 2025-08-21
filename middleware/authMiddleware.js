// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User.js"); // make sure path is correct

exports.authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: "No token, not authenticated" });
    }

    // verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Token invalid or expired" });
    }

    // find user without password
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user; // attach user (profilePic will also be available if in schema)
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    res.status(500).json({ message: "Server error in auth middleware" });
  }
};

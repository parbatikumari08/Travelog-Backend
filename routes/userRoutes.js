// backend/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/authMiddleware.js");
const { upload } = require("../middleware/upload.js"); // ✅ central upload

// ---------------- Routes ---------------- //

// Get current profile
router.get("/me", authMiddleware, async (req, res) => {
  res.json(req.user);
});

// Upload/change avatar
router.post(
  "/avatar",
  authMiddleware,
  upload.single("avatar"), // ✅ use shared upload
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Save file path to user
      req.user.profilePic = `/uploads/${req.file.filename}`;
      await req.user.save();

      res.json({
        message: "Avatar uploaded",
        profilePic: req.user.profilePic,
      });
    } catch (err) {
      console.error("Avatar upload error:", err.message);
      res.status(500).json({ message: "Server error while uploading avatar" });
    }
  }
);

module.exports = router;

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/authMiddleware.js");
const { upload } = require("../middleware/upload.js"); // ✅ central upload (Cloudinary)

// ---------------- Routes ---------------- //

// Get current profile
router.get("/me", authMiddleware, async (req, res) => {
  res.json(req.user);
});

// Upload/change avatar
router.post(
  "/avatar",
  authMiddleware,
  upload.single("avatar"), // ✅ Cloudinary upload
  async (req, res) => {
    try {
      if (!req.file || !req.file.path) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // ✅ Save Cloudinary URL to user
      req.user.profilePic = req.file.path;
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

// backend/routes/entryRoutes.js
const express = require("express");
const router = express.Router();
const Entry = require("../models/Entry");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authMiddleware } = require("../middleware/authMiddleware");

// ---------------- Multer Storage ---------------- //
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Detect file type for media previews
const getFileType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if ([".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv"].includes(ext)) return "video";
  return "image";
};

// ---------------- ROUTES ---------------- //
// Create entry
router.post("/", authMiddleware, upload.array("files"), async (req, res) => {
  try {
    const { title, description, location } = req.body;

    const files = (req.files || []).map((f) => ({
      url: `/uploads/${f.filename}`,
      type: getFileType(f.originalname),
    }));

    const entry = new Entry({
      title,
      description,
      user: req.user._id,
      media: files,
      // ✅ Save location if sent
      location: location ? JSON.parse(location) : undefined,
    });

    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// DELETE media from an entry
router.delete("/:entryId/media/:mediaId", authMiddleware, async (req, res) => {
  try {
    const { entryId, mediaId } = req.params;

    const entry = await Entry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    // remove media by _id
    entry.media = entry.media.filter(m => m._id.toString() !== mediaId);

    await entry.save();

    res.json({ message: "Media deleted successfully", entry });
  } catch (err) {
    console.error("Error deleting media:", err);
    res.status(500).json({ message: "Server error while deleting media" });
  }
});


// Update entry
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { title, description, location } = req.body;
    const entry = await Entry.findOne({ _id: req.params.id, user: req.user._id });
    if (!entry) return res.status(404).json({ msg: "Entry not found" });

    if (title != null) entry.title = title;
    if (description != null) entry.description = description;
    if (location) {
      try {
        entry.location = JSON.parse(location);
      } catch {
        entry.location = location; // fallback
      }
    }

    await entry.save();
    res.json(entry);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Archive entry
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const entry = await Entry.findOne({ _id: req.params.id, user: req.user._id });
    if (!entry) return res.status(404).json({ msg: "Entry not found" });

    entry.archived = true;
    await entry.save();
    res.json({ msg: "Entry archived" });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ----------- FIXED GET ROUTES ----------- //

// Get entries for logged-in user
router.get("/user", authMiddleware, async (req, res) => {
  try {
    const entries = await Entry.find({ user: req.user._id, archived: false }).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ✅ Also support /entries/user/:id
router.get("/user/:id", authMiddleware, async (req, res) => {
  try {
    const entries = await Entry.find({ user: req.params.id, archived: false }).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Get archived entries
router.get("/archive", authMiddleware, async (req, res) => {
  try {
    const entries = await Entry.find({ user: req.user._id, archived: true }).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Restore from archive
router.put("/archive/:id/restore", authMiddleware, async (req, res) => {
  try {
    const entry = await Entry.findOne({ _id: req.params.id, user: req.user._id });
    if (!entry) return res.status(404).json({ msg: "Entry not found" });

    entry.archived = false;
    await entry.save();
    res.json({ msg: "Restored" });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Upload additional media for an entry
router.post("/:id/media", upload.array("media"), async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    const newMedia = req.files.map(file => ({
      url: `/uploads/${file.filename}`, // adjust if using Cloudinary/S3
      type: file.mimetype.startsWith("video") ? "video" : "image",
    }));

    entry.media.push(...newMedia);
    await entry.save();

    res.json(newMedia); // ✅ return only the new media
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// Delete permanently
router.delete("/archive/:id", authMiddleware, async (req, res) => {
  try {
    const entry = await Entry.findOne({ _id: req.params.id, user: req.user._id, archived: true });
    if (!entry) return res.status(404).json({ msg: "Entry not found" });

    await entry.deleteOne();
    res.json({ msg: "Entry permanently deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;

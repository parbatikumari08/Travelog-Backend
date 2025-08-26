const express = require("express");
const router = express.Router();
const Entry = require("../models/Entry");
const path = require("path");
const fs = require("fs");
const { authMiddleware } = require("../middleware/authMiddleware");

let upload;
let usingCloudinary = false;
let cloudinary;
try {
  const upl = require("../middleware/upload.js");
  upload = upl.upload;
  if (upl.varOcg && upl.varOcg.toLowerCase().includes("cloud")) {
    usingCloudinary = true;
    try {
      cloudinary = require("cloudinary").v2;
    } catch (e) {
      cloudinary = null;
    }
  }
} catch (e) {
  const multer = require("multer");
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, "../uploads");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });
  upload = multer({ storage });
  usingCloudinary = false;
}

const getFileTypeFromName = (filename, mimetype) => {
  if (mimetype && mimetype.startsWith("video")) return "video";
  const ext = (filename || "").split(".").pop().toLowerCase();
  if (["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext)) return "video";
  return "image";
};

const getFileUrl = (file) => {
  if (!file) return "";
  if (file.path && typeof file.path === "string") return file.path;
  if (file.secure_url) return file.secure_url;
  if (file.url) return file.url;
  if (file.location) return file.location;
  if (file.filename) return `/uploads/${file.filename}`;
  return "";
};

const tryDeleteLocalFile = (url) => {
  try {
    if (!url) return;
    const normalized = url.startsWith("/") ? url.slice(1) : url;
    if (!normalized.startsWith("uploads")) return;
    const abs = path.join(__dirname, "..", normalized);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    console.error("Failed to delete local file:", e.message);
  }
};

const tryDeleteCloudinary = async (url) => {
  if (!cloudinary) return;
  if (!url) return;
  try {
    const m = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^/.]+$/);
    if (!m || !m[1]) return;
    const publicId = m[1];
    await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
  } catch (e) {
    console.error("Cloudinary delete failed:", e.message);
  }
};

// Create entry
router.post("/", authMiddleware, upload.any(), async (req, res) => {
  try {
    const { title, description, location, lat, lng } = req.body;

    const files = (req.files || []).map((f) => ({
      url: getFileUrl(f),
      type: getFileTypeFromName(f.originalname, f.mimetype),
    }));

    let loc;
    if (location) {
      try {
        loc = JSON.parse(location);
      } catch {
        loc = location;
      }
    } else if (lat && lng) {
      loc = { lat: Number(lat), lng: Number(lng) };
    }

    const entry = new Entry({
      title,
      description,
      user: req.user._id,
      media: files,
      location: loc,
    });

    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    console.error("Create entry error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Remove media by url (backwards compatible)
router.delete("/:id/media", authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ msg: "url required" });

    const entry = await Entry.findOne({ _id: req.params.id, user: req.user._id });
    if (!entry) return res.status(404).json({ msg: "Entry not found" });

    const before = entry.media.length;
    entry.media = entry.media.filter((m) => m.url !== url);

    if (before !== entry.media.length) {
      if (url.includes("/uploads/")) tryDeleteLocalFile(url);
      else if (usingCloudinary) await tryDeleteCloudinary(url);
    }

    await entry.save();
    res.json({ msg: before !== entry.media.length ? "Removed" : "Not found", media: entry.media });
  } catch (err) {
    console.error("Delete media by url error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Delete media by mediaId (newer frontend uses this)
router.delete("/:entryId/media/:mediaId", authMiddleware, async (req, res) => {
  try {
    const { entryId, mediaId } = req.params;

    const entry = await Entry.findOne({ _id: entryId, user: req.user._id });
    if (!entry) return res.status(404).json({ msg: "Entry not found" });

    const m = entry.media.find((x) => x._id.toString() === mediaId);
    if (!m) return res.status(404).json({ msg: "Media not found" });

    entry.media = entry.media.filter((x) => x._id.toString() !== mediaId);

    if (m.url && m.url.includes("/uploads/")) tryDeleteLocalFile(m.url);
    else if (m.url && usingCloudinary) await tryDeleteCloudinary(m.url);

    await entry.save();
    res.json({ message: "Media deleted successfully", entry });
  } catch (err) {
    console.error("Delete media by id error:", err);
    res.status(500).json({ message: "Server error while deleting media" });
  }
});

// Update entry (title/description/location)
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
        entry.location = location;
      }
    }

    await entry.save();
    res.json(entry);
  } catch (err) {
    console.error("Update entry error:", err);
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
    console.error("Archive entry error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Get entries for logged-in user
router.get("/user", authMiddleware, async (req, res) => {
  try {
    const entries = await Entry.find({ user: req.user._id, archived: false }).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    console.error("Get user entries error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Also support /entries/user/:id
router.get("/user/:id", authMiddleware, async (req, res) => {
  try {
    const entries = await Entry.find({ user: req.params.id, archived: false }).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    console.error("Get entries by user id error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Get archived entries
router.get("/archive", authMiddleware, async (req, res) => {
  try {
    const entries = await Entry.find({ user: req.user._id, archived: true }).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    console.error("Get archived error:", err);
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
    console.error("Restore error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Upload additional media for an entry (accepts any file field names)
router.post("/:id/media", authMiddleware, upload.any(), async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    const files = req.files || [];
    const newMedia = files.map((file) => ({
      url: getFileUrl(file),
      type: getFileTypeFromName(file.originalname, file.mimetype),
    }));

    entry.media.push(...newMedia);
    await entry.save();

    res.json(newMedia);
  } catch (err) {
    console.error("Upload additional media error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// Backwards-compatible upload endpoint (some clients call /:id/upload)
router.post("/:id/upload", authMiddleware, upload.any(), async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    const files = req.files || [];
    const newMedia = files.map((file) => ({
      url: getFileUrl(file),
      type: getFileTypeFromName(file.originalname, file.mimetype),
    }));

    entry.media.push(...newMedia);
    await entry.save();

    res.json({ msg: "Media uploaded", media: entry.media });
  } catch (err) {
    console.error("Upload (legacy) error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// Delete permanently
router.delete("/archive/:id", authMiddleware, async (req, res) => {
  try {
    const entry = await Entry.findOne({ _id: req.params.id, user: req.user._id, archived: true });
    if (!entry) return res.status(404).json({ msg: "Entry not found" });

    // attempt to remove local/cloud files (best-effort)
    for (const m of entry.media || []) {
      if (m.url && m.url.includes("/uploads/")) tryDeleteLocalFile(m.url);
      else if (m.url && usingCloudinary) await tryDeleteCloudinary(m.url);
    }

    await entry.deleteOne();
    res.json({ msg: "Entry permanently deleted" });
  } catch (err) {
    console.error("Delete permanently error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;

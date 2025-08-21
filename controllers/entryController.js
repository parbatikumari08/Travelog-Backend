// controllers/entryController.js
import Entry from "../models/Entry.js";

// Create entry
export const createEntry = async (req, res) => {
  try {
    const { title, description, location } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required" });
    }

    const entry = await Entry.create({
      userId: req.user.id,
      title,
      description,
      location: location || "",
      media: [],
    });

    res.status(201).json(entry);
  } catch (err) {
    console.error("Error creating entry:", err.message);
    res.status(500).json({ message: "Server error while creating entry" });
  }
};

// Upload media
export const uploadMedia = async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = `/uploads/${req.file.filename}`;
    entry.media.push(filePath);
    await entry.save();

    res.json(entry);
  } catch (err) {
    console.error("Error uploading media:", err.message);
    res.status(500).json({ message: "Server error while uploading media" });
  }
};

// Get user entries
export const getUserEntries = async (req, res) => {
  try {
    const entries = await Entry.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    console.error("Error fetching entries:", err.message);
    res.status(500).json({ message: "Server error while fetching entries" });
  }
};

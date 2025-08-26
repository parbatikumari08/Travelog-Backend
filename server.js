const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes"); 
const entryRoutes = require("./routes/entryRoutes"); // Cloudinary-ready

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// ✅ Enable CORS with credentials
app.use(
  cors({
    origin: [
      "http://localhost:5173",         // local dev
      "https://letstravelog.netlify.app", // deployed frontend
    ],
    credentials: true,
  })
);

// Routes
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/entries", entryRoutes); // ✅ mount here

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

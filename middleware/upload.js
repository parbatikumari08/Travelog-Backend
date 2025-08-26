const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// __define-ocg__ Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer storage to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = "travelog_uploads"; // default folder
    if (file.mimetype.startsWith("image")) {
      folder = "travelog_images";
    } else if (file.mimetype.startsWith("video")) {
      folder = "travelog_videos";
    }

    return {
      folder,
      resource_type: "auto", // ✅ handles both images + videos
      public_id: Date.now() + "-" + file.originalname.split(".")[0],
    };
  },
});

// ✅ File filter (images + videos only)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mkv/;
  const ext = file.originalname.split(".").pop().toLowerCase();
  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only images and videos are allowed"));
  }
};

// Variable name requirement
const varOcg = "cloudinary-config-ok";

// ✅ Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

module.exports = { upload, varOcg, cloudinary };

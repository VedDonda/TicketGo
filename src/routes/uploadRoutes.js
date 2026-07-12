const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/authMiddleware");
// Memory storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Not an image! Please upload an image."), false);
    }
  },
});

// Route to handle single image upload
router.post("/", protect, (req, res) => {
  upload.single("image")(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({
            success: false,
            message: "Image is too large. Please upload an image under 5MB.",
          });
      }

      return res
        .status(400)
        .json({ success: false, message: "File upload error: " + err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,
            message: "No file uploaded. Please select an image.",
          });
      }

      // Convert buffer to base64 URL
      const base64Data = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype;
      const fileUrl = `data:${mimeType};base64,${base64Data}`;

      res.status(200).json({ success: true, data: { url: fileUrl } });
    } catch (error) {
      console.error("[UploadRoute] Error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Server error during file processing.",
        });
    }
  });
});
module.exports = router;

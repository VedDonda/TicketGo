// Main Express application setup
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const authRoutes = require("./src/routes/authRoutes");
const eventRoutes = require("./src/routes/eventRoutes");
const userRoutes = require("./src/routes/userRoutes");
const uploadRoutes = require("./src/routes/uploadRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: false }));
const CLIENT_DIST = path.join(__dirname, "public");

app.use(express.static(CLIENT_DIST));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ success: false, message: "Route not found" });
  }

  res.sendFile(path.join(CLIENT_DIST, "index.html"));
});
module.exports = app;

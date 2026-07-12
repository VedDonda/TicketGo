// Event routes for management and booking
const express = require("express");
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventById,
  deleteEvent,
  getEventImage,
  updateEventImage,
  getMyEvents,
  publishEvent,
  getDashboardMetrics,
} = require("../controllers/eventController");
const {
  getSeats,
  getZones,
  holdSeats,
  releaseHold,
  confirmPurchase,
  getMyTickets,
} = require("../controllers/bookingController");
const {
  protect,
  authorize,
  optionalAuth,
} = require("../middleware/authMiddleware");

router.get("/", getEvents);
router.get(
  "/organizer/me",
  protect,
  authorize("ORGANIZER", "ADMIN"),
  getMyEvents,
);
router.get("/:id", optionalAuth, getEventById);
router.get("/:id/image", getEventImage);
router.post("/", protect, authorize("ORGANIZER", "ADMIN"), createEvent);
router.delete("/:id", protect, authorize("ADMIN"), deleteEvent);
router.put(
  "/:id/image",
  protect,
  authorize("ORGANIZER", "ADMIN"),
  updateEventImage,
);
router.put(
  "/:id/publish",
  protect,
  authorize("ORGANIZER", "ADMIN"),
  publishEvent,
);
router.get(
  "/:id/dashboard-metrics",
  protect,
  authorize("ORGANIZER", "ADMIN"),
  getDashboardMetrics,
);
router.get("/:id/seats", protect, getSeats);
router.get("/:id/zones", protect, getZones);
router.post("/:id/hold", protect, holdSeats);
router.post("/:id/release", protect, releaseHold);
router.post("/:id/confirm", protect, confirmPurchase);
router.get("/:id/my-tickets", protect, getMyTickets);
module.exports = router;

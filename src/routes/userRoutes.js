const express = require('express');
const router  = express.Router();
const { getMyBookings, getProfile, updateProfile, changePassword } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// All user routes require authentication
router.use(protect);

router.get('/me/profile',          getProfile);
router.put('/me/profile',          updateProfile);
router.put('/me/password',         changePassword);
router.get('/me/bookings',         getMyBookings);

module.exports = router;

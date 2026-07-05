const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getPendingOrganizers, approveOrganizer, rejectOrganizer } = require('../controllers/adminController');

router.use(protect, authorize('ADMIN'));

router.get('/organizers/pending', getPendingOrganizers);
router.put('/organizers/:id/approve', approveOrganizer);
router.delete('/organizers/:id/reject', rejectOrganizer);

module.exports = router;

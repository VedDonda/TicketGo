const User = require("../models/User");

const getPendingOrganizers = async (req, res) => {
  try {
    // Fetch unverified organizers and exclude their passwords
    const organizers = await User.find({ role: "ORGANIZER", isVerified: false })
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: organizers });
  } catch (error) {
    console.error("[AdminController] getPendingOrganizers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const approveOrganizer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Verify and save the organizer user
    user.isVerified = true;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Organizer approved successfully" });
  } catch (error) {
    console.error("[AdminController] approveOrganizer error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const rejectOrganizer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    await User.findByIdAndDelete(req.params.id);

    res
      .status(200)
      .json({ success: true, message: "Organizer rejected and deleted" });
  } catch (error) {
    console.error("[AdminController] rejectOrganizer error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getPendingOrganizers, approveOrganizer, rejectOrganizer };

// routes/contractor.js
const express = require("express");
const router = express.Router();
const { isContractor } = require("../middlewares/authMiddleware");

// Route hiển thị trang contractor_zone
router.get("/auth/contractor_zone", isContractor, (req, res) => {
  res.render("contractor_zone", { user: req.session.user });
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { isHSEStaff } = require("../middlewares/authMiddleware");

router.get("/auth/hse_staff_zone", isHSEStaff, (req, res) => {
  res.render("hse_staff_zone", { user: req.session.user });
});

module.exports = router;

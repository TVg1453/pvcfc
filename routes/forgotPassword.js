// routes/forgotPassword.js
const express = require("express");
const router = express.Router();
const forgotCtrl = require("../controllers/forgotPasswordController");

router.get("/", forgotCtrl.getForgotPassword);
router.post("/send-otp", forgotCtrl.sendOTP);
router.post("/verify-otp", forgotCtrl.verifyOTP);
router.post("/reset-password", forgotCtrl.resetPassword);

module.exports = router;

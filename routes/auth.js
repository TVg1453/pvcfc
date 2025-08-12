// routes/auth.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.get("/login", authController.renderLogin);
router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/verify", authController.verify);
router.get("/resend-verification", authController.renderResendPage);
router.post("/resend-verification", authController.resendVerification);
router.get("/after_login", authController.afterLogin);
router.get("/logout", authController.logout);

module.exports = router;

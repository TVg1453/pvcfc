// routes/info.js
const express = require("express");
const router = express.Router();
const infoController = require("../controllers/infoController");
const { isLoggedIn } = require("../middlewares/authMiddleware");
const multer = require("multer");
const upload = multer({ dest: "uploads/temp" });

router.get("/", isLoggedIn, infoController.getInformation);
router.post(
  "/",
  isLoggedIn,
  upload.single("avatar"),
  infoController.updateInformation
);

module.exports = router;

// routes/import.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { isAdmin } = require("../middlewares/authMiddleware");
const importController = require("../controllers/importController");

const upload = multer({ dest: "uploads/temp" });

router.post(
  "/",
  isAdmin,
  upload.single("excelFile"),
  importController.importExcel
);

module.exports = router;

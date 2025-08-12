// routes/revenues.js
const express = require("express");
const router = express.Router();
const revenueController = require("../controllers/revenueController");
const { isAdmin } = require("../middlewares/authMiddleware");

router.post("/save-day", isAdmin, revenueController.saveRevenueDay);
router.post("/save-product", isAdmin, revenueController.saveRevenueProduct);
router.post("/save-customer", isAdmin, revenueController.saveRevenueCustomer);

router.post("/delete-day", isAdmin, revenueController.deleteRevenueDay);
router.post("/delete-product", isAdmin, revenueController.deleteRevenueProduct);
router.post(
  "/delete-customer",
  isAdmin,
  revenueController.deleteRevenueCustomer
);

module.exports = router;

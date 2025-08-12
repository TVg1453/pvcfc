// routes/dashboard.js
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

router.get("/", dashboardController.renderDashboard);
router.get("/order/:id", dashboardController.viewOrderDetail);

module.exports = router;

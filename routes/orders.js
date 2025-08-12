// routes/orders.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { isAdmin } = require("../middlewares/authMiddleware");

router.post("/save", isAdmin, orderController.saveOrder);
router.post("/delete", isAdmin, orderController.deleteOrder);

module.exports = router;

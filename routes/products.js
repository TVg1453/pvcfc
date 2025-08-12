// routes/products.js
const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { isAdmin } = require("../middlewares/authMiddleware");

router.post("/save", isAdmin, productController.saveProduct);
router.post("/delete", isAdmin, productController.deleteProduct);

module.exports = router;

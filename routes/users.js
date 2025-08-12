// routes/users.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { isAdmin } = require("../middlewares/authMiddleware");

router.post("/save", isAdmin, userController.saveUser);
router.post("/delete", isAdmin, userController.deleteUser);

module.exports = router;

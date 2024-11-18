const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { check, validationResult } = require("express-validator");

router.get("/login", authController.getLoginPage);
router.get("/logout", authController.logout);
router.post(
  "/send-login",
  [
    check("login").notEmpty().withMessage("Login is required"),
    check("password").notEmpty().withMessage("Password is required"),
  ],
  authController.compareLogin
);

module.exports = router;

const express = require("express");
const router = express.Router();
const appealController = require("../controllers/appealController");
const { check } = require("express-validator");

router.get("/get-appeals", appealController.getAppeal);
// router.get("/show-product/:id", productController.showProduct);
// router.get("/edit-product/:id", productController.editProduct);
// router.post("/update-product/:id", productController.updateProduct);
// router.get("/destroy-product/:id", productController.destroyProduct);

module.exports = router;

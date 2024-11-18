const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { check } = require("express-validator");
const multer = require("multer");
const upload = require("../uploadConfig");
// const upload = multer({ dest: "uploads/" });

router.get("/get-products", productController.getProducts);
router.get("/add-product", productController.addProducts);
router.post(
  "/save-product",
  upload.array("images", 10),
  productController.saveProduct
);

router.get("/show-product/:id", productController.showProduct);
router.get("/edit-product/:id", productController.editProduct);
router.post(
  "/update-product/:id",
  upload.array("new_image", 10),
  productController.updateProduct
);
router.get("/destroy-product/:id", productController.destroyProduct);
const { connectToDatabase } = require("../config/config");

const executeQuery = (connectToDatabase, sqlQuery, params) => {
  return new Promise((resolve, reject) => {
    connectToDatabase((err, db) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return reject(err);
      }

      db.query(sqlQuery, params, (error, result) => {
        db.detach(); // Detach from the database after query execution

        if (error) {
          console.error("Query execution failed:", error);
          return reject(error);
        }

        // Check if the query was an insert operation, and get the count of rows affected.
        const affectedRows = result; // Change this based on Firebird's behavior
        // console.log("Query result:", result); // Log the result for debugging
        resolve({ affectedRows });
      });
    });
  });
};
router.post("/prod", async (req, res) => {
  const { category, brand, type, page = 1, limit = 100 } = req.body;
  // console.log("Request body:", req.body);

  // Calculate the start and end rows for pagination
  const startRow = (page - 1) * limit + 1; // ROWS is 1-based index
  const endRow = startRow + limit - 1;

  let sqlQuery = `
      SELECT pn.*, 
             pb.NAME AS BRAND_NAME,
             pt.NAME AS TYPE_NAME,
             pc.NAME AS CATEGORY_NAME
      FROM PRODUCT_NAMES pn
      JOIN PRODUCT_BRANDS_TYPES pbt ON pn.PRODUCT_BRAND_TYPE_ID = pbt.ID
      JOIN PRODUCT_BRANDS pb ON pbt.PRODUCT_BRAND_ID = pb.ID
      JOIN PRODUCT_TYPE pt ON pbt.PRODUCT_TYPE_ID = pt.ID
      JOIN PRODUCT_CATEGORIES pc ON pt.PRODUCT_CATEGORY_ID = pc.ID
      WHERE pn.ARCHIVE IS FALSE
    `;

  const params = [];

  // Add filters based on request parameters
  if (category) {
    sqlQuery += " AND pc.ID = ?";
    params.push(category);
  }
  if (brand) {
    sqlQuery += " AND pb.ID = ?";
    params.push(brand);
  }
  if (type) {
    sqlQuery += " AND pt.ID = ?";
    params.push(type);
  }

  // Add ORDER BY clause and pagination using ROWS ? TO ?
  sqlQuery += ` ORDER BY pn.CREATED_AT DESC ROWS ? TO ?`;
  params.push(startRow, endRow);

  try {
    const products = await executeQuery(connectToDatabase, sqlQuery, params);
    res.json(products.affectedRows); // Return the fetched products
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;

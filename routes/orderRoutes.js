const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

router.get("/orders", orderController.getOrders);
router.get("/add-order", orderController.addOrder);
router.post("/save-order", orderController.saveOrder);
router.post("/save-updated-order/:id", orderController.saveUpdatedOrder);
router.post("/deadline-order/:id", orderController.deadlineOrder);
router.post("/order-fetch", orderController.filterOrder);
// router.get("/show-type/:id", typeController.showType);
router.get("/edit-order/:id", orderController.editOrder);
router.get("/re-edit-order/:id", orderController.reEditOrder);

router.post("/update-order-item/:id", orderController.updateOrderItem);
router.post("/destroy-order_item/:id", orderController.destroyOrderItem);
router.get("/download-orders", orderController.downloadAsExcel);

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
router.post("/add", async (req, res) => {
  const { productCategoryId } = req.body;

  // Query to get types based on productCategoryId
  const sqlQueryTypes = `
    SELECT 
      pt.ID AS type_id,
      pt.NAME AS type_name
    FROM 
      PRODUCT_TYPE pt
    WHERE 
      pt.PRODUCT_CATEGORY_ID = ?;
  `;

  // Query to get brands based on productCategoryId
  const sqlQueryBrands = `
    SELECT 
      pb.ID AS brand_id,
      pb.NAME AS brand_name
    FROM 
      PRODUCT_BRANDS pb
    INNER JOIN 
      PRODUCT_BRANDS_TYPES pbt ON pb.ID = pbt.PRODUCT_BRAND_ID
    INNER JOIN 
      PRODUCT_TYPE pt ON pbt.PRODUCT_TYPE_ID = pt.ID
    WHERE 
      pt.PRODUCT_CATEGORY_ID = ?;
  `;

  // Query to get products based on productCategoryId
  const sqlQueryProducts = `
    SELECT 
      pn.*
    FROM 
      PRODUCT_NAMES pn
    INNER JOIN 
      PRODUCT_BRANDS_TYPES pbt ON pn.PRODUCT_BRAND_TYPE_ID = pbt.ID
    INNER JOIN 
      PRODUCT_TYPE pt ON pbt.PRODUCT_TYPE_ID = pt.ID
    WHERE 
     pn.ARCHIVE IS FALSE AND  pt.PRODUCT_CATEGORY_ID = ?;
  `;

  try {
    // Get types information
    const typesResult = await executeQuery(connectToDatabase, sqlQueryTypes, [
      productCategoryId,
    ]);
    const types = typesResult.affectedRows; // Assuming all type results are needed

    // Get brands information
    const brandsResult = await executeQuery(connectToDatabase, sqlQueryBrands, [
      productCategoryId,
    ]);
    const brands = brandsResult.affectedRows; // Assuming all brand results are needed

    // Get product information
    const productsResult = await executeQuery(
      connectToDatabase,
      sqlQueryProducts,
      [productCategoryId]
    );
    const products = productsResult.affectedRows; // Assuming all product results are needed

    res.json({ types, brands, products });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;

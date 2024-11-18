const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");

router.get("/categories", categoryController.getCategories);
router.post("/save-categories", categoryController.saveCategory);
router.get("/show-category/:id", categoryController.showCategory);
router.get("/edit-category/:id", categoryController.editCategory);
router.post("/update-category/:id", categoryController.updateCategory);
router.get("/destroy-category/:id", categoryController.destroyCategory);
router.get("/download-category", categoryController.downloadAsExcel);
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
router.post("/category", async (req, res) => {
  const { search } = req.body; // Changed category to categoryId
  console.log("bek", req.body);

  let sqlQuery = `
      SELECT pb.* FROM PRODUCT_CATEGORIES pb
      WHERE pb.ARCHIVE = FALSE
      `;

  const params = [];

  if (search) {
    sqlQuery += " AND UPPER(pb.NAME) LIKE ?";
    params.push(`%${search.toUpperCase()}%`); // Convert the search term to uppercase
  }

  try {
    const brand = await executeQuery(connectToDatabase, sqlQuery, params);
    const brands = brand.affectedRows;
    console.log("TRUE", brands);
    res.json(brands); // Sending back the types data instead of affectedRows (assuming you want to see the types)
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});
module.exports = router;

const express = require("express");
const router = express.Router();
const typeController = require("../controllers/typeController");

router.get("/types", typeController.getTypes);
router.post("/save-type", typeController.saveType);
router.get("/show-type/:id", typeController.showType);
router.get("/edit-type/:id", typeController.editType);
router.post("/update-type/:id", typeController.updateType);
router.get("/destroy-type/:id", typeController.destroyType);
router.get("/download-type", typeController.downloadAsExcel);

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
router.post("/type", async (req, res) => {
  const { category, search } = req.body; // Changed category to categoryId
  console.log("bek", req.body);

  let sqlQuery = `
       SELECT pc.*, pt.NAME AS CATEGORY_NAME 
        FROM PRODUCT_TYPE pc 
        LEFT JOIN PRODUCT_CATEGORIES pt 
        ON pc.PRODUCT_CATEGORY_ID = pt.ID 
        WHERE pc.ARCHIVE = FALSE 
      `;

  const params = [];

  if (category) {
    // Updated to match the variable name
    sqlQuery += " AND pc.PRODUCT_CATEGORY_ID = ?";
    params.push(category);
  }
  if (search) {
    sqlQuery += " AND UPPER(pc.NAME) LIKE ?";
    params.push(`%${search.toUpperCase()}%`); // Convert the search term to uppercase
  }
  try {
    const type = await executeQuery(connectToDatabase, sqlQuery, params);
    const types = type.affectedRows;
    res.json(types); // Sending back the types data instead of affectedRows (assuming you want to see the types)
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;

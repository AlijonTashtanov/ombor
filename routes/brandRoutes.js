const express = require("express");
const router = express.Router();
const brandController = require("../controllers/brandController");

router.get("/brands", brandController.getBrands);
router.post("/save-brand", brandController.saveBrand);
router.get("/show-brand/:id", brandController.showBrand);
router.get("/edit-brand/:id", brandController.editBrand);
router.post("/update-brand/:id", brandController.updateBrand);
router.get("/destroy-brand/:id", brandController.destroyBrand);
router.get("/download-brand", brandController.downloadAsExcel);

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
router.post("/brand", async (req, res) => {
  const { search } = req.body; // Changed category to categoryId
  console.log("bek", req.body);

  let sqlQuery = `
      SELECT pb.* FROM PRODUCT_BRANDS pb
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

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
exports.getCategories = async (req, res) => {
  try {
    // Prepare the base query
    let sqlQuery =
      "SELECT * FROM PRODUCT_CATEGORIES pc WHERE pc.ARCHIVE = FALSE"; // Corrected syntax
    const params = [];

    const { search } = req.body; // Extract search term from the request body

    // If search term is provided, modify the query to filter by category name
    if (search) {
      sqlQuery += " AND pc.NAME LIKE ?";
      params.push(`%${search}%`); // Add the search term with wildcards for LIKE search
    }

    // Execute the query to fetch categories
    const categoryRESULT = await executeQuery(
      connectToDatabase,
      sqlQuery,
      params
    );
    const categories = categoryRESULT.affectedRows;
    // console.log("BEK", categories);
    res.render("categories/index", { categories });
  } catch (error) {
    console.error("Error fetching categories:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
// Assuming you have a function `executeQuery` to interact with the database

exports.saveCategory = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming the user is authenticated and userId is available in req.user

    const { name, comment } = req.body;

    // SQL query to insert a new category into the PRODUCT_CATEGORIES table
    const sqlQuery = `
      INSERT INTO PRODUCT_CATEGORIES (NAME, COMMENT, ARCHIVE, CREATED_AT, CREATED_BY) 
      VALUES (?, ?, FALSE, CURRENT_TIMESTAMP, ?)
    `;

    // Execute the query with parameters
    const result = await executeQuery(connectToDatabase, sqlQuery, [
      name,
      comment,
      userId, // Pass the userId for the CREATED_BY field
    ]);

    // Return a success response
    res.redirect("/categories");
  } catch (error) {
    console.error("Error saving category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.showCategory = async (req, res) => {
  try {
    const categoryId = req.params.id; // Get the category ID from the request parameters

    // Define the SQL query with a condition to fetch a specific category by ID
    let sqlQuery = `
          SELECT * 
          FROM PRODUCT_CATEGORIES pc 
          WHERE pc.ID = ? AND pc.ARCHIVE = FALSE
        `;

    // Execute the query with the categoryId as a parameter
    const categoryRESULT = await executeQuery(connectToDatabase, sqlQuery, [
      categoryId,
    ]);
    const result = categoryRESULT.affectedRows;
    // console.log("categoryRESULT:", result); // Log to check the result structure

    // Check if the result is an array and contains data
    const categories =
      Array.isArray(result) && result.length > 0 ? result[0] : null;

    const { CREATED_BY, UPDATED_BY } = categories;
    let createdByUser = null;
    let updatedByUser = null;

    if (CREATED_BY) {
      const createdByQuery = `
        SELECT FIO 
        FROM USERS 
        WHERE ID = ?
      `;
      const createdByResult = await executeQuery(
        connectToDatabase,
        createdByQuery,
        [CREATED_BY]
      );
      createdByUser =
        Array.isArray(createdByResult.affectedRows) &&
        createdByResult.affectedRows.length > 0
          ? createdByResult.affectedRows[0].FIO
          : null;
    }

    if (UPDATED_BY) {
      const updatedByQuery = `
        SELECT FIO 
        FROM USERS 
        WHERE ID = ?
      `;
      const updatedByResult = await executeQuery(
        connectToDatabase,
        updatedByQuery,
        [UPDATED_BY]
      );
      updatedByUser =
        Array.isArray(updatedByResult.affectedRows) &&
        updatedByResult.affectedRows.length > 0
          ? updatedByResult.affectedRows[0].FIO
          : null;
    }

    // Add FIO values to the category object
    const cat = {
      ...categories,
      CREATED_BY_FIO: createdByUser,
      UPDATED_BY_FIO: updatedByUser,
    };

    // console.log("ERKIN", cat);
    res.render("categories/show", { cat });
  } catch (error) {
    console.error("Error fetching category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.editCategory = async (req, res) => {
  try {
    const categoryId = req.params.id; // Get the category ID from the request parameters

    // Define the SQL query with a condition to fetch a specific category by ID
    let sqlQuery = `
            SELECT * 
            FROM PRODUCT_CATEGORIES pc 
            WHERE pc.ID = ? AND pc.ARCHIVE = FALSE
          `;

    // Execute the query with the categoryId as a parameter
    const categoryRESULT = await executeQuery(connectToDatabase, sqlQuery, [
      categoryId,
    ]);
    const result = categoryRESULT.affectedRows;
    // console.log("categoryRESULT:", result); // Log to check the result structure

    // Check if the result is an array and contains data
    const categories =
      Array.isArray(result) && result.length > 0 ? result[0] : null;

    const { CREATED_BY, UPDATED_BY } = categories;
    let createdByUser = null;
    let updatedByUser = null;

    if (CREATED_BY) {
      const createdByQuery = `
          SELECT FIO 
          FROM USERS 
          WHERE ID = ?
        `;
      const createdByResult = await executeQuery(
        connectToDatabase,
        createdByQuery,
        [CREATED_BY]
      );
      createdByUser =
        Array.isArray(createdByResult.affectedRows) &&
        createdByResult.affectedRows.length > 0
          ? createdByResult.affectedRows[0].FIO
          : null;
    }

    if (UPDATED_BY) {
      const updatedByQuery = `
          SELECT FIO 
          FROM USERS 
          WHERE ID = ?
        `;
      const updatedByResult = await executeQuery(
        connectToDatabase,
        updatedByQuery,
        [UPDATED_BY]
      );
      updatedByUser =
        Array.isArray(updatedByResult.affectedRows) &&
        updatedByResult.affectedRows.length > 0
          ? updatedByResult.affectedRows[0].FIO
          : null;
    }

    // Add FIO values to the category object
    const cat = {
      ...categories,
      CREATED_BY_FIO: createdByUser,
      UPDATED_BY_FIO: updatedByUser,
    };

    // console.log("ERKIN", cat);
    res.render("categories/edit", { cat });
  } catch (error) {
    console.error("Error fetching category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.updateCategory = async (req, res) => {
  try {
    const category_id = req.params.id;
    const userId = req.user.id;
    const { name, comment } = req.body;

    const sqlQuery = `
          UPDATE PRODUCT_CATEGORIES
          SET NAME = ?, COMMENT = ?, UPDATED_AT = CURRENT_TIMESTAMP, UPDATED_BY = ?
          WHERE ID = ?
        `;

    const result = await executeQuery(connectToDatabase, sqlQuery, [
      name,
      comment,
      userId,
      category_id,
    ]);

    res.redirect("/categories");
  } catch (error) {
    console.error("Error updating category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.destroyCategory = async (req, res) => {
  try {
    const category_id = req.params.id; // Get the category ID from the request parameters
    const userId = req.user.id; // Assuming the user is authenticated and userId is available in req.user

    // SQL query to update the category's ARCHIVE field to true
    const sqlQuery = `
        UPDATE PRODUCT_CATEGORIES
        SET ARCHIVE = TRUE, UPDATED_AT = CURRENT_TIMESTAMP, UPDATED_BY = ?
        WHERE ID = ?
      `;

    // Execute the query with parameters
    const result = await executeQuery(connectToDatabase, sqlQuery, [
      userId, // Pass the userId for the UPDATED_BY field
      category_id, // Use category_id as the identifier for updating the record
    ]);

    // Check if any rows were affected (meaning the update was successful)
    if (result) {
      res.redirect("/categories");
    } else {
      res.status(404).json({
        message: "Category not found",
      });
    }
  } catch (error) {
    console.error("Error updating category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
// In your controller file
const XLSX = require("xlsx"); // Make sure to require the 'xlsx' package

exports.downloadAsExcel = async (req, res) => {
  // Ensure this function is async
  try {
    // Replace this with your actual query to fetch category data
    const sqlQuery = ` SELECT pc.*, 
             u1.FIO AS CREATED_BY_FIO, 
             u2.FIO AS UPDATED_BY_FIO
      FROM PRODUCT_CATEGORIES pc
      LEFT JOIN users u1 ON pc.CREATED_BY = u1.ID
      LEFT JOIN users u2 ON pc.UPDATED_BY = u2.ID
      WHERE pc.ARCHIVE = FALSE;`;
    const category = await executeQuery(connectToDatabase, sqlQuery);
    // console.log("KOKA", categories);
    // Prepare the data for the Excel sheet dynamically
    const categories = category.affectedRows;
    console.log("accord", categories);
    const worksheetData = [
      [
        "ID",
        "NOMI",
        "KOMMENT",
        "YARATILDI",
        "YARATDI",
        "TAHRIRLANDI",
        "TAHRIRLADI",
      ], // Header row
      ...categories.map((category) => [
        category.ID,
        category.NAME,
        category.COMMENT,
        category.CREATED_AT,
        category.CREATED_BY_FIO,
        category.UPDATED_AT,
        category.UPDATED_BY_FIO,
      ]), // Convert each category to a row
    ];

    // Create a new workbook and add a worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "categories");
    worksheet["!cols"] = [
      { width: 10 }, // Width for column 1 (ID)
      { width: 20 }, // Width for column 2 (NAME)
      { width: 40 }, // Width for column 3 (COMMENT)
      { width: 20 }, // Width for column 1 (ID)
      { width: 40 }, // Width for column 1 (ID)
      { width: 20 }, // Width for column 1 (ID)
      { width: 40 }, // Width for column 1 (ID)
    ];
    // Generate an Excel file
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // Send the Excel file as a response
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="category.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error generating Excel file:", error.message);
    res.status(500).send("Internal Server Error");
  }
};

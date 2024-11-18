const { types } = require("joi");
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
exports.getTypes = async (req, res) => {
  try {
    const { search, category } = req.body;
    let sqlQuery = `
      SELECT pc.*, pt.NAME AS CATEGORY_NAME 
      FROM PRODUCT_TYPE pc 
      LEFT JOIN PRODUCT_CATEGORIES pt 
      ON pc.PRODUCT_CATEGORY_ID = pt.ID 
      WHERE pc.ARCHIVE IS FALSE AND pt.ARCHIVE IS FALSE
    `;
    const params = [];

    if (search) {
      sqlQuery += " AND pc.NAME LIKE ?";
      params.push(`%${search}%`);
    }

    if (category) {
      sqlQuery += " AND pc.PRODUCT_CATEGORY_ID = ?";
      params.push(category);
    }

    // Fetch product types
    const productTypes = await executeQuery(
      connectToDatabase,
      sqlQuery,
      params
    );
    // console.log("munis", productTypes);
    // Fetch categories
    const sqlQueryCat =
      "SELECT * FROM PRODUCT_CATEGORIES WHERE ARCHIVE IS FALSE";
    const cat = await executeQuery(connectToDatabase, sqlQueryCat, []);

    const categories = cat.affectedRows;

    res.render("product-types/index", {
      categories: categories, // Assuming this is a list of category objects
      types: productTypes.affectedRows, // Assuming this is a list of product types
    });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Assuming you have a function `executeQuery` to interact with the database

exports.saveType = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming the user is authenticated and userId is available in req.user

    // console.log("User ID from request:", userId); // Add a log to check the userId value

    const { name, comment, category_id } = req.body;

    // Ensure that the user exists in the USERS table before inserting into PRODUCT_TYPE

    // SQL query to insert a new category into the PRODUCT_CATEGORIES table
    const sqlQuery = `
        INSERT INTO PRODUCT_TYPE (NAME, COMMENT, PRODUCT_CATEGORY_ID, ARCHIVE, CREATED_AT, CREATED_BY) 
        VALUES (?, ?, ?, FALSE, CURRENT_TIMESTAMP, ?)
      `;

    // Execute the query with parameters
    const result = await executeQuery(connectToDatabase, sqlQuery, [
      name,
      comment,
      category_id, // Pass the category_id
      userId, // Pass the userId for the CREATED_BY field
    ]);

    // Return a success response
    res.redirect("/types");
  } catch (error) {
    console.error("Error saving category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.showType = async (req, res) => {
  try {
    const typeId = req.params.id; // Get the type ID from the request parameters

    // Define the SQL query with a condition to fetch a specific type by ID
    let sqlQuery =
      "SELECT pc.*, pt.NAME AS PRODUCT_CATEGORY_NAME FROM PRODUCT_TYPE pc LEFT JOIN PRODUCT_CATEGORIES pt ON pc.PRODUCT_CATEGORY_ID = pt.ID WHERE pc.ARCHIVE = FALSE AND pc.ID = ?";

    // Execute the query with the typeId as a parameter
    const typeRESULT = await executeQuery(connectToDatabase, sqlQuery, [
      typeId,
    ]);

    // Assuming the data is directly in the result, not in affectedRows
    const result = typeRESULT.affectedRows; // We don't need to access `affectedRows` here.
    // console.log("typeRESULT:", result); // Log to check the result structure

    // Check if the result is an array and contains data
    const type = Array.isArray(result) && result.length > 0 ? result[0] : null;

    if (!type) {
      return res.status(404).json({
        message: "Product type not found",
      });
    }

    const { CREATED_BY, UPDATED_BY } = type;
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

    // Combine the fetched data with the user names
    const types = {
      ...type,
      CREATED_BY_FIO: createdByUser,
      UPDATED_BY_FIO: updatedByUser,
    };

    // Log the combined result to check the final object
    // console.log("Final Type Object:", types);

    // Render the page with the final data
    res.render("product-types/show", { types });
  } catch (error) {
    console.error("Error fetching product type:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.editType = async (req, res) => {
  try {
    const typeId = req.params.id; // Get the category ID from the request parameters

    // Define the SQL query with a condition to fetch a specific category by ID
    let sqlQuery = `
            SELECT pt.*,pc.ID AS CATEGORY_ID
            FROM PRODUCT_TYPE pt LEFT JOIN PRODUCT_CATEGORIES pc ON pt.PRODUCT_CATEGORY_ID=pc.ID
            WHERE pt.ID = ? AND pt.ARCHIVE = FALSE
          `;

    // Execute the query with the categoryId as a parameter
    const typeRESULT = await executeQuery(connectToDatabase, sqlQuery, [
      typeId,
    ]);
    const result = typeRESULT.affectedRows;
    // console.log("categoryRESULT:", result); // Log to check the result structure

    // Check if the result is an array and contains data
    const types = Array.isArray(result) && result.length > 0 ? result[0] : null;

    const { CREATED_BY, UPDATED_BY } = types;
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
    const type = {
      ...types,
      CREATED_BY_FIO: createdByUser,
      UPDATED_BY_FIO: updatedByUser,
    };
    // Execute query to fetch categories
    const sqlQueryCategory =
      "SELECT * FROM PRODUCT_CATEGORIES WHERE ARCHIVE IS FALSE"; // Adjust if needed
    const categoryResults = await executeQuery(
      connectToDatabase,
      sqlQueryCategory,
      []
    );
    const categories = categoryResults.affectedRows;
    // console.log("makeba", categories);
    res.render("product-types/edit", { type, categories });
  } catch (error) {
    console.error("Error fetching category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.updateType = async (req, res) => {
  try {
    const type_id = req.params.id;
    const userId = req.user.id;
    const { name, comment, category_id } = req.body;

    const sqlQuery = `
          UPDATE PRODUCT_TYPE
          SET NAME = ?,PRODUCT_CATEGORY_ID=?, COMMENT = ?, UPDATED_AT = CURRENT_TIMESTAMP, UPDATED_BY = ?
          WHERE ID = ?
        `;

    const result = await executeQuery(connectToDatabase, sqlQuery, [
      name,
      category_id,
      comment,
      userId,
      type_id,
    ]);

    res.redirect("/types");
  } catch (error) {
    console.error("Error updating category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.destroyType = async (req, res) => {
  try {
    const type_id = req.params.id; // Get the category ID from the request parameters
    const userId = req.user.id; // Assuming the user is authenticated and userId is available in req.user

    // SQL query to update the category's ARCHIVE field to true
    const sqlQuery = `
        UPDATE PRODUCT_TYPE
        SET ARCHIVE = TRUE, UPDATED_AT = CURRENT_TIMESTAMP, UPDATED_BY = ?
        WHERE ID = ?
      `;

    // Execute the query with parameters
    const result = await executeQuery(connectToDatabase, sqlQuery, [
      userId, // Pass the userId for the UPDATED_BY field
      type_id, // Use category_id as the identifier for updating the record
    ]);

    // Check if any rows were affected (meaning the update was successful)
    if (result) {
      res.redirect("/types");
    } else {
      res.status(404).json({
        message: "type_id not found",
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
const XLSX = require("xlsx"); // Make sure to require the 'xlsx' package

exports.downloadAsExcel = async (req, res) => {
  // Ensure this function is async
  try {
    // Replace this with your actual query to fetch category data
    const sqlQuery = ` SELECT pc.*, 
       u1.FIO AS CREATED_BY_FIO, 
       u2.FIO AS UPDATED_BY_FIO,
       pt.NAME AS CATEGORY_NAME
FROM PRODUCT_TYPE pc
LEFT JOIN PRODUCT_CATEGORIES pt ON pc.PRODUCT_CATEGORY_ID = pt.ID
LEFT JOIN users u1 ON pc.CREATED_BY = u1.ID
LEFT JOIN users u2 ON pc.UPDATED_BY = u2.ID
WHERE pc.ARCHIVE = FALSE;`;
    const type = await executeQuery(connectToDatabase, sqlQuery);
    // console.log("KOKA", categories);
    // Prepare the data for the Excel sheet dynamically
    const types = type.affectedRows;
    // console.log("accord", types);
    const worksheetData = [
      [
        "ID",
        "NOMI",
        "KOMMENT",
        "KATEGORIYA",
        "YARATILDI",
        "YARATDI",
        "TAHRIRLANDI",
        "TAHRIRLADI",
      ], // Header row
      ...types.map((type) => [
        type.ID,
        type.NAME,
        type.COMMENT,
        type.CATEGORY_NAME,
        type.CREATED_AT,
        type.CREATED_BY_FIO,
        type.UPDATED_AT,
        type.UPDATED_BY_FIO,
      ]), // Convert each type to a row
    ];

    // Create a new workbook and add a worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "brands");
    worksheet["!cols"] = [
      { width: 10 }, // Width for column 1 (ID)
      { width: 20 }, // Width for column 2 (NAME)
      { width: 40 }, // Width for column 3 (COMMENT)
      { width: 30 }, // Width for column 3 (COMMENT)
      { width: 20 }, // Width for column 1 (ID)
      { width: 40 }, // Width for column 1 (ID)
      { width: 20 }, // Width for column 1 (ID)
      { width: 40 }, // Width for column 1 (ID)
    ];
    // Generate an Excel file
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // Send the Excel file as a response
    res.setHeader("Content-Disposition", 'attachment; filename="turlar.xlsx"');
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

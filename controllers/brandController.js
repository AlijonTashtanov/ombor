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
exports.getBrands = async (req, res) => {
  try {
    const { search } = req.body;
    let sqlQuery = `
      SELECT * FROM PRODUCT_BRANDS
      WHERE ARCHIVE = FALSE
    `;
    const params = [];

    if (search) {
      sqlQuery += " AND NAME LIKE ?";
      params.push(`%${search}%`);
    }

    // Fetch product types
    const productBrands = await executeQuery(
      connectToDatabase,
      sqlQuery,
      params
    );

    res.render("brands/index", {
      brands: productBrands.affectedRows,
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

exports.saveBrand = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming the user is authenticated and userId is available in req.user

    console.log("User ID from request:", userId); // Add a log to check the userId value

    const { name, comment } = req.body;

    // Ensure that the user exists in the USERS table before inserting into PRODUCT_TYPE

    // SQL query to insert a new category into the PRODUCT_CATEGORIES table
    const sqlQuery = `
        INSERT INTO PRODUCT_BRANDS (NAME, COMMENT, ARCHIVE, CREATED_AT, CREATED_BY) 
        VALUES (?, ?, FALSE, CURRENT_TIMESTAMP, ?)
      `;

    // Execute the query with parameters
    const result = await executeQuery(connectToDatabase, sqlQuery, [
      name,
      comment,
      userId, // Pass the userId for the CREATED_BY field
    ]);

    // Return a success response
    res.redirect("/brands");
  } catch (error) {
    console.error("Error saving category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.showBrand = async (req, res) => {
  try {
    const brandId = req.params.id; // Get the type ID from the request parameters

    // Define the SQL query with a condition to fetch a specific type by ID
    let sqlQuery =
      "SELECT * FROM PRODUCT_BRANDS WHERE ARCHIVE = FALSE AND ID = ?";

    // Execute the query with the typeId as a parameter
    const brandRESULT = await executeQuery(connectToDatabase, sqlQuery, [
      brandId,
    ]);

    // Assuming the data is directly in the result, not in affectedRows
    const result = brandRESULT.affectedRows; // We don't need to access `affectedRows` here.
    // console.log("typeRESULT:", result); // Log to check the result structure

    // Check if the result is an array and contains data
    const brands =
      Array.isArray(result) && result.length > 0 ? result[0] : null;

    if (!brands) {
      return res.status(404).json({
        message: "Product type not found",
      });
    }

    const { CREATED_BY, UPDATED_BY } = brands;
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
    const brand = {
      ...brands,
      CREATED_BY_FIO: createdByUser,
      UPDATED_BY_FIO: updatedByUser,
    };

    // Log the combined result to check the final object
    // console.log("Final Type Object:", types);

    // Render the page with the final data
    res.render("brands/show", { brand });
  } catch (error) {
    console.error("Error fetching product type:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.editBrand = async (req, res) => {
  try {
    const brandId = req.params.id; // Get the category ID from the request parameters

    // Define the SQL query with a condition to fetch a specific category by ID
    let sqlQuery = `
            SELECT *
            FROM PRODUCT_BRANDS 
            WHERE ID = ? AND ARCHIVE = FALSE
          `;

    // Execute the query with the categoryId as a parameter
    const typeRESULT = await executeQuery(connectToDatabase, sqlQuery, [
      brandId,
    ]);
    const result = typeRESULT.affectedRows;
    // console.log("categoryRESULT:", result); // Log to check the result structure

    // Check if the result is an array and contains data
    const brands =
      Array.isArray(result) && result.length > 0 ? result[0] : null;

    const { CREATED_BY, UPDATED_BY } = brands;
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
    const brand = {
      ...brands,
      CREATED_BY_FIO: createdByUser,
      UPDATED_BY_FIO: updatedByUser,
    };

    // console.log("ERKIN", brand);
    res.render("brands/edit", { brand });
  } catch (error) {
    console.error("Error fetching category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.updateBrand = async (req, res) => {
  try {
    const brand_id = req.params.id;
    const userId = req.user.id;
    const { name, comment } = req.body;

    const sqlQuery = `
          UPDATE PRODUCT_BRANDS
          SET NAME = ?, COMMENT = ?, UPDATED_AT = CURRENT_TIMESTAMP, UPDATED_BY = ?
          WHERE ID = ?
        `;

    const result = await executeQuery(connectToDatabase, sqlQuery, [
      name,
      comment,
      userId,
      brand_id,
    ]);

    res.redirect("/brands");
  } catch (error) {
    console.error("Error updating category:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
exports.destroyBrand = async (req, res) => {
  try {
    const brand_id = req.params.id; // Get the category ID from the request parameters
    const userId = req.user.id; // Assuming the user is authenticated and userId is available in req.user

    // SQL query to update the category's ARCHIVE field to true
    const sqlQuery = `
        UPDATE PRODUCT_BRANDS
        SET ARCHIVE = TRUE, UPDATED_AT = CURRENT_TIMESTAMP, UPDATED_BY = ?
        WHERE ID = ?
      `;

    // Execute the query with parameters
    const result = await executeQuery(connectToDatabase, sqlQuery, [
      userId, // Pass the userId for the UPDATED_BY field
      brand_id, // Use category_id as the identifier for updating the record
    ]);

    // Check if any rows were affected (meaning the update was successful)
    if (result) {
      res.redirect("/brands");
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
             u2.FIO AS UPDATED_BY_FIO
      FROM PRODUCT_BRANDS pc
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
        "YARATILDI",
        "YARATDI",
        "TAHRIRLANDI",
        "TAHRIRLADI",
      ], // Header row
      ...types.map((type) => [
        type.ID,
        type.NAME,
        type.COMMENT,
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
      { width: 20 }, // Width for column 1 (ID)
      { width: 40 }, // Width for column 1 (ID)
      { width: 20 }, // Width for column 1 (ID)
      { width: 40 }, // Width for column 1 (ID)
    ];
    // Generate an Excel file
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // Send the Excel file as a response
    res.setHeader("Content-Disposition", 'attachment; filename="brands.xlsx"');
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

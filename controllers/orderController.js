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
exports.deadlineOrder = async (req, res) => {
  try {
    const { deadline } = req.body;
    const { id } = req.params;

    if (!deadline || !id) {
      console.error("Missing required parameters:", { deadline, id });
      return res.status(400).send("Missing required parameters");
    }

    // Check input values
    console.log("Received parameters - Deadline:", deadline, "ID:", id);

    // SQL query to update the deadline
    const sqlQuery = `
      UPDATE ORDERS_PRODUCTS 
      SET DEADLINE = ? 
      WHERE ID = ?;
    `;
    const params = [deadline, id];

    console.log("Executing query:", sqlQuery, "with params:", params);

    // Execute query
    const result = await executeQuery(connectToDatabase, sqlQuery, params);
    console.log("Query execution result:", result.affectedRows);

    // Check if any rows were updated
    if (!result || result.affectedRows === 0) {
      console.warn("No record found to update for ID:", id);
      return res.status(404).send("No record found to update");
    }

    res.redirect("/orders");
  } catch (error) {
    console.error("Error updating deadline:", error);
    res.status(500).send("Error updating deadline");
  }
};

exports.updateOrderItem = async (req, res) => {
  const { order_product_id, qty, type, order_id } = req.body;
  const maxRetries = 3;
  let attempts = 0;
  const item_id = req.params.id;

  // console.log("vse", req.body, item_id);
  while (attempts < maxRetries) {
    try {
      // Update quantity in ORDER_PRODUCT_ITEMS
      const updateQuantityQuery = `
        UPDATE ORDER_PRODUCT_ITEMS
        SET QUANTITY = ?
        WHERE ID = ?;
      `;
      await executeQuery(connectToDatabase, updateQuantityQuery, [
        qty,
        item_id,
      ]);

      // Update order_type_id in ORDERS_PRODUCTS
      const updateOrderTypeQuery = `
        UPDATE ORDERS_PRODUCTS
        SET ORDER_TYPE_ID = ?
        WHERE ID = ?;
      `;
      await executeQuery(connectToDatabase, updateOrderTypeQuery, [
        type,
        order_product_id,
      ]);

      // If updates succeed, send the response and break the loop
      return res.redirect(`/edit-order/${order_product_id}`);
    } catch (error) {
      if (error.message.includes("deadlock") && attempts < maxRetries - 1) {
        console.warn(
          `Deadlock detected, retrying... (Attempt ${attempts + 1})`
        );
        attempts += 1;
        continue; // Retry the loop
      } else {
        console.error("Error updating data:", error.message);
        // Send error response and return to ensure no further responses
        return res.status(500).json({
          message: "Internal Server Error",
          error: error.message,
        });
      }
    }
  }
};

exports.filterOrder = async (req, res) => {
  const {
    filial,
    type,
    status,
    fromDate,
    toDate,
    page = 1,
    limit = 100,
  } = req.body; // Default to 100 items per page

  let startRow = (page - 1) * limit + 1; // Firebird's pagination starts from 1
  let endRow = page * limit; // End at the page's limit

  // Initialize the SQL query
  let sqlQuery = `
    SELECT 
      opi.ORDER_ID,
      op.ID AS order_id,
      op.DEADLINE AS muddat,
      op.CREATED_AT,
      op.CREATED_BY,
      op.UPDATED_AT,
      op.UPDATED_BY,
      op.STATUS,
      b.NAME AS branch_name,
      ot.NAME AS order_type_name,
      u.FIO AS user_name,
      SUM(opi.QUANTITY) AS total_product_quantity,
      DATEDIFF(DAY, op.CREATED_AT, CURRENT_DATE) AS difference
    FROM 
      ORDERS_PRODUCTS op
    JOIN 
      BRANCHES b ON op.BRANCH_ID = b.ID
    JOIN 
      ORDER_TYPES ot ON op.ORDER_TYPE_ID = ot.ID
    JOIN 
      USERS u ON op.CREATED_BY = u.ID
    JOIN 
      ORDER_PRODUCT_ITEMS opi ON opi.ORDER_ID = op.ID
    WHERE 
      opi.ARCHIVE = FALSE `; // Ensure only non-archived items are considered

  let params = []; // Array to store the dynamic query parameters

  // Apply filters based on the request body
  if (filial) {
    sqlQuery += " AND op.BRANCH_ID = ?";
    params.push(filial); // Add the filial parameter
  }

  if (type) {
    sqlQuery += " AND op.ORDER_TYPE_ID = ?";
    params.push(type); // Add the type parameter
  }

  if (status) {
    sqlQuery += " AND op.STATUS = ?";
    params.push(status); // Add the status parameter
  }

  if (fromDate) {
    sqlQuery += " AND op.CREATED_AT >= ?";
    params.push(fromDate); // Add the fromDate parameter
  }

  if (toDate) {
    sqlQuery += " AND op.CREATED_AT <= ?";
    params.push(toDate); // Add the toDate parameter
  }

  // Add the GROUP BY clause
  sqlQuery += `
    GROUP BY 
      opi.ORDER_ID, op.ID, op.DEADLINE, op.CREATED_AT, op.CREATED_BY, 
      op.UPDATED_AT, op.UPDATED_BY, op.STATUS, b.NAME, ot.NAME, u.FIO
  `;

  // If no filters are provided, return the last 100 records
  if (!filial && !type && !status && !fromDate && !toDate) {
    sqlQuery += ` 
      ORDER BY op.CREATED_AT DESC
      ROWS 1 TO 100;`; // Get the last 100 records
  } else {
    // Otherwise, apply pagination
    sqlQuery += ` 
      ORDER BY op.CREATED_AT DESC
      ROWS ${startRow} TO ${endRow};`;
  }

  try {
    // Execute the query with the dynamic parameters
    const result = await executeQuery(connectToDatabase, sqlQuery, params);
    const results = result.affectedRows;
    res.json({ data: results, page, limit }); // Send the response with the result
  } catch (error) {
    console.error("Error fetching filtered orders:", error);
    res.status(500).send("Error fetching filtered orders");
  }
};

exports.saveUpdatedOrder = async (req, res) => {
  try {
    const { id: userId } = req.user; // Destructuring userId
    const order_id = req.params.id;
    const { product, productId, orderType, orderTypeId, qty, usd } = req.body;
    console.log("11111:", req.body);

    // Ensure productId is always treated as an array
    const productIds = Array.isArray(productId) ? productId : [productId];
    const quantities = Array.isArray(qty) ? qty : [qty];
    const usdValues = Array.isArray(usd) ? usd : [usd];

    // Iterate over productIds
    for (let i = 0; i < productIds.length; i++) {
      const productValue = parseInt(productIds[i], 10); // Convert product ID to integer
      const qtyValue = parseInt(quantities[i], 10); // Get corresponding quantity
      const usdValue = parseFloat(usdValues[i]); // Get corresponding USD value

      console.log("rahmat", productValue);

      // Check if the product exists in the PRODUCTS table
      const productExistsQuery =
        'SELECT COUNT(*) AS "count" FROM PRODUCT_NAMES WHERE ARCHIVE IS FALSE AND ID = ?';
      const productExists = await executeQuery(
        connectToDatabase,
        productExistsQuery,
        [productValue]
      );

      // Log the result to understand its structure
      console.log("Product Exists Result:", productExists.affectedRows);

      // Check if the product exists
      if (productExists.affectedRows[0].count === 0) {
        console.log(
          `Product with ID ${productValue} does not exist! Skipping this product.`
        );
        continue; // Skip this iteration if the product doesn't exist
      }

      // Insert the product item with proper values if the product exists
      const insertProductItemQuery = `INSERT INTO ORDER_PRODUCT_ITEMS (ORDER_ID, PRODUCT_ID, QUANTITY, CREATED_AT, CREATED_BY, STATUS, USD) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 1, ?)`;

      await executeQuery(connectToDatabase, insertProductItemQuery, [
        order_id, // Ensure this is a valid number
        productValue, // Pass the individual product ID (should be number)
        qtyValue, // Pass the corresponding quantity (should be number)
        userId, // Pass user ID (should be number or string)
        usdValue, // Pass USD value (should be number)
      ]);
    }

    return res.redirect(`/edit-order/${order_id}`);
  } catch (error) {
    console.error("Error saving order:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.saveOrder = async (req, res) => {
  try {
    const { id: userId } = req.user; // Destructuring userId
    // console.log("User ID:", userId);
    const { product, productId, orderType, orderTypeId, qty, usd } = req.body;
    // console.log("11111:", req.body);

    // Fetch branch ID associated with the user
    const query = `
      SELECT b.ID
      FROM BRANCHES b
      JOIN users u ON u.branches = b.key
      WHERE u.id = ?
    `;

    // console.log("Executing query:", query, "with userId:", userId);

    const result1 = await executeQuery(connectToDatabase, query, [userId]);

    // console.log("Result of branch ID query:", result1); // Log the result for debugging

    if (result1.affectedRows[0].ID) {
      const branchId = result1.affectedRows[0].ID;
      // console.log("Branch ID:", branchId);

      const orderTypeIdValue = Array.isArray(orderTypeId)
        ? parseInt(orderTypeId[0], 10)
        : parseInt(orderTypeId, 10);
      const orderTypeValue = Array.isArray(orderType)
        ? orderType[0]
        : orderType;
      // console.log("anna");
      // SQL Query to insert order
      const sqlQuery = `
        INSERT INTO ORDERS_PRODUCTS (BRANCH_ID, CREATED_AT, ARCHIVE, CREATED_BY, STATUS, STORE, ORDER_TYPE_ID) 
        VALUES (?, CURRENT_TIMESTAMP, FALSE, ?, 1, ?, ?)
        RETURNING ID
      `;

      // Execute the query with parameters
      const result = await executeQuery(connectToDatabase, sqlQuery, [
        branchId,
        userId, // Created by user ID
        orderTypeValue,
        orderTypeIdValue, // Order Type ID from request body
      ]);

      // console.log("Insert Result:", result.affectedRows); // Log the result to inspect it

      // Check if the result contains an ID
      if (result.affectedRows) {
        const insertedOrderId = result; // Access the ID of the inserted order
        // console.log("Inserted Order ID:", insertedOrderId);

        const usdValues = usd;
        const productIds = Array.isArray(req.body.productId)
          ? req.body.productId
          : req.body.productId.split(",");

        // Ensure qty and productIds have the same length before proceeding
        if (
          productIds.length !== qty.length ||
          productIds.length !== usd.length
        ) {
          throw new Error(
            "Product IDs, quantities, and USD arrays must have the same length."
          );
        }
        // console.log("dunyo");
        // Iterate over each product ID and fetch USD value for each product
        for (let i = 0; i < productIds.length; i++) {
          const productValue = parseInt(productIds[i], 10); // Get individual product ID
          console.log("IKKI", productValue);
          const qtyValue = parseInt(qty[i], 10); // Get corresponding quantity
          const usdValue = parseFloat(usd[i]); // Get corresponding USD value
          const order_id = parseFloat(insertedOrderId.affectedRows.ID, [i]); // Get corresponding USD value
          // console.log("Inserting product:", productValue);
          // console.log("With qty:", qtyValue);
          // console.log("And USD:", usdValue);
          // console.log("and order_id", order_id);
          // console.log("and user_id", userId);

          // Insert the product item with proper values
          const insertProductItemQuery = `
            INSERT INTO ORDER_PRODUCT_ITEMS (ORDER_ID, PRODUCT_ID, QUANTITY, CREATED_AT, CREATED_BY, STATUS, USD) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 1, ?)
          `;

          const insertResult = await executeQuery(
            connectToDatabase,
            insertProductItemQuery,
            [
              order_id, // Ensure this is a valid number
              productValue, // Pass the individual product ID (should be number)
              qtyValue, // Pass the corresponding quantity (should be number)
              userId, // Pass user ID (should be number or string)
              usdValue, // Pass USD value (should be number)
            ]
          );
        }
        return res.redirect(`/edit-order/${order_id}`);
        // res.redirect("/orders");
      } else {
        throw new Error("Failed to retrieve inserted order ID.");
      }
    } else {
      throw new Error("Failed to retrieve branch ID.");
    }
  } catch (error) {
    console.error("Error saving order:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getOrders = async (req, res) => {
  try {
    // Extract the current page and limit from the query parameters (default to page 1 and 10 items per page)
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page
    const offset = (page - 1) * limit; // Calculate offset for SQL query

    // Firebird uses FIRST for limiting records and ROWS for offset
    let sqlQuery = `
SELECT 
    opi.ORDER_ID,
    op.ID AS order_id,
    op.DEADLINE AS muddat,
    op.CREATED_AT,
    op.CREATED_BY,
    op.UPDATED_AT,
    op.UPDATED_BY,
    op.STATUS,
    b.NAME AS branch_name,
    ot.NAME AS order_type_name,
    u.FIO AS user_name,
       DATEDIFF(DAY, op.CREATED_AT, CURRENT_DATE) AS difference,
    SUM(opi.QUANTITY) AS total_product_quantity
FROM 
    ORDERS_PRODUCTS op
JOIN 
    BRANCHES b ON op.BRANCH_ID = b.ID
JOIN 
    ORDER_TYPES ot ON op.ORDER_TYPE_ID = ot.ID
JOIN 
    USERS u ON op.CREATED_BY = u.ID
JOIN 
    ORDER_PRODUCT_ITEMS opi ON opi.ORDER_ID = op.ID
WHERE 
    opi.ARCHIVE = FALSE  
GROUP BY 
    opi.ORDER_ID, op.ID, op.DEADLINE, op.CREATED_AT, op.CREATED_BY, 
    op.UPDATED_AT, op.UPDATED_BY, op.STATUS, b.NAME, ot.NAME, u.FIO
ORDER BY 
    op.CREATED_AT DESC
ROWS ? TO ?


    `;

    // Execute the query with ROWS for pagination
    const order_product = await executeQuery(connectToDatabase, sqlQuery, [
      offset + 1,
      offset + limit,
    ]);

    // Get the total count of orders for pagination
    const countQuery = `
      SELECT COUNT(*) AS total_count
      FROM ORDERS_PRODUCTS op
      JOIN 
        BRANCHES b ON op.BRANCH_ID = b.ID
      JOIN 
        ORDER_TYPES ot ON op.ORDER_TYPE_ID = ot.ID
      JOIN 
        USERS u ON op.CREATED_BY = u.ID
      JOIN 
        ORDER_PRODUCT_ITEMS opi ON opi.ORDER_ID = op.ID
    `;

    const totalCountResult = await executeQuery(
      connectToDatabase,
      countQuery,
      []
    );

    // Check if totalCountResult is returned and contains a valid result
    // if (!totalCountResult || totalCountResult.length === 0) {
    //   throw new Error("Failed to fetch the total count of orders");
    // }

    const totalCount = totalCountResult.affectedRows.total_count; // Get the total count from the result
    const totalPages = Math.ceil(totalCount / limit); // Calculate the total number of pages

    const order_products = order_product.affectedRows;
    const today = new Date();

    order_products.forEach((order) => {
      const createdAt = new Date(order.CREATED_AT);
      const timeDifference = today - createdAt;
      const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24)); // Convert milliseconds to days
      order.farq = daysDifference;
    });

    // Fetch active filials
    const sqlQueryFilials = "SELECT * FROM BRANCHES WHERE IS_ACTIVE IS TRUE";
    const filial = await executeQuery(connectToDatabase, sqlQueryFilials, []);
    const filials = filial.affectedRows;

    // Fetch active order types
    const sqlQueryTYPE = "SELECT * FROM ORDER_TYPES WHERE ARCHIVE IS FALSE";
    const type = await executeQuery(connectToDatabase, sqlQueryTYPE, []);
    const types = type.affectedRows;

    // Fetch active order statuses
    const sqlQueryStatus =
      "SELECT * FROM ORDER_STATUSES WHERE ARCHIVE IS FALSE";
    const status = await executeQuery(connectToDatabase, sqlQueryStatus, []);
    const statuses = status.affectedRows;

    // Render the page with the order data and pagination details
    res.render("orders/index", {
      filials,
      types,
      statuses,
      order_products: order_products,
      totalCount,
      totalPages,
      currentPage: page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.addOrder = async (req, res) => {
  try {
    const sqlQueryCategory =
      "SELECT * FROM PRODUCT_CATEGORIES WHERE ARCHIVE IS FALSE";
    const category = await executeQuery(
      connectToDatabase,
      sqlQueryCategory,
      []
    );
    const categories = category.affectedRows;

    const sqlQueryTYPE = "SELECT * FROM PRODUCT_TYPE WHERE ARCHIVE IS FALSE";
    const type = await executeQuery(connectToDatabase, sqlQueryTYPE, []);
    const types = type.affectedRows;

    const sqlQueryBrand = "SELECT * FROM PRODUCT_BRANDS WHERE ARCHIVE IS FALSE";
    const brand = await executeQuery(connectToDatabase, sqlQueryBrand, []);
    const brands = brand.affectedRows;

    const sqlQueryOrderTypes =
      "SELECT * FROM ORDER_TYPES WHERE ARCHIVE IS FALSE";
    const orderType = await executeQuery(
      connectToDatabase,
      sqlQueryOrderTypes,
      []
    );
    const orderTypes = orderType.affectedRows;

    res.render("orders/add", {
      categories: categories,
      types: types,
      brands: brands,
      orderTypes: orderTypes,
    });
  } catch (error) {}
};
exports.destroyOrderItem = async (req, res) => {
  try {
    const order_item_id = req.params.id; // Get the ID from the request parameter
    console.log("Order Item ID:", order_item_id);
    console.log("Request Body:", req.body);

    const order_id = req.body.order_id; // Extract the order_id correctly from the request body

    // Check if order_item_id and order_id are provided
    if (!order_item_id || !order_id) {
      return res
        .status(400)
        .json({ message: "Order Item ID and Order ID are required" });
    }

    // SQL query to find the order_product_item by ID
    let sqlQuery = `
      SELECT * 
      FROM order_product_items 
      WHERE id = ? AND ARCHIVE = FALSE`; // Select the order item if it's not archived already

    const params = [order_item_id];

    try {
      // Execute the query to get the order product item
      const order_item = await executeQuery(
        connectToDatabase,
        sqlQuery,
        params
      );

      if (!order_item || order_item.length === 0) {
        return res
          .status(404)
          .json({ message: "Order item not found or already archived" });
      }

      // SQL query to update the ARCHIVE field to TRUE
      let updateQuery = `
        UPDATE order_product_items 
        SET ARCHIVE = TRUE
        WHERE id = ?`;

      const updateParams = [order_item_id];

      // Execute the update query to archive the order item
      const result = await executeQuery(
        connectToDatabase,
        updateQuery,
        updateParams
      );

      if (result.affectedRows === 0) {
        return res
          .status(500)
          .json({ message: "Failed to archive the order item" });
      }

      // Redirect to the edit order page with the order_id
      return res.redirect(`/edit-order/${order_id}`);
    } catch (error) {
      console.error("Database error:", error.message);
      res.status(500).json({ error: "Database error" });
    }
  } catch (error) {
    console.error("Error in destroyOrderItem:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// exports.showType = async (req, res) => {
//   try {
//     const typeId = req.params.id; // Get the type ID from the request parameters

//     // Define the SQL query with a condition to fetch a specific type by ID
//     let sqlQuery =
//       "SELECT pc.*, pt.NAME AS PRODUCT_CATEGORY_NAME FROM PRODUCT_TYPE pc LEFT JOIN PRODUCT_CATEGORIES pt ON pc.PRODUCT_CATEGORY_ID = pt.ID WHERE pc.ARCHIVE = FALSE AND pc.ID = ?";

//     // Execute the query with the typeId as a parameter
//     const typeRESULT = await executeQuery(connectToDatabase, sqlQuery, [
//       typeId,
//     ]);

//     // Assuming the data is directly in the result, not in affectedRows
//     const result = typeRESULT.affectedRows; // We don't need to access `affectedRows` here.
//     // console.log("typeRESULT:", result); // Log to check the result structure

//     // Check if the result is an array and contains data
//     const type = Array.isArray(result) && result.length > 0 ? result[0] : null;

//     if (!type) {
//       return res.status(404).json({
//         message: "Product type not found",
//       });
//     }

//     const { CREATED_BY, UPDATED_BY } = type;
//     let createdByUser = null;
//     let updatedByUser = null;

//     if (CREATED_BY) {
//       const createdByQuery = `
//           SELECT FIO
//           FROM USERS
//           WHERE ID = ?
//         `;
//       const createdByResult = await executeQuery(
//         connectToDatabase,
//         createdByQuery,
//         [CREATED_BY]
//       );
//       createdByUser =
//         Array.isArray(createdByResult.affectedRows) &&
//         createdByResult.affectedRows.length > 0
//           ? createdByResult.affectedRows[0].FIO
//           : null;
//     }

//     if (UPDATED_BY) {
//       const updatedByQuery = `
//           SELECT FIO
//           FROM USERS
//           WHERE ID = ?
//         `;
//       const updatedByResult = await executeQuery(
//         connectToDatabase,
//         updatedByQuery,
//         [UPDATED_BY]
//       );
//       updatedByUser =
//         Array.isArray(updatedByResult.affectedRows) &&
//         updatedByResult.affectedRows.length > 0
//           ? updatedByResult.affectedRows[0].FIO
//           : null;
//     }

//     // Combine the fetched data with the user names
//     const types = {
//       ...type,
//       CREATED_BY_FIO: createdByUser,
//       UPDATED_BY_FIO: updatedByUser,
//     };

//     // Log the combined result to check the final object
//     // console.log("Final Type Object:", types);

//     // Render the page with the final data
//     res.render("product-types/show", { types });
//   } catch (error) {
//     console.error("Error fetching product type:", error.message);
//     res.status(500).json({
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

exports.editOrder = async (req, res) => {
  try {
    const orderId = req.params.id; // Assuming this is the order ID you want to fetch
    console.log("Order ID:", orderId);

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    // SQL query to select order product items by order ID
    let sqlQuery = `

  SELECT 
    opi.*, 
    b.NAME AS branch_name, 
    ot.NAME AS order_type_name, 
    u.FIO AS user_fio,
    pn.NAME AS product_name,  pn.MODEL AS product_model
  FROM 
    order_product_items opi
  INNER JOIN 
    orders_products op ON opi.ORDER_ID = op.ID
  INNER JOIN 
    branches b ON op.BRANCH_ID = b.ID
  INNER JOIN 
    order_types ot ON op.ORDER_TYPE_ID = ot.ID
  INNER JOIN 
    users u ON op.CREATED_BY = u.ID
  INNER JOIN 
    product_names pn ON opi.PRODUCT_ID = pn.ID
  WHERE 
    opi.ARCHIVE = FALSE 
    AND opi.ORDER_ID = ?`;

    const params = [orderId]; // Use orderId as parameter

    try {
      // Execute the query
      const order_item = await executeQuery(
        connectToDatabase,
        sqlQuery,
        params
      );

      const sqlQueryCategory =
        "SELECT * FROM PRODUCT_CATEGORIES WHERE ARCHIVE IS FALSE";
      const category = await executeQuery(
        connectToDatabase,
        sqlQueryCategory,
        []
      );
      const categories = category.affectedRows;

      const sqlQueryTYPE = "SELECT * FROM PRODUCT_TYPE WHERE ARCHIVE IS FALSE";
      const type = await executeQuery(connectToDatabase, sqlQueryTYPE, []);
      const types = type.affectedRows;

      const sqlQueryBrand =
        "SELECT * FROM PRODUCT_BRANDS WHERE ARCHIVE IS FALSE";
      const brand = await executeQuery(connectToDatabase, sqlQueryBrand, []);
      const brands = brand.affectedRows;

      // console.log("yor", order_item.affectedRows);
      res.render("orders/edit", {
        order_items: order_item.affectedRows,
        categories: categories,
        types: types,
        brands: brands,
        orderId: orderId,
      });
    } catch (error) {
      console.error("Database error:", error.message);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  } catch (error) {
    console.error("Error fetching order:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.reEditOrder = async (req, res) => {
  try {
    const order_item_Id = req.params.id;
    // console.log("Order ID:", orderId);

    if (!order_item_Id) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    // SQL query to select a product category by ID (or search for a name if you prefer)
    let sqlQuery = `
    SELECT 
    opi.*, 
    b.NAME AS branch_name, 
    ot.id AS order_type, 
    u.FIO AS user_fio
FROM 
    order_product_items opi
INNER JOIN 
    orders_products op ON opi.ORDER_ID = op.ID
INNER JOIN 
    branches b ON op.BRANCH_ID = b.ID
INNER JOIN 
    order_types ot ON op.ORDER_TYPE_ID = ot.ID
INNER JOIN 
    users u ON op.CREATED_BY = u.ID
WHERE 
    opi.ID = ?`; // Use ID to filter

    const params = [order_item_Id]; // Use orderId as parameter

    try {
      // Execute the query
      const order_item = await executeQuery(
        connectToDatabase,
        sqlQuery,
        params
      );

      if (!order_item || order_item.length === 0) {
        return res.status(404).json({ message: "Product  not found" });
      }
      const sqlQueryStatus = `
      SELECT 
        *
      FROM 
        ORDER_TYPES
    
    `;

      // Get types information
      const status = await executeQuery(connectToDatabase, sqlQueryStatus);
      const statuses = status.affectedRows; // Assuming all type results are needed
      // console.log("timur:", order_item.affectedRows[0]);
      // console.log("natura", statuses);
      res.render("orders/edit2", {
        item: order_item.affectedRows[0],
        statuses: statuses,
      });
    } catch (error) {
      console.error("Database error:", error.message);
    }
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
const XLSX = require("xlsx");

exports.downloadAsExcel = async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        op.ID AS order_id, 
        COUNT(opi.ID) AS item_count, 
        op.DEADLINE AS muddat, 
        b.NAME AS branch_name, 
        ot.NAME AS order_type_name, 
        u.FIO AS user_name,
        op.CREATED_AT, 
        op.STATUS
      FROM 
        ORDERS_PRODUCTS op
      JOIN 
        BRANCHES b ON op.BRANCH_ID = b.ID
      JOIN 
        ORDER_TYPES ot ON op.ORDER_TYPE_ID = ot.ID
      JOIN 
        USERS u ON op.CREATED_BY = u.ID
      LEFT JOIN 
        ORDER_PRODUCT_ITEMS opi ON opi.ORDER_ID = op.ID
      WHERE 
        op.ARCHIVE IS FALSE
      GROUP BY 
        op.ID, op.DEADLINE, b.NAME, ot.NAME, u.FIO, op.CREATED_AT, op.STATUS
    `;

    const result = await executeQuery(connectToDatabase, sqlQuery);

    // Log the result structure for debugging
    // console.log("Query Result:", result);

    // Check if the result contains an array in expected properties
    const rows = Array.isArray(result)
      ? result
      : result.rows || result.data || result.affectedRows || [];

    if (!Array.isArray(rows)) {
      throw new Error("The query result does not contain a valid rows array.");
    }

    // Prepare the data for the Excel sheet
    const worksheetData = [
      [
        "BUYURTMA ID",
        "YARATDI",
        "BUYURTMA TURI",
        "FILIAL",
        "MIQDORI",
        "MUDDAT",
        "YARATILDI",
        "STATUS",
      ],
      ...rows.map((row) => [
        row.ORDER_ID,
        row.USER_NAME,
        row.ORDER_TYPE_NAME,
        row.BRANCH_NAME,
        row.ITEM_COUNT,
        row.MUDDAT,
        row.CREATED_AT,
        row.STATUS,
      ]),
    ];

    // Create a new workbook and add a worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

    worksheet["!cols"] = [
      { width: 10 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 20 },
      { width: 10 },
    ];

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    res.setHeader("Content-Disposition", 'attachment; filename="orders.xlsx"');
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

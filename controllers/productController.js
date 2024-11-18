const { connectToDatabase } = require("../config/config");
const fs = require("fs");
// const multer = require("multer");
// const upload = multer({ dest: "uploads/" }); // Set destination directory
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
const { v4: uuidv4 } = require("uuid"); // To generate unique identifiers
// const multer = require("multer");
// const upload = multer({ dest: "uploads/" }); // Configure destination folder

// Route with file upload handling

exports.saveProduct = async (req, res) => {
  try {
    const { name, model, usd, new_keys, new_value, category, type, brand } =
      req.body;
    const imagePaths = [];

    // Ensure uploads directory exists
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    // Save uploaded images
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        const imagePath = path.join(uploadDir, uniqueName);
        fs.writeFileSync(imagePath, fs.readFileSync(file.path)); // Save file
        imagePaths.push(`uploads/${uniqueName}`); // Save relative path
      });
    }

    // Prepare properties as an object
    let properties = {};
    if (new_keys && new_value) {
      const keysArray = Array.isArray(new_keys) ? new_keys : [new_keys];
      const valuesArray = Array.isArray(new_value) ? new_value : [new_value];

      keysArray.forEach((key, index) => {
        properties[key] = valuesArray[index] || null;
      });
    }
    const propertiesJson = JSON.stringify(properties);

    // const imagesJson = JSON.stringify(imagePaths); // In saveProduct

    const sqlQuery = `
      INSERT INTO PRODUCT_NAMES (
        NAME, MODEL, USD, PRODUCT_BRAND_TYPE_ID, IMAGES, PROPERTIES, CREATED_AT, CREATED_BY, ARCHIVE
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, false)
    `;
    const params = [
      name,
      model,
      usd,
      brand,
      imagePaths,
      propertiesJson,
      req.user.id,
    ];
    const result = await executeQuery(connectToDatabase, sqlQuery, params);

    res.redirect("/get-products");
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(500).json({ error: "Failed to save product" });
  }
};

exports.addProducts = async (req, res) => {
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

    res.render("products/add", {
      category: categories,
      brand: brands,
      type: types,
    });
  } catch (error) {}
};
exports.destroyProduct = async (req, res) => {
  try {
    const { id } = req.params; // Use req.params to get the id from the URL parameter

    // SQL query to update the ARCHIVE field to TRUE for the specified product ID
    let sqlQuery = `
        UPDATE PRODUCT_NAMES
        SET ARCHIVE = TRUE
        WHERE ID = ?;
      `;

    const params = [id];

    // Execute the update query
    const result = await executeQuery(connectToDatabase, sqlQuery, params);

    // Check if the update was successful
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Product not found or already archived" });
    }

    // Store success message in flash
    req.flash("message", "Product archived successfully");
    req.flash("id", id);

    // Redirect to get-products page
    res.redirect("/get-products");
  } catch (error) {
    console.error("Error updating product:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
const path = require("path");
// const fs = require("fs");
// const uuidv4 = require("uuid").v4;
// Use multer middleware for image fields
exports.updateProduct = async (req, res) => {
  try {
    const id = req.params.id;
    console.log("Product ID:", id);
    console.log("req.body:", req.body);
    console.log("req.files:", req.files);

    const { nomi, model, usd, new_keys, new_values } = req.body;
    const newImagePaths = [];

    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        const imagePath = path.join(uploadDir, uniqueName);
        fs.writeFileSync(imagePath, fs.readFileSync(file.path));
        newImagePaths.push(`uploads/${uniqueName}`);
      });
    }

    const sqlQuery = `
      SELECT pn.*, 
             pb.NAME AS BRAND_NAME,
             pt.NAME AS TYPE_NAME,
             pc.NAME AS CATEGORY_NAME
      FROM PRODUCT_NAMES pn
      JOIN PRODUCT_BRANDS_TYPES pbt ON pn.PRODUCT_BRAND_TYPE_ID = pbt.ID
      JOIN PRODUCT_BRANDS pb ON pbt.PRODUCT_BRAND_ID = pb.ID
      JOIN PRODUCT_TYPE pt ON pbt.PRODUCT_TYPE_ID = pt.ID
      JOIN PRODUCT_CATEGORIES pc ON pt.PRODUCT_CATEGORY_ID = pc.ID
      WHERE pn.ARCHIVE IS FALSE AND pn.ID = ?;
    `;
    const productResult = await executeQuery(connectToDatabase, sqlQuery, [id]);

    if (!productResult || productResult.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = productResult.affectedRows[0];
    console.log("Existing Product:", product);

    let existingImages = [];
    if (product.IMAGES) {
      existingImages = product.IMAGES.split(",");
    }
    const updatedImages = [...existingImages, ...newImagePaths];

    let existingProperties = {};
    try {
      if (product.PROPERTIES) {
        existingProperties = JSON.parse(product.PROPERTIES);
      }
    } catch (err) {
      console.error("Error parsing product properties:", err);
      existingProperties = {};
    }

    let newProperties = {};
    if (new_keys && new_values) {
      const keysArray = Array.isArray(new_keys) ? new_keys : [new_keys];
      const valuesArray = Array.isArray(new_values) ? new_values : [new_values];

      keysArray.forEach((key, index) => {
        if (!existingProperties.hasOwnProperty(key)) {
          newProperties[key] = valuesArray[index] || null;
        }
      });
    }

    const updatedProperties = { ...existingProperties, ...newProperties };
    const updatedPropertiesJson = JSON.stringify(updatedProperties);
    console.log("Updated Properties:", updatedPropertiesJson);

    const updateValues = [
      nomi || product.NAME,
      model || product.MODEL,
      usd || product.USD,
      updatedImages.join(","),
      updatedPropertiesJson,
      id,
    ];

    const updateQuery = `
      UPDATE PRODUCT_NAMES 
      SET NAME = ?, MODEL = ?, USD = ?, IMAGES = ?, PROPERTIES = ? 
      WHERE ID = ?;
    `;
    await executeQuery(connectToDatabase, updateQuery, updateValues);

    const updatedProductResult = await executeQuery(
      connectToDatabase,
      sqlQuery,
      [id]
    );
    console.log("Updated Product:", updatedProductResult);

    res.redirect("/get-products");
  } catch (error) {
    console.error("Error updating product:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.editProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // SQL Query to fetch product details
    const sqlQuery = `
      SELECT pn.*, 
             pb.NAME AS BRAND_NAME,
             pt.NAME AS TYPE_NAME,
             pc.NAME AS CATEGORY_NAME
      FROM PRODUCT_NAMES pn
      JOIN PRODUCT_BRANDS_TYPES pbt ON pn.PRODUCT_BRAND_TYPE_ID = pbt.ID
      JOIN PRODUCT_BRANDS pb ON pbt.PRODUCT_BRAND_ID = pb.ID
      JOIN PRODUCT_TYPE pt ON pbt.PRODUCT_TYPE_ID = pt.ID
      JOIN PRODUCT_CATEGORIES pc ON pt.PRODUCT_CATEGORY_ID = pc.ID
      WHERE pn.ARCHIVE IS FALSE AND pn.ID = ?;
    `;
    const params = [id];

    // Fetch product details from the database
    const product = await executeQuery(connectToDatabase, sqlQuery, params);

    // Check if the product exists
    if (!product || product.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const productData = product.affectedRows[0]; // Access the first row (since executeQuery might return an array)

    let imagePaths = [];
    let propertiesObject = {};

    // Handle IMAGES field
    if (productData.IMAGES) {
      imagePaths = productData.IMAGES.split(","); // Split the string by comma to get an array of image paths
    }

    // Handle PROPERTIES field (Assuming properties are stored as a JSON string)
    if (productData.PROPERTIES) {
      try {
        propertiesObject = JSON.parse(productData.PROPERTIES); // Parse the properties JSON string
      } catch (error) {
        console.error("Error parsing PROPERTIES field:", error.message);
      }
    }

    productData.images = imagePaths;
    productData.firstImage = imagePaths.length > 0 ? imagePaths[0] : null;
    productData.properties = propertiesObject;

    console.log("Final Product Data:", productData);

    // Render the edit page with the product data
    res.render("products/edit", {
      row: productData,
      images: imagePaths,
      properties: propertiesObject, // Pass properties to the template
    });
  } catch (error) {
    console.error("Error fetching product data:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.showProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const sqlQuery = `
      SELECT pn.*, 
             pb.NAME AS BRAND_NAME,
             pt.NAME AS TYPE_NAME,
             pc.NAME AS CATEGORY_NAME
      FROM PRODUCT_NAMES pn
      JOIN PRODUCT_BRANDS_TYPES pbt ON pn.PRODUCT_BRAND_TYPE_ID = pbt.ID
      JOIN PRODUCT_BRANDS pb ON pbt.PRODUCT_BRAND_ID = pb.ID
      JOIN PRODUCT_TYPE pt ON pbt.PRODUCT_TYPE_ID = pt.ID
      JOIN PRODUCT_CATEGORIES pc ON pt.PRODUCT_CATEGORY_ID = pc.ID
      WHERE pn.ARCHIVE IS FALSE AND pn.ID = ?
    `;

    const params = [id];
    const product = await executeQuery(connectToDatabase, sqlQuery, params);

    if (!product || product.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    const row = product.affectedRows[0]; // Get the first row (since executeQuery might return an array)

    let imagePaths = [];
    let propertiesObject = {};

    // Handle IMAGES field
    if (row.IMAGES) {
      imagePaths = row.IMAGES.split(","); // Split the string by comma to get an array of image paths
    }

    // Handle PROPERTIES field
    if (row.PROPERTIES) {
      try {
        propertiesObject = JSON.parse(row.PROPERTIES); // Parse the properties JSON string
      } catch (error) {
        console.error("Error parsing PROPERTIES field:", error.message);
      }
    }

    row.images = imagePaths;
    row.firstImage = imagePaths.length > 0 ? imagePaths[0] : null;
    row.properties = propertiesObject;

    console.log("Final Product Data:", row);

    res.render("products/show", { row });
  } catch (error) {
    console.error("Error fetching product data:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    //filters
    //category filter
    const sqlQueryCategory =
      "SELECT * FROM PRODUCT_CATEGORIES WHERE ARCHIVE IS FALSE"; // Adjust based on your table's column name
    const category = await executeQuery(
      connectToDatabase,
      sqlQueryCategory,
      []
    );
    const categories = category.affectedRows;

    //brands filter
    const sqlQueryBrand = "SELECT * FROM PRODUCT_BRANDS WHERE ARCHIVE IS FALSE"; // Adjust based on your table's column name
    const brand = await executeQuery(connectToDatabase, sqlQueryBrand, []);
    const brands = brand.affectedRows;

    //type fiflter
    const sqlQueryType = "SELECT * FROM PRODUCT_TYPE WHERE ARCHIVE IS FALSE"; // Adjust based on your table's column name
    const type = await executeQuery(connectToDatabase, sqlQueryType, []);
    const types = type.affectedRows;

    const { cat, br, ty } = req.query;
    // console.log("somsa", req.query);

    let sqlQuery = `
      SELECT pn.* 
      FROM PRODUCT_NAMES pn
      JOIN PRODUCT_BRANDS_TYPES pbt ON pn.PRODUCT_BRAND_TYPE_ID = pbt.ID
      JOIN PRODUCT_BRANDS pb ON pbt.PRODUCT_BRAND_ID = pb.ID
      JOIN PRODUCT_TYPE pt ON pbt.PRODUCT_TYPE_ID = pt.ID
      WHERE pn.ARCHIVE IS FALSE
    `;

    const params = [];

    if (cat) {
      sqlQuery += " AND pt.PRODUCT_CATEGORY_ID = ?";
      params.push(cat);
    }
    if (br) {
      sqlQuery += " AND pb.ID = ?";
      params.push(br);
    }
    if (ty) {
      sqlQuery += " AND pt.ID = ?";
      params.push(ty);
    }

    const products = await executeQuery(connectToDatabase, sqlQuery, params);

    // const sqlQueryProduct =
    //   "SELECT * FROM PRODUCT_NAMES WHERE ARCHIVE IS FALSE"; // Adjust based on your table's column name
    // const product = await executeQuery(connectToDatabase, sqlQueryProduct, []);
    // const products = product.affectedRows;
    // res.json({
    //   products: products.affectedRows,
    // });
    // console.log(products.affectedRows);
    res.render("products/index", {
      categories: categories,
      brands: brands,
      types: types,
      products: products,
    });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

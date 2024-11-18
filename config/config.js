const dotenv = require("dotenv");
const Firebird = require("node-firebird");

// Load environment variables based on NODE_ENV
const envFile =
  process.env.NODE_ENV === "production" ? ".env.prod" : ".env.dev";
dotenv.config({ path: envFile });

// Define Firebird database configuration
const dbConfig = {
  port: process.env.FIREBIRD_PORT || 3050,
  database:
    process.env.NODE_ENV === "production"
      ? process.env.FIREBIRD_DB || "E:\\XBaseQ\\MyConfig.FDB" // Fallback if not set
      : process.env.FIREBIRD_DB, // Development fallback
  host:
    process.env.NODE_ENV === "production"
      ? process.env.FIREBIRD_HOST_PROD || "172.10.10.101" // Fallback if not set
      : process.env.FIREBIRD_HOST_DEV || "172.10.10.124", // Development fallback
  user: process.env.FIREBIRD_USER || "SYSDBA", // Use the variable or default to SYSDBA
  password: process.env.FIREBIRD_PASSWORD || "masterkey", // Use the variable or default to masterkey
  lowercase_keys: false,
  role: null,
  pageSize: 4096,
  retryConnectionInterval: 1000,
  blobAsText: false,
  encoding: "UTF-8",
};

// Log the database configuration
console.log("DB Config:", dbConfig);

// Function to connect to the Firebird database
const connectToDatabase = (callback, retryCount = 3) => {
  Firebird.attach(dbConfig, (err, db) => {
    if (err) {
      console.error("Failed to connect to the database:", err);

      if (retryCount > 0) {
        console.log("Retrying database connection...");
        return connectToDatabase(callback, retryCount - 1); // Retry connection
      }

      return callback(err);
    }

    console.log("Connected to Firebird database");
    callback(null, db);
  });
};

module.exports = { connectToDatabase };

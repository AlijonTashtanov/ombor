// middleware/user.js
const { connectToDatabase, databases } = require("../config/config");
const Firebird = require("node-firebird");

const executeQuery = (sqlQuery, params) => {
  return new Promise((resolve, reject) => {
    const dbOptions = databases.default; // Assuming you have a default database configuration
    Firebird.attach(dbOptions, (err, db) => {
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

        resolve(result); // Directly resolve the result
      });
    });
  });
};

exports.setUser = async (req, res, next) => {
  const { userId } = req.body; // Adjust according to your request structure

  if (!userId) {
    return next(); // Proceed without user data if not available
  }

  try {
    const userQuery = "SELECT * FROM users WHERE id = ?";
    const user = await executeQuery(userQuery, [userId]);

    // Attach user data to res.locals
    res.locals.user = user.length > 0 ? user[0] : null;
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error("Error fetching user:", error);
    next(); // Proceed without user data on unexpected error
  }
};

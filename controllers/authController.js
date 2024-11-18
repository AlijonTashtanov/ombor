const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const { connectToDatabase } = require("../config/config");
const generateJWTToken = require("../services/token");
const flash = require("connect-flash");

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
        const affectedRows = result; // Adjust this based on Firebird's behavior
        resolve({ affectedRows, result }); // Include result for access to query data
      });
    });
  });
};

exports.getLoginPage = async (req, res) => {
  try {
    const { login } = req.body;
    res.render("auth/login", {
      messages: req.flash("error"),
      login: login || "",
    });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.compareLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash("error", "Iltimos login parol kiriting!");
    return res.redirect("/login");
  }

  try {
    const { login, password } = req.body;
    const query = "SELECT * FROM USERS WHERE LOGINS= ?";

    // Use executeQuery to fetch user data
    const { result } = await executeQuery(connectToDatabase, query, [login]);
    console.log("res", req.body);
    if (result.length === 0) {
      req.flash("error", "Foydalanuvchi topilmadi.");
      return res.redirect("/login");
    }

    const existUser = result[0];
    const isPasswordValid = await bcrypt.compare(password, existUser.PASSWORD);

    if (!isPasswordValid) {
      req.flash("error", "Parol noto'g'ri.");
      return res.redirect("/login");
    }

    const positionId = existUser.POSITION_ID;
    const token = generateJWTToken(existUser.ID, positionId);
    res.cookie("token", token, { httpOnly: true });

    return res.redirect("/");
  } catch (error) {
    console.error("Error during login:", error);
    req.flash("error", "Internal Server Error");
    return res.redirect("/login");
  }
};

exports.logout = async (req, res) => {
  try {
    res.clearCookie("token");
    res.redirect("/login");
  } catch (error) {
    console.error("Error during logout:", error);
    req.flash("error", "Internal Server Error");
    return res.redirect("/login");
  }
};

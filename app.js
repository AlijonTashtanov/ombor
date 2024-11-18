const express = require("express");
const Firebird = require("node-firebird");
const dotenv = require("dotenv");
const fs = require("fs");
const cors = require("cors");
const flash = require("connect-flash");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const methodOverride = require("method-override");
const bodyParser = require("body-parser");
const path = require("path");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const appealRoutes = require("./routes/appealRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const typeRoutes = require("./routes/typeRoutes");
const brandRoutes = require("./routes/brandRoutes");
const orderRoutes = require("./routes/orderRoutes");

const isAuth = require("./middleware/isAuthMiddleware");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
// Determine the environment file based on NODE_ENV
const envFile =
  process.env.NODE_ENV === "production" ? ".env.prod" : ".env.dev";
dotenv.config({ path: envFile });

const app = express();
app.use(express.static("public"));
app.use(
  "/static",
  express.static(path.join(__dirname, "node_modules/admin-lte"))
);
// app.use(express.static("public"));

app.use(
  "/static",
  express.static(path.join(__dirname, "node_modules/bootstrap"))
);
app.use("/static", express.static(path.join(__dirname, "node_modules/jquery")));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
  session({
    secret: "your_secret_key", // Replace 'your_secret_key' with a strong, secret string
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to `true` if you're using HTTPS, otherwise `false`
  })
);

app.use(flash());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Database connection and Firebird setup
const options = {
  port: process.env.FIREBIRD_PORT || 3050,
  database: process.env.FIREBIRD_DB,
  host:
    process.env.NODE_ENV === "production"
      ? process.env.FIREBIRD_HOST
      : process.env.FIREBIRD_HOST,
  user: process.env.FIREBIRD_USER,
  password: process.env.FIREBIRD_PASSWORD,
  lowercase_keys: false,
  role: process.env.FIREBIRD_ROLE || null,
  pageSize: process.env.FIREBIRD_PAGE_SIZE || 4096,
  retryConnectionInterval: process.env.FIREBIRD_RETRY_INTERVAL || 1000,
  blobAsText: false,
  encoding: process.env.FIREBIRD_ENCODING || "UTF-8",
};

console.log("DB Path:", options);

Firebird.attach(options, function (err, db) {
  if (err) {
    console.error("Error connecting to the Firebird database:", err);
    return;
  }
  console.log("Connected to Firebird database");
});

app.get("/", (req, res) => {
  res.render("dashboard");
});

app.use(authRoutes);
app.use(isAuth, productRoutes);
app.use(isAuth, appealRoutes);
app.use(isAuth, categoryRoutes);
app.use(isAuth, typeRoutes);
app.use(isAuth, brandRoutes);
app.use(isAuth, orderRoutes);

// Determine the correct PORT based on NODE_ENV
const PORT =
  process.env.NODE_ENV === "production" ? process.env.PORT : process.env.PORT;

app.listen(PORT, "172.10.10.124", () => {
  console.log(`Server is running on port ${PORT}`);
});

const jwt = require("jsonwebtoken");
const secretKey = process.env.SECRET_KEY || "myjwttoken";

const isAuth = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect("/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || secretKey);
    req.user = { id: decoded.id, position_id: decoded.position_id }; // Access using positionId

    next();
  } catch (err) {
    return res.redirect("/login");
  }
};

module.exports = isAuth;

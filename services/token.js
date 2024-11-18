const jwt = require("jsonwebtoken");

const generateJWTToken = (userId, positionId) => {
  const payload = {
    id: userId,
    position_id: positionId, // Change to position_id
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });
};

module.exports = generateJWTToken;

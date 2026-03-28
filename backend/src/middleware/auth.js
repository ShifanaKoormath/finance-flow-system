const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token format" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token not provided" });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || "default_development_secret";
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

module.exports = { authMiddleware };

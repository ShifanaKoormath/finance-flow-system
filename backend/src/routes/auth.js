const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models/User");
const { Entity } = require("../models/Entity");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "default_development_secret";
const JWT_EXPIRES_IN = "7d";

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists with that email" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, passwordHash });
    await user.save();

    const defaultEntities = [
      { name: "You", type: "person", userId: user._id },
      { name: "Cash", type: "source", userId: user._id },
      { name: "Bank Account", type: "source", userId: user._id }
    ];

    for (const ent of defaultEntities) {
      const exists = await Entity.findOne(ent);
      if (!exists) {
        await Entity.create(ent);
      }
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});


function auth(req, res, next) {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;

    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}


// SIGNUP
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1,$2) RETURNING id",
      [email, hashed]
    );

    const token = jwt.sign(
      { userId: result.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});



// GET todos (private)
app.get("/todos", auth, async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM todos WHERE user_id=$1 ORDER BY "dueDate","startTime"`,
    [req.userId]
  );
  res.json(result.rows);
});

// ADD todo (private)
app.post("/todos", auth, async (req, res) => {
  const { name, dueDate, startTime, endTime } = req.body;

  await pool.query(
    `INSERT INTO todos (user_id,name,"dueDate","startTime","endTime")
     VALUES ($1,$2,$3,$4,$5)`,
    [req.userId, name, dueDate, startTime, endTime]
  );

  res.json({ message: "Task added" });
});

// DELETE todo (private)
app.delete("/todos/:id", auth, async (req, res) => {
  await pool.query(
    "DELETE FROM todos WHERE id=$1 AND user_id=$2",
    [req.params.id, req.userId]
  );
  res.json({ message: "Deleted" });
});

// UPDATE todo (private)
app.put("/todos/:id", auth, async (req, res) => {
  const { name, dueDate, startTime, endTime } = req.body;

  await pool.query(
    `UPDATE todos
     SET name=$1,"dueDate"=$2,"startTime"=$3,"endTime"=$4
     WHERE id=$5 AND user_id=$6`,
    [name, dueDate, startTime, endTime, req.params.id, req.userId]
  );

  res.json({ message: "Updated" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
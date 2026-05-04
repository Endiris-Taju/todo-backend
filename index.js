const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const app = express();

app.use(cors({
  origin: "https://todo-frontend-dusky-psi.vercel.app"
}));
app.use(express.json());


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// GET all tasks
app.get("/todos", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        name,
        "dueDate",
        "startTime",
        "endTime"
      FROM todos
      ORDER BY "dueDate", "startTime"
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ADD task
app.post("/todos", async (req, res) => {
  const { name, dueDate, startTime, endTime } = req.body;

  // convert to comparable format in DB query
 const result = await pool.query(
  `SELECT * FROM todos WHERE "dueDate" = $1`,
  [dueDate]
);

  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const newStart = toMinutes(startTime);
  const newEnd = toMinutes(endTime);

  for (let task of result.rows) {
    const existingStart = toMinutes(task.starttime);
    const existingEnd = toMinutes(task.endtime);

    const overlap =
      newStart < existingEnd &&
      newEnd > existingStart;

    if (overlap) {
      return res.status(400).json({
        error: "Time overlap not allowed"
      });
    }
  }

  await pool.query(
    "INSERT INTO todos (name, dueDate, startTime, endTime) VALUES ($1,$2,$3,$4)",
    [name, dueDate, startTime, endTime]
  );

  res.json({ message: "Task added" });
});

// DELETE task
app.delete("/todos/:id", async (req, res) => {
  const id = req.params.id;

  await pool.query("DELETE FROM todos WHERE id=$1", [id]);

  res.json({ message: "Deleted" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

app.put("/todos/:id", async (req, res) => {
  const { name, dueDate, startTime, endTime } = req.body;
  const id = req.params.id;

  await pool.query(
    "UPDATE todos SET name=$1, dueDate=$2, startTime=$3, endTime=$4 WHERE id=$5",
    [name, dueDate, startTime, endTime, id]
  );

  res.json({ message: "Updated" });
});


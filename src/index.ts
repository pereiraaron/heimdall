import express, { Express } from "express";
import dotenv from "dotenv";
import { connectToDB } from "./db/connect";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const app: Express = express();
const PORT = process.env.PORT || 7001;

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Health check route
app.get("/", (_, res) => {
  res.status(200).json({ message: "Heimdall is guarding your API!" });
});

connectToDB();

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Heimdall is guarding on port ${PORT}`);
  });
}

export default app;

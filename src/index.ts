import express, { Express } from "express";
import dotenv from "dotenv";
import { connectToDB } from "./db/connect";
import authRoutes from "./routes/auth";

dotenv.config();
const app: Express = express();
const PORT = process.env.PORT || 7001;

//Middleware
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Health check route
app.get("/", (_, res) => {
  res.status(200).json({ message: "Heimdall is guarding your API!" });
});

connectToDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Heimdall is guarding on port ${PORT}`);
  });
});

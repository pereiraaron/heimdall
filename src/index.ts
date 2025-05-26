import express, { Express } from "express";
import dotenv from "dotenv";
import { connectToDB } from "./db/connect";
import authRoutes from "./routes/auth";

dotenv.config();
const app: Express = express();
const PORT = process.env.PORT || 5000;

//Middleware
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

connectToDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Heimdall is guarding on port ${PORT}`);
  });
});

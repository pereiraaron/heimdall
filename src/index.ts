import express from "express";
import dotenv from "dotenv";
import { connectToDB } from "./db/connect";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

connectToDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Heimdall is guarding on port ${PORT}`);
  });
});

import express, { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger.json";
import { connectToDB } from "./db/connect";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import membershipRoutes from "./routes/membership";
import passkeyRoutes from "./routes/passkey";

dotenv.config();

// if (!process.env.JWT_SECRET) {
//   throw new Error("JWT_SECRET environment variable is required");
// }

const app: Express = express();
const PORT = process.env.PORT || 7001;

app.use(cors());
app.use(express.json());

// Swagger docs
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/memberships", membershipRoutes);
app.use("/api/auth/passkey", passkeyRoutes);

// Health check route
app.get("/", (_, res) => {
  res.status(200).json({ message: "Heimdall is guarding your API!" });
});

connectToDB();

// Only skip listening on Vercel (serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Heimdall is guarding on port ${PORT}`);
  });
}

export default app;

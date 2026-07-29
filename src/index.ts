import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";
import { connectToDB } from "./db/connect";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import membershipRoutes from "./routes/membership";
import passkeyRoutes from "./routes/passkey";
import socialAuthRoutes from "./routes/socialAuth";

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const app: Express = express();
const PORT = process.env.PORT || 7001;

app.use(cors());
app.use(compression());
app.use(express.json());

// Health check — must not depend on the database
app.get("/", (_, res) => {
  res.status(200).json({ message: "Heimdall is guarding your API!" });
});

// Swagger docs. The 44KB spec is loaded on demand so cold starts don't pay to
// parse it for a route almost nobody hits.
app.get("/api/docs/spec.json", async (_, res) => {
  const { default: swaggerDocument } = await import("./swagger.json");
  res.status(200).json(swaggerDocument);
});
app.get("/api/docs", (_, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html><head>
<title>Heimdall API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:"/api/docs/spec.json",dom_id:"#swagger-ui"})</script>
</body></html>`);
});

// Gate the data routes on a live connection rather than relying on Mongoose's
// command buffering, so a cold start that can't reach Mongo fails fast.
app.use(async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await connectToDB();
    next();
  } catch {
    res.status(503).json({ message: "Service unavailable" });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/memberships", membershipRoutes);
app.use("/api/auth/passkey", passkeyRoutes);
app.use("/api/auth/social", socialAuthRoutes);

const start = async () => {
  try {
    await connectToDB();
  } catch {
    // A long-running server should fail fast; a serverless instance should
    // stay up and retry the connection on the next request.
    if (!process.env.VERCEL) process.exit(1);
    return;
  }

  // Only skip listening on Vercel (serverless)
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`Heimdall is guarding on port ${PORT}`);
    });
  }
};

start();

export default app;

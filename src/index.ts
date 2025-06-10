import express, { Express } from "express";
import dotenv from "dotenv";
import { connectToDB } from "./db/connect";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import passport from "./config/passport";
import session from "express-session";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 7001;

app.use(express.json());

// Session middleware
app.use(
  session({
    secret: process.env.JWT_SECRET || "heimdall-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

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

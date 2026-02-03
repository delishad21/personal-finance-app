import express from "express";
import cors from "cors";
import { transactionRouter } from "./modules/transactions/transactions.controller";
import { analyticsRouter } from "./modules/analytics/analytics.controller";

const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "data-service" });
});

// Routes
app.use("/api/transactions", transactionRouter);
app.use("/api/analytics", analyticsRouter);

// Error handling
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal server error",
    });
  },
);

app.listen(PORT, () => {
  console.log(`Data service listening on port ${PORT}`);
});

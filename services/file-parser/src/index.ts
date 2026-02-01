import express, { Express, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { parseCSV } from "./parsers/csv-parser";
import { parsePDF } from "./parsers/pdf-parser";
import { z } from "zod";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 4000;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "file-parser" });
});

// Parse file endpoint
const parseRequestSchema = z.object({
  parserId: z.string(),
  parserConfig: z.any().optional(),
});

app.post(
  "/parse",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const { parserId, parserConfig } = parseRequestSchema.parse(req.body);

      const fileExtension = req.file.originalname
        .split(".")
        .pop()
        ?.toLowerCase();

      let transactions;

      if (fileExtension === "csv") {
        transactions = await parseCSV(req.file.buffer, parserId, parserConfig);
      } else if (fileExtension === "pdf") {
        transactions = await parsePDF(req.file.buffer, parserId, parserConfig);
      } else {
        return res.status(400).json({ error: "Unsupported file type" });
      }

      res.json({
        success: true,
        filename: req.file.originalname,
        parserId,
        transactions,
        count: transactions.length,
      });
    } catch (error) {
      console.error("Parse error:", error);
      res.status(500).json({
        error: "Failed to parse file",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Get parser definitions
app.get("/parsers", (req: Request, res: Response) => {
  // This would eventually fetch from database
  // For now, return hardcoded parsers
  res.json({
    parsers: [
      {
        id: "generic_csv",
        name: "Generic CSV",
        fileType: "csv",
        description: "Generic CSV parser with customizable column mapping",
      },
      {
        id: "chase_csv",
        name: "Chase Bank CSV",
        fileType: "csv",
        description: "Parser for Chase Bank CSV exports",
      },
    ],
  });
});

app.listen(port, () => {
  console.log(`🚀 File Parser Service running on port ${port}`);
});

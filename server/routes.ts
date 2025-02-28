import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/resume-analyze", async (req, res) => {
    const schema = z.object({
      content: z.string().min(1),
      userId: z.string().optional(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "Invalid resume content" });
      return;
    }

    const analysis = await storage.analyzeResume(
      result.data.content,
      result.data.userId
    );
    res.json(analysis);
  });

  app.get("/api/resume-analysis/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const analysis = await storage.getResumeAnalysis(id);

    if (!analysis) {
      res.status(404).json({ message: "Analysis not found" });
      return;
    }

    res.json(analysis);
  });

  const httpServer = createServer(app);
  return httpServer;
}
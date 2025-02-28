import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/jobs", async (req, res) => {
    const jobs = await storage.getJobs();
    res.json(jobs);
  });

  app.get("/api/jobs/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const job = await storage.getJobById(id);
    
    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }
    
    res.json(job);
  });

  app.post("/api/resume-analyze", async (req, res) => {
    const schema = z.object({
      content: z.string().min(1),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "Invalid resume content" });
      return;
    }

    const analysis = await storage.analyzeResume(result.data.content);
    res.json(analysis);
  });

  const httpServer = createServer(app);
  return httpServer;
}

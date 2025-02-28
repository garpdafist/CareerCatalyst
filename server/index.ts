import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
// Increase JSON payload size limit to 50MB
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Add logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("Starting server initialization...");
    const server = await registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      log(`Error: ${err.message}`);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Serve static files in production
    if (process.env.NODE_ENV === "production") {
      log("Setting up static file serving for production");
      serveStatic(app);
    } else {
      log("Setting up Vite development server");
      await setupVite(app, server);
    }

    // Try to serve the app on port 5000, but fallback to another port if needed
    const tryPort = (port: number): Promise<number> => {
      return new Promise((resolve, reject) => {
        server.listen({
          port,
          host: "0.0.0.0",
          reusePort: true,
        })
        .on('listening', () => {
          const actualPort = (server.address() as any)?.port || port;
          log(`Server running at http://0.0.0.0:${actualPort}`);
          // Print additional debug info about the server
          log(`Server info: Node ${process.version}, Express routes: ${
            Object.keys(app._router.stack
              .filter((r: any) => r.route)
              .map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`)
            )
          }`);
          resolve(actualPort);
        })
        .on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            log(`Port ${port} is in use, trying ${port + 1}`);
            server.close();
            resolve(tryPort(port + 1));
          } else {
            reject(err);
          }
        });
      });
    };
    
    tryPort(5000)
      .then(port => {
        log(`Server successfully started on port ${port}`);
        // Set environment variable with the actual port for client reference
        process.env.ACTUAL_PORT = port.toString();
      })
      .catch(error => {
        log(`Fatal error during server startup: ${error}`);
        process.exit(1);
      });
  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    process.exit(1);
  }
})();
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

    // Use PORT from environment variable in production, or fallback to 5000 in development
    // Try multiple ports in case the default is already in use
    const tryPorts = [5000, 5001, 5002, 5003];
    let PORT = process.env.NODE_ENV === "production" ? (process.env.PORT || 3000) : tryPorts[0];
    
    log(`Starting server on port ${PORT} (process.env.PORT=${process.env.PORT}, NODE_ENV=${process.env.NODE_ENV})`);
    
    // Function to try starting server on different ports
    const startServer = (portIndex = 0) => {
      if (portIndex >= tryPorts.length && process.env.NODE_ENV !== "production") {
        log(`Fatal error: Could not find an available port`);
        process.exit(1);
        return;
      }
      
      const currentPort = process.env.NODE_ENV === "production" 
        ? (process.env.PORT || 3000) 
        : tryPorts[portIndex];
      
      server.listen({
        port: currentPort,
        host: "0.0.0.0"
      }, () => {
      log(`🚀 Server running at http://0.0.0.0:${currentPort}`);
      // Print additional debug info about the server
      log(`Server info: Node ${process.version}, Express routes: ${
        Object.keys(app._router.stack
          .filter((r: any) => r.route)
          .map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`)
        )
      }`);
      // Set environment variable with the actual port for client reference
      process.env.ACTUAL_PORT = currentPort.toString();
    }).on('error', (error) => {
      if (error.code === 'EADDRINUSE' && process.env.NODE_ENV !== "production") {
        log(`Port ${currentPort} is already in use, trying next port...`);
        startServer(portIndex + 1);
      } else {
        log(`Fatal error during server startup: ${error}`);
        process.exit(1);
      }
    });
    };
    
    // Start attempting to connect with the first port
    startServer();
  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    process.exit(1);
  }
})();
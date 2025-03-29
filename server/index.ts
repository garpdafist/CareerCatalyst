import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cookieParser from 'cookie-parser';
import {
  addSecurityHeaders,
  generalLimiter,
  handleCSRFError,
  requestId,
  apiLogger,
  errorLogger,
} from './middleware';

const app = express();

// Apply security headers first to ensure they're set for all responses
app.use(addSecurityHeaders);

// Parse cookies, needed for CSRF protection
app.use(cookieParser());

// Generate unique request ID for each request (for tracing/debugging)
app.use(requestId);

// Apply general rate limiting
app.use('/api', generalLimiter);

// Increase JSON payload size limit to 50MB
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Enhanced API request logger
app.use('/api', apiLogger);

// Legacy logging middleware (can be removed once API logger is fully tested)
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

    // Handle CSRF errors first
    app.use(handleCSRFError);
    
    // Log errors before handling them
    app.use(errorLogger);
    
    // Enhanced global error handler with improved security
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      log(`Error: ${err.message}`);
      const status = err.status || err.statusCode || 500;
      
      // Don't expose error details in production
      const message = process.env.NODE_ENV === 'production' && status === 500
        ? "An unexpected error occurred"
        : err.message || "Internal Server Error";
      
      // Include sanitized error information
      res.status(status).json({
        status: 'error',
        message,
        requestId: (req as any).id,
        code: err.code,
        // Only include stack trace in development
        ...(process.env.NODE_ENV !== 'production' ? {
          stack: err.stack,
          details: err.details
        } : {})
      });
    });

    // Serve static files in production
    if (process.env.NODE_ENV === "production") {
      log("Setting up static file serving for production");
      serveStatic(app);
    } else {
      log("Setting up Vite development server");
      await setupVite(app, server);
    }

    // Use a dynamic port assignment strategy
    const attemptPortBinding = (startPort: number) => {
      const tryPort = (port: number): Promise<number> => {
        return new Promise((resolve, reject) => {
          import('http').then(http => {
            const testServer = http.createServer();
            testServer.once('error', (err: any) => {
              if (err.code === 'EADDRINUSE') {
                log(`Port ${port} is in use, trying next port...`);
                resolve(tryPort(port + 1)); // Try next port
              } else {
                reject(err);
              }
            });
            testServer.once('listening', () => {
              testServer.close(() => {
                resolve(port);
              });
            });
            testServer.listen(port, '0.0.0.0');
          }).catch(reject);
        });
      };

      return tryPort(startPort);
    };

    // Find an available port starting with environment PORT or 5000
    const startPort = parseInt(process.env.PORT || '5000', 10);

    attemptPortBinding(startPort)
      .then(PORT => {
        log(`Starting server on port ${PORT} (process.env.PORT=${process.env.PORT}, NODE_ENV=${process.env.NODE_ENV})`);

        server.listen({
          port: PORT,
          host: "0.0.0.0"
        }, () => {
          log(`🚀 Server running at http://0.0.0.0:${PORT}`);
          // Print additional debug info about the server
          log(`Server info: Node ${process.version}, Express routes: ${
            Object.keys(app._router.stack
              .filter((r: any) => r.route)
              .map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`)
            )
          }`);
          // Set environment variable with the actual port for client reference
          process.env.ACTUAL_PORT = PORT.toString();
        });
      })
      .catch(error => {
        log(`Fatal error during port selection: ${error}`);
        process.exit(1);
      });
  } catch (error) {
    log(`Fatal error during server startup: ${error}`);
    process.exit(1);
  }
})();
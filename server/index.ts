import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { seedCategories } from "./seed-categories"; // Add this import
import { seedMuscleGroups } from "./seed-muscle-groups";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

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
  // Initialize storage and seed categories
  try {
    const storage = await getStorage();
    await storage.ensureInitialized();
    await seedCategories(); // Add this line
    await seedMuscleGroups(); // Add muscle groups seeding
    log("Database initialized, categories and muscle groups seeded");
  } catch (error) {
    log(`Failed to initialize database: ${error}`, "error");
  }

  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    // Don't send error response if headers already sent (like during authentication redirects)
    if (res.headersSent) {
      return;
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log(`ERROR: ${status} - ${message}`, "error");
    log(err.stack, "error");

    res.status(status).json({ message });
  });

  // Serve static assets in both development and production
  app.use(express.static("public"));

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 3000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 3000;
  server.listen({
    port,
    host: "localhost"
    // removed reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();

// Fix the goal photo routes (move them inside the registerRoutes function)
// Remove the standalone routes at the bottom and add them to routes.ts instead

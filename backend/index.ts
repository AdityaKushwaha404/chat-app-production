import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import conversationsRoutes from "./routes/conversations.routes.js";
import groupsRoutes from "./routes/groups.routes.js";
import keepAliveRoutes from "./routes/keepAlive.routes.js";
import { initializeSocket } from "./socket.js";
import { scheduleKeepAlive } from "./utils/keepAlive.js";
import messagesRoutes from "./routes/messages.routes.js";

dotenv.config();

const app = express();

/* Middlewares */
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
});

// Health endpoint for platform load balancers (Render) and uptime checks
app.get("/health", async (req, res) => {
  try {
    const mongoose = (await import("mongoose")).default;
    const state = mongoose.connection.readyState; // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    return res.status(200).json({ status: "ok", mongoState: state });
  } catch (err) {
    return res.status(500).json({ status: "error", error: String(err) });
  }
});

// Always prefer the platform-provided port. Fallback to 3000 for local dev when not provided.
const PORT = Number(process.env.PORT) || 3000;

const server = http.createServer(app);

// Helper to wait for mongoose connection to be fully open
async function waitForMongoConnected(timeoutMs = 10000) {
  // connectDB() already calls mongoose.connect and returns when connected, but add a defensive check
  const mongoose = (await import("mongoose")).default;
  if (mongoose.connection.readyState === 1) return;
  return new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (err: any) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      mongoose.connection.off("error", onError as any);
      mongoose.connection.off("open", onOpen as any);
    };
    mongoose.connection.once("open", onOpen as any);
    mongoose.connection.once("error", onError as any);
    setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for MongoDB connection"));
    }, timeoutMs);
  });
}

// Retry logic for binding to a port that's temporarily busy
async function listenWithRetries(server: http.Server, port: number, maxAttempts = 5, baseDelayMs = 500) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", (err: any) => reject(err));
        server.listen(port, () => resolve());
      });
      console.log(`Server is running on port ${port} (env PORT=${process.env.PORT || "<not-set>"})`);
      return; // success
    } catch (err: any) {
      if (err && err.code === "EADDRINUSE") {
        console.warn(`Port ${port} is in use (attempt ${attempt}/${maxAttempts}), retrying...`);
        // exponential backoff
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed to bind to port ${port} after ${maxAttempts} attempts`);
}

let shuttingDown = false;

function setupGracefulShutdown(server: http.Server) {
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal} - shutting down gracefully`);
    try {
      // stop accepting new connections
      server.close((err) => {
        if (err) console.error("Error closing server:", err);
        else console.log("HTTP server closed");
        // close mongoose connection
        (async () => {
          try {
            const mongoose = (await import("mongoose")).default;
            await mongoose.disconnect();
            console.log("MongoDB disconnected");
          } catch (e) {
            console.warn("Error during mongoose.disconnect():", e);
          } finally {
            process.exit(0);
          }
        })();
      });
      // force exit after timeout
      setTimeout(() => {
        console.warn("Force exiting after shutdown timeout");
        process.exit(1);
      }, 10000).unref();
    } catch (e) {
      console.error("Error during shutdown:", e);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Main startup flow: connect to DB, wait for full open, then listen with retries
(async () => {
  try {
    await connectDB();
    await waitForMongoConnected(10000);

    // Start server with retry logic in case port is in transient use
    await listenWithRetries(server, PORT, 6, 300);

    // initialize socket server
    try {
      const io = initializeSocket(server as any);
      console.log("Socket server initialized");
    } catch (err) {
      console.warn("Failed to initialize socket server:", err);
    }

    // Schedule keep-alive ping job to keep MongoDB Atlas from sleeping
    try {
      const endpoint = process.env.KEEP_ALIVE_ENDPOINT || `http://localhost:${PORT}/api/keep-alive`;
      scheduleKeepAlive(endpoint);
    } catch (err) {
      console.warn("Failed to schedule keep-alive job:", err);
    }

    setupGracefulShutdown(server);
  } catch (error) {
    console.error("Startup failed:", error);
    // If we fail to start, don't crash ungracefully in production — exit with non-zero to let the host restart
    process.exit(1);
  }
})();

// Mount auth routes
app.use('/api/auth', authRoutes);

// Mount keep-alive route (simple DB ping)
app.use('/api/keep-alive', keepAliveRoutes);

// Mount users and conversations
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/groups', groupsRoutes);





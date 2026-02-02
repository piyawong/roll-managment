export async function register() {
  // Only run on server side (Node.js runtime, not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] 🚀 Server starting...");

    try {
      // Dynamic import to avoid loading in Edge runtime
      const { startThumbnailWatcher } = await import("./lib/thumbnailWatcher");
      startThumbnailWatcher();
      console.log("[Instrumentation] ✅ Thumbnail watcher started");
    } catch (error) {
      console.error("[Instrumentation] ⚠️  Failed to start thumbnail watcher:", error);
    }

    console.log("[Instrumentation] ✅ Server initialization complete");
  }
}

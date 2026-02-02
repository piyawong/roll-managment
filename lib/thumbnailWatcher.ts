import chokidar, { type FSWatcher } from "chokidar";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, ".thumbnails");

// Helper function to create thumbnail
async function createThumbnail(sourceImagePath: string, thumbnailPath: string) {
  try {
    const imageBuffer = await fs.readFile(sourceImagePath);
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(400, 600, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
    await fs.writeFile(thumbnailPath, thumbnailBuffer);
    console.log(`[Thumbnail Watcher] ✓ Created thumbnail: ${path.basename(thumbnailPath)}`);
    return true;
  } catch (error) {
    console.error(`[Thumbnail Watcher] ✗ Error creating thumbnail:`, error);
    return false;
  }
}

// Start watching pending folders for all clients
export function startThumbnailWatcher() {
  // Watch all client pending folders: uploads/*/pending/*.{jpg,jpeg,png,gif,webp}
  const watchPattern = path.join(UPLOADS_DIR, "*/pending/*.{jpg,jpeg,png,gif,webp,JPG,JPEG,PNG,GIF,WEBP}");

  console.log("[Thumbnail Watcher] 🔍 Starting thumbnail watcher...");
  console.log("[Thumbnail Watcher] 📂 Watching:", watchPattern);

  const watcher = chokidar.watch(watchPattern, {
    persistent: true,
    ignoreInitial: true, // Don't process existing files on startup (we have manual script for that)
    awaitWriteFinish: {
      stabilityThreshold: 500, // Wait 500ms after file stops changing
      pollInterval: 100,
    },
    usePolling: false, // Use native fs.watch for better performance
    interval: 100,
  });

  watcher
    .on("add", async (filePath: string) => {
      console.log(`[Thumbnail Watcher] 🔔 File event: ${filePath}`);

      // Extract client ID from path
      const relativePath = path.relative(UPLOADS_DIR, filePath);
      const parts = relativePath.split(path.sep);
      const clientId = parts[0];
      const fileName = path.basename(filePath);

      // Check if it's a valid image file
      if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)) {
        console.log(`[Thumbnail Watcher] ⏭️  Skipping non-image file: ${fileName}`);
        return;
      }

      console.log(`[Thumbnail Watcher] 📸 New file detected: Client ${clientId} - ${fileName}`);

      // Generate thumbnail path
      const thumbnailPath = path.join(THUMBNAILS_DIR, clientId, "pending", `thumb_${fileName}`);

      // Check if thumbnail already exists
      try {
        await fs.access(thumbnailPath);
        console.log(`[Thumbnail Watcher] ⏭️  Thumbnail already exists, skipping: ${fileName}`);
        return;
      } catch {
        // Thumbnail doesn't exist, create it
      }

      // Create thumbnail
      await createThumbnail(filePath, thumbnailPath);
    })
    .on("ready", () => {
      console.log("[Thumbnail Watcher] ✅ Thumbnail watcher is ready and monitoring");
      console.log("[Thumbnail Watcher] 💡 Waiting for new files...");
    })
    .on("error", (error: unknown) => {
      console.error("[Thumbnail Watcher] ❌ Watcher error:", error);
    })
    .on("all", (eventName: string, filePath: string) => {
      console.log(`[Thumbnail Watcher] 🔍 Event: ${eventName} - ${filePath}`);
    });

  return watcher;
}

// Stop watcher (for cleanup)
export function stopThumbnailWatcher(watcher: FSWatcher) {
  console.log("[Thumbnail Watcher] 🛑 Stopping thumbnail watcher...");
  watcher.close();
}

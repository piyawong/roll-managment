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
    return true;
  } catch (error) {
    console.error("Error creating thumbnail:", error);
    return false;
  }
}

async function generateThumbnails() {
  console.log("🔍 Scanning for images without thumbnails...\n");

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  // Process all clients (1-10)
  for (let clientId = 1; clientId <= 10; clientId++) {
    const pendingDir = path.join(UPLOADS_DIR, String(clientId), "pending");

    try {
      // Check if pending directory exists
      await fs.access(pendingDir);
    } catch {
      continue; // Skip if directory doesn't exist
    }

    const files = await fs.readdir(pendingDir);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

    if (imageFiles.length === 0) continue;

    console.log(`📂 Client ${clientId}: Found ${imageFiles.length} images`);

    for (const file of imageFiles) {
      totalProcessed++;
      const sourcePath = path.join(pendingDir, file);
      const thumbnailPath = path.join(THUMBNAILS_DIR, String(clientId), "pending", `thumb_${file}`);

      // Check if thumbnail already exists
      try {
        await fs.access(thumbnailPath);
        totalSkipped++;
        console.log(`  ⏭️  ${file} - thumbnail exists`);
        continue;
      } catch {
        // Thumbnail doesn't exist, create it
      }

      const success = await createThumbnail(sourcePath, thumbnailPath);
      if (success) {
        totalCreated++;
        console.log(`  ✅ ${file} - thumbnail created`);
      } else {
        console.log(`  ❌ ${file} - failed`);
      }
    }
  }

  console.log("\n📊 Summary:");
  console.log(`  Total processed: ${totalProcessed}`);
  console.log(`  Created: ${totalCreated}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log("\n✨ Done!");
}

generateThumbnails().catch(console.error);

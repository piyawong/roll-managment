import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const THUMBNAILS_DIR = path.join(process.cwd(), "uploads", ".thumbnails");

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

// POST: Generate missing thumbnails for all clients
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const type = searchParams.get("type") || "pending"; // pending or completed

  try {
    const stats = {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    };

    // Get list of clients to process
    const clientIds: string[] = [];
    if (clientId) {
      clientIds.push(clientId);
    } else {
      // Process all clients (1-10)
      const uploads = await fs.readdir(UPLOADS_DIR);
      clientIds.push(...uploads.filter(name => /^\d+$/.test(name)));
    }

    console.log(`[Generate Thumbnails] Processing ${clientIds.length} clients, type: ${type}`);

    for (const cId of clientIds) {
      const sourceDir = path.join(UPLOADS_DIR, cId, type);

      try {
        // Check if source directory exists
        await fs.access(sourceDir);
      } catch {
        console.log(`[Generate Thumbnails] Skipping client ${cId}/${type} - directory not found`);
        continue;
      }

      // For completed type, we need to process each folder
      if (type === "completed") {
        const folders = await fs.readdir(sourceDir);
        for (const folder of folders) {
          if (folder.startsWith(".")) continue;

          const folderPath = path.join(sourceDir, folder);
          const stat = await fs.stat(folderPath);
          if (!stat.isDirectory()) continue;

          const files = await fs.readdir(folderPath);
          for (const file of files) {
            if (file.startsWith(".") || !/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) continue;

            stats.processed++;
            const sourcePath = path.join(folderPath, file);
            const thumbnailPath = path.join(THUMBNAILS_DIR, cId, type, folder, `thumb_${file}`);

            // Check if thumbnail already exists
            try {
              await fs.access(thumbnailPath);
              stats.skipped++;
              console.log(`[Generate Thumbnails] Skipped ${cId}/${type}/${folder}/${file} - thumbnail exists`);
              continue;
            } catch {
              // Thumbnail doesn't exist, create it
            }

            const success = await createThumbnail(sourcePath, thumbnailPath);
            if (success) {
              stats.created++;
              console.log(`[Generate Thumbnails] Created ${cId}/${type}/${folder}/${file}`);
            } else {
              stats.errors++;
            }
          }
        }
      } else {
        // For pending type, process files directly
        const files = await fs.readdir(sourceDir);
        for (const file of files) {
          if (file.startsWith(".") || !/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) continue;

          stats.processed++;
          const sourcePath = path.join(sourceDir, file);
          const thumbnailPath = path.join(THUMBNAILS_DIR, cId, type, `thumb_${file}`);

          // Check if thumbnail already exists
          try {
            await fs.access(thumbnailPath);
            stats.skipped++;
            console.log(`[Generate Thumbnails] Skipped ${cId}/${type}/${file} - thumbnail exists`);
            continue;
          } catch {
            // Thumbnail doesn't exist, create it
          }

          const success = await createThumbnail(sourcePath, thumbnailPath);
          if (success) {
            stats.created++;
            console.log(`[Generate Thumbnails] Created ${cId}/${type}/${file}`);
          } else {
            stats.errors++;
          }
        }
      }
    }

    console.log(`[Generate Thumbnails] Complete:`, stats);

    return NextResponse.json({
      success: true,
      message: `สร้าง thumbnail เรียบร้อย`,
      stats,
    });
  } catch (error) {
    console.error("[Generate Thumbnails] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate thumbnails", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

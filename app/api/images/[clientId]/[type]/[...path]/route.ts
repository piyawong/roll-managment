import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const THUMBNAILS_DIR = path.join(process.cwd(), "uploads", ".thumbnails");

// GET: Serve images with optional thumbnail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; type: string; path: string[] }> }
) {
  const { clientId, type, path: pathSegments } = await params;
  const searchParams = request.nextUrl.searchParams;
  const thumbnail = searchParams.get("thumbnail") === "true";

  // Validate type
  if (type !== "pending" && type !== "completed") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  // Build file path
  const filePath = path.join(UPLOADS_DIR, clientId, type, ...pathSegments);

  try {
    // Check if file exists
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);

    if (!isImage) {
      return NextResponse.json({ error: "Not an image file" }, { status: 400 });
    }

    // If thumbnail requested, serve cached thumbnail
    if (thumbnail) {
      const thumbnailPath = path.join(
        THUMBNAILS_DIR,
        clientId,
        type,
        ...pathSegments.slice(0, -1),
        `thumb_${pathSegments[pathSegments.length - 1]}`
      );

      try {
        // Try to serve cached thumbnail
        const thumbnailBuffer = await fs.readFile(thumbnailPath);

        // Set cache headers based on type
        const cacheControl = type === "pending"
          ? "public, max-age=60" // Cache 1 minute for pending (short cache)
          : "public, max-age=31536000, immutable"; // Cache 1 year for completed

        return new NextResponse(new Uint8Array(thumbnailBuffer), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": cacheControl,
          },
        });
      } catch {
        // Thumbnail not found, fallback to generating it on-the-fly
        try {
          const imageBuffer = await fs.readFile(filePath);
          const thumbnailBuffer = await sharp(imageBuffer)
            .resize(400, 600, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality: 80 })
            .toBuffer();

          // Don't cache - thumbnail should have been created during upload/move
          return new NextResponse(new Uint8Array(thumbnailBuffer), {
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        } catch (error) {
          console.error("Error generating thumbnail:", error);
          // Fallback to original image if thumbnail generation fails
        }
      }
    }

    // Serve original image
    const imageBuffer = await fs.readFile(filePath);
    const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
                        ext === ".png" ? "image/png" :
                        ext === ".gif" ? "image/gif" :
                        ext === ".webp" ? "image/webp" : "image/jpeg";

    // Set appropriate cache headers based on type
    // Pending images: short cache (1 minute)
    // Completed images: long cache (1 year, immutable)
    const cacheControl = type === "pending"
      ? "public, max-age=60"
      : "public, max-age=31536000, immutable";

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    console.error("Error serving image:", error);
    return NextResponse.json(
      { error: "Image not found" },
      { status: 404 }
    );
  }
}

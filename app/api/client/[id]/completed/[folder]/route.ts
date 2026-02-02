import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folder: string }> }
) {
  try {
    const { id, folder } = await params;
    const folderPath = path.join(UPLOADS_DIR, id, "completed", folder);

    // Check if folder exists
    try {
      await fs.access(folderPath);
    } catch {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Read all files in the folder
    const files = await fs.readdir(folderPath);

    // Filter only .jpeg and .jpg files and sort by number
    const imageFiles = files
      .filter(file => file.match(/^\d+\.(jpeg|jpg)$/i))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\.(jpeg|jpg)$/i, ''));
        const numB = parseInt(b.replace(/\.(jpeg|jpg)$/i, ''));
        return numA - numB;
      });

    return NextResponse.json({ files: imageFiles });
  } catch (error) {
    console.error("Error reading completed folder:", error);
    return NextResponse.json(
      { error: "Failed to read folder" },
      { status: 500 }
    );
  }
}

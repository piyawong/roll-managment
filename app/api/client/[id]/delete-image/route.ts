import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const THUMBNAILS_DIR = path.join(process.cwd(), "uploads", ".thumbnails");

// DELETE: ลบรูปภาพเฉพาะรูป (ทั้งต้นฉบับและ thumbnail)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json(
      { error: "Filename is required" },
      { status: 400 }
    );
  }

  const pendingDir = path.join(UPLOADS_DIR, id, "pending");
  const filePath = path.join(pendingDir, filename);
  const thumbnailPath = path.join(THUMBNAILS_DIR, id, "pending", `thumb_${filename}`);

  try {
    // ตรวจสอบว่าไฟล์มีอยู่จริง
    await fs.access(filePath);

    // ลบไฟล์ต้นฉบับ
    await fs.unlink(filePath);
    console.log(`[Delete Image] ลบรูปภาพ ${filename} จาก client ${id}`);

    // ลบ thumbnail (ถ้ามี)
    try {
      await fs.unlink(thumbnailPath);
      console.log(`[Delete Image] ลบ thumbnail thumb_${filename} จาก client ${id}`);
    } catch {
      // Thumbnail อาจไม่มี ไม่ต้อง error
      console.log(`[Delete Image] ไม่มี thumbnail สำหรับ ${filename}`);
    }

    return NextResponse.json({
      success: true,
      message: `ลบรูปภาพ ${filename} สำเร็จ`,
      filename,
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}

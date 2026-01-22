import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "public/uploads");

// DELETE: ลบรูปภาพเฉพาะรูป
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

  try {
    // ตรวจสอบว่าไฟล์มีอยู่จริง
    await fs.access(filePath);

    // ลบไฟล์
    await fs.unlink(filePath);

    console.log(`[Delete Image] ลบรูปภาพ ${filename} จาก client ${id}`);

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

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "public/uploads");

// GET: ดึงข้อมูล pending files และ completed folders
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientDir = path.join(UPLOADS_DIR, id);

  try {
    // ดึง pending files
    const pendingDir = path.join(clientDir, "pending");
    let pendingFiles: { name: string; createdAt: number }[] = [];

    try {
      const files = await fs.readdir(pendingDir);
      const fileStats = await Promise.all(
        files
          .filter((f) => !f.startsWith("."))
          .map(async (file) => {
            const stat = await fs.stat(path.join(pendingDir, file));
            return {
              name: file,
              createdAt: stat.birthtimeMs,
            };
          })
      );
      pendingFiles = fileStats.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      // pending folder อาจไม่มี
    }

    // ดึง completed folders
    const completedDir = path.join(clientDir, "completed");
    let completedFolders: { name: string; fileCount: number }[] = [];

    try {
      const folders = await fs.readdir(completedDir);
      completedFolders = await Promise.all(
        folders
          .filter((f) => !f.startsWith("."))
          .map(async (folder) => {
            const folderPath = path.join(completedDir, folder);
            const stat = await fs.stat(folderPath);
            if (stat.isDirectory()) {
              const files = await fs.readdir(folderPath);
              return {
                name: folder,
                fileCount: files.filter((f) => !f.startsWith(".")).length,
              };
            }
            return null;
          })
      ).then((results) => results.filter(Boolean) as { name: string; fileCount: number }[]);
    } catch {
      // completed folder อาจไม่มี
    }

    return NextResponse.json({
      clientId: id,
      pending: pendingFiles,
      completed: completedFolders,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read client directory" },
      { status: 500 }
    );
  }
}

// POST: Finish - สร้าง folder ใหม่และย้ายไฟล์จาก pending
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  console.log(`[POST /api/client/${id}] Start processing...`);
  console.log(`[POST /api/client/${id}] Body:`, JSON.stringify(body));

  let folderName: string;

  // ตรวจสอบว่าเป็น request แบบใหม่ (มี districtOfficeName) หรือแบบเก่า (มี folderName)
  if (body.districtOfficeName) {
    // แบบใหม่: สร้าง folder name จากข้อมูลองค์กร
    const { districtOfficeName, orderNumber, name, type, registrationNumber } = body;

    if (!districtOfficeName || !orderNumber || !name || !registrationNumber) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบถ้วน (ต้องมี สำนักงานเขต, เลขลำดับ, ชื่อ, เลข กท)" },
        { status: 400 }
      );
    }

    // สร้าง folder name ตาม format: {สำนักงานเขต}-{เลขลำดับ}-{ชื่อ}-{เลขกท}
    const parts = [
      districtOfficeName.trim(),
      orderNumber.toString(),
      name.trim(),
      registrationNumber.trim(),
    ];
    folderName = parts.join("-");

    // ยิง API ไปที่ portal server
    console.log(`[POST /api/client/${id}] === Registering Organization to Portal ===`);
    console.log(`[POST /api/client/${id}] Timestamp:`, new Date().toISOString());
    console.log(`[POST /api/client/${id}] Portal URL:`, "http://46.250.238.125:4004/organizations/register");
    console.log(`[POST /api/client/${id}] Request Data:`, {
      districtOfficeName: districtOfficeName.trim(),
      orderNumber: orderNumber || undefined,
      name: name.trim(),
      type: type || "มูลนิธิ",
      registrationNumber: registrationNumber.trim(),
      isActive: true,
    });

    try {
      const registerResponse = await fetch("http://46.250.238.125:4004/organizations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtOfficeName: districtOfficeName.trim(),
          orderNumber: orderNumber || undefined,
          name: name.trim(),
          type: type || "มูลนิธิ",
          registrationNumber: registrationNumber.trim(),
          isActive: true,
        }),
      });

      console.log(`[POST /api/client/${id}] Portal Response Status:`, registerResponse.status);
      console.log(`[POST /api/client/${id}] Portal Response OK:`, registerResponse.ok);

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json();
        console.error(`[POST /api/client/${id}] === Portal Registration Failed ===`);
        console.error(`[POST /api/client/${id}] Status:`, registerResponse.status);
        console.error(`[POST /api/client/${id}] Error Data:`, errorData);
        console.error(`[POST /api/client/${id}] =====================================`);
        return NextResponse.json(
          { error: `ไม่สามารถลงทะเบียนองค์กรที่ Portal ได้: ${errorData.message || errorData.error || 'Unknown error'}`, details: errorData },
          { status: 500 }
        );
      }

      const registerResult = await registerResponse.json();
      console.log(`[POST /api/client/${id}] === Portal Registration Success ===`);
      console.log(`[POST /api/client/${id}] Result:`, registerResult);
      console.log(`[POST /api/client/${id}] ===================================`);
    } catch (error) {
      console.error(`[POST /api/client/${id}] === Portal Connection Error ===`);
      console.error(`[POST /api/client/${id}] Error:`, error);
      console.error(`[POST /api/client/${id}] Error Type:`, error instanceof Error ? error.constructor.name : typeof error);
      console.error(`[POST /api/client/${id}] Error Message:`, error instanceof Error ? error.message : String(error));
      console.error(`[POST /api/client/${id}] ==============================`);
      return NextResponse.json(
        { error: `เกิดข้อผิดพลาดในการเชื่อมต่อกับ Portal: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } else {
    // แบบเก่า: ใช้ folderName โดยตรง
    folderName = body.folderName;

    if (!folderName || !folderName.trim()) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    folderName = folderName.trim();
  }

  const clientDir = path.join(UPLOADS_DIR, id);
  const pendingDir = path.join(clientDir, "pending");
  const completedDir = path.join(clientDir, "completed");
  const targetDir = path.join(completedDir, folderName);

  try {
    // ตรวจสอบว่ามี pending files หรือไม่
    const files = await fs.readdir(pendingDir);
    const imageFiles = files.filter(
      (f) => !f.startsWith(".") && /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: "No pending files to process" },
        { status: 400 }
      );
    }

    // ดึง stat ของแต่ละไฟล์และเรียงตาม created time (เก่าสุดก่อน)
    const fileStats = await Promise.all(
      imageFiles.map(async (file) => {
        const stat = await fs.stat(path.join(pendingDir, file));
        return {
          name: file,
          createdAt: stat.birthtimeMs,
          ext: path.extname(file),
        };
      })
    );

    fileStats.sort((a, b) => a.createdAt - b.createdAt);

    // สร้าง target folder
    await fs.mkdir(targetDir, { recursive: true });

    // ย้ายและ rename ไฟล์
    for (let i = 0; i < fileStats.length; i++) {
      const file = fileStats[i];
      const newName = `${i + 1}${file.ext}`;
      const sourcePath = path.join(pendingDir, file.name);
      const targetPath = path.join(targetDir, newName);

      await fs.rename(sourcePath, targetPath);
    }

    // ลบ file.txt (metadata) เมื่อย้ายไฟล์ทั้งหมดแล้ว
    const metadataPath = path.join(pendingDir, "file.txt");
    try {
      await fs.unlink(metadataPath);
    } catch {
      // file.txt อาจไม่มี
    }

    console.log(`[POST /api/client/${id}] Success! Folder: ${folderName}, Files: ${fileStats.length}`);
    return NextResponse.json({
      success: true,
      folderName: folderName.trim(),
      filesProcessed: fileStats.length,
    });
  } catch (error) {
    console.error(`[POST /api/client/${id}] Error processing files:`, error);
    console.error(`[POST /api/client/${id}] Error type:`, error instanceof Error ? error.constructor.name : typeof error);
    console.error(`[POST /api/client/${id}] Error message:`, error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Failed to process files", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Clear pending files
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pendingDir = path.join(UPLOADS_DIR, id, "pending");

  try {
    const files = await fs.readdir(pendingDir);
    const imageFiles = files.filter(
      (f) => !f.startsWith(".") && /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );

    if (imageFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "ไม่มีไฟล์ใน pending",
        deletedCount: 0,
      });
    }

    // ลบไฟล์ทั้งหมด
    await Promise.all(
      imageFiles.map((file) => fs.unlink(path.join(pendingDir, file)))
    );

    // ลบ file.txt (metadata) ด้วย
    const metadataPath = path.join(pendingDir, "file.txt");
    try {
      await fs.unlink(metadataPath);
      console.log(`[Clear] ลบ file.txt metadata`);
    } catch {
      // file.txt อาจไม่มี
    }

    console.log(`[Clear] ลบไฟล์ใน pending ของ client ${id}: ${imageFiles.length} ไฟล์`);

    return NextResponse.json({
      success: true,
      message: `ลบไฟล์สำเร็จ ${imageFiles.length} ไฟล์`,
      deletedCount: imageFiles.length,
    });
  } catch (error) {
    console.error("Error clearing pending files:", error);
    return NextResponse.json(
      { error: "Failed to clear pending files" },
      { status: 500 }
    );
  }
}

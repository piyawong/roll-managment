import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const BASE_UPLOAD_DIR = path.join(process.cwd(), "uploads");
const THUMBNAIL_DIR = path.join(BASE_UPLOAD_DIR, ".thumbnails");

interface SyncResult {
  client: string;
  type: "pending" | "completed";
  deleted: string[];
  kept: string[];
  errors: string[];
}

interface SyncStats {
  totalScanned: number;
  totalDeleted: number;
  totalKept: number;
  totalErrors: number;
  results: SyncResult[];
}

/**
 * ตรวจสอบว่าไฟล์ต้นฉบับยังมีอยู่หรือไม่
 */
async function originalFileExists(
  clientId: string,
  type: "pending" | "completed",
  thumbnailRelativePath: string
): Promise<boolean> {
  try {
    // แปลง thumb_filename เป็น filename
    const filename = thumbnailRelativePath.replace(/^thumb_/, "");
    const originalPath = path.join(BASE_UPLOAD_DIR, clientId, type, filename);

    await fs.access(originalPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * สแกนและลบ thumbnails ที่ไม่มีไฟล์ต้นฉบับในโฟลเดอร์ pending
 */
async function syncPendingThumbnails(clientId: string): Promise<SyncResult> {
  const result: SyncResult = {
    client: clientId,
    type: "pending",
    deleted: [],
    kept: [],
    errors: [],
  };

  const thumbnailPendingDir = path.join(THUMBNAIL_DIR, clientId, "pending");

  try {
    await fs.access(thumbnailPendingDir);
  } catch {
    // ไม่มีโฟลเดอร์ thumbnail pending
    return result;
  }

  try {
    const files = await fs.readdir(thumbnailPendingDir);

    for (const file of files) {
      const thumbnailPath = path.join(thumbnailPendingDir, file);

      try {
        const stat = await fs.stat(thumbnailPath);
        if (!stat.isFile()) continue;

        // ตรวจสอบว่าไฟล์ต้นฉบับยังมีอยู่หรือไม่
        const exists = await originalFileExists(clientId, "pending", file);

        if (!exists) {
          // ลบ thumbnail
          await fs.unlink(thumbnailPath);
          result.deleted.push(file);
        } else {
          result.kept.push(file);
        }
      } catch (error) {
        result.errors.push(
          `Error processing ${file}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  } catch (error) {
    result.errors.push(
      `Error reading pending directory: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return result;
}

/**
 * สแกนและลบ thumbnails ที่ไม่มีไฟล์ต้นฉบับในโฟลเดอร์ completed (recursive)
 */
async function syncCompletedThumbnails(clientId: string): Promise<SyncResult> {
  const result: SyncResult = {
    client: clientId,
    type: "completed",
    deleted: [],
    kept: [],
    errors: [],
  };

  const thumbnailCompletedDir = path.join(THUMBNAIL_DIR, clientId, "completed");

  try {
    await fs.access(thumbnailCompletedDir);
  } catch {
    // ไม่มีโฟลเดอร์ thumbnail completed
    return result;
  }

  /**
   * สแกนโฟลเดอร์แบบ recursive
   */
  async function scanDirectory(dir: string, relativePath: string = "") {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = relativePath
          ? path.join(relativePath, entry.name)
          : entry.name;

        if (entry.isDirectory()) {
          // สแกนโฟลเดอร์ย่อย
          await scanDirectory(fullPath, relPath);
        } else if (entry.isFile()) {
          try {
            // ตรวจสอบว่าไฟล์ต้นฉบับยังมีอยู่หรือไม่
            const exists = await originalFileExists(clientId, "completed", relPath);

            if (!exists) {
              // ลบ thumbnail
              await fs.unlink(fullPath);
              result.deleted.push(relPath);
            } else {
              result.kept.push(relPath);
            }
          } catch (error) {
            result.errors.push(
              `Error processing ${relPath}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      }
    } catch (error) {
      result.errors.push(
        `Error scanning directory ${dir}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  await scanDirectory(thumbnailCompletedDir);

  return result;
}

/**
 * ลบโฟลเดอร์ว่างทั้งหมด (cleanup)
 */
async function cleanupEmptyDirectories(dir: string): Promise<number> {
  let deletedCount = 0;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);
        deletedCount += await cleanupEmptyDirectories(fullPath);
      }
    }

    // ตรวจสอบว่าโฟลเดอร์นี้ว่างหรือไม่
    const remainingEntries = await fs.readdir(dir);
    if (remainingEntries.length === 0 && dir !== THUMBNAIL_DIR) {
      await fs.rmdir(dir);
      deletedCount++;
    }
  } catch (error) {
    // ไม่ต้อง throw error ถ้าลบโฟลเดอร์ไม่สำเร็จ
  }

  return deletedCount;
}

/**
 * Sync thumbnails สำหรับลูกค้าทั้งหมดหรือลูกค้าที่ระบุ
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clientId = body.clientId; // optional: ถ้าไม่ระบุจะทำทั้งหมด

    const stats: SyncStats = {
      totalScanned: 0,
      totalDeleted: 0,
      totalKept: 0,
      totalErrors: 0,
      results: [],
    };

    // กำหนด clients ที่จะ sync
    const clientsToSync: string[] = [];
    if (clientId) {
      clientsToSync.push(clientId);
    } else {
      // ทำทุก client (1-10)
      for (let i = 1; i <= 10; i++) {
        clientsToSync.push(String(i));
      }
    }

    // Sync แต่ละ client
    for (const client of clientsToSync) {
      // Sync pending
      const pendingResult = await syncPendingThumbnails(client);
      stats.results.push(pendingResult);
      stats.totalDeleted += pendingResult.deleted.length;
      stats.totalKept += pendingResult.kept.length;
      stats.totalErrors += pendingResult.errors.length;

      // Sync completed
      const completedResult = await syncCompletedThumbnails(client);
      stats.results.push(completedResult);
      stats.totalDeleted += completedResult.deleted.length;
      stats.totalKept += completedResult.kept.length;
      stats.totalErrors += completedResult.errors.length;
    }

    stats.totalScanned = stats.totalDeleted + stats.totalKept;

    // ลบโฟลเดอร์ว่างทั้งหมด
    const emptyDirsDeleted = await cleanupEmptyDirectories(THUMBNAIL_DIR);

    return NextResponse.json({
      success: true,
      message: "Thumbnail sync completed",
      stats,
      emptyDirectoriesDeleted: emptyDirsDeleted,
    });
  } catch (error) {
    console.error("Error syncing thumbnails:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

/**
 * GET: ตรวจสอบสถานะ thumbnails (แสดงจำนวนที่จะถูกลบโดยไม่ลบจริง)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    const stats: SyncStats = {
      totalScanned: 0,
      totalDeleted: 0,
      totalKept: 0,
      totalErrors: 0,
      results: [],
    };

    // กำหนด clients ที่จะตรวจสอบ
    const clientsToCheck: string[] = [];
    if (clientId) {
      clientsToCheck.push(clientId);
    } else {
      for (let i = 1; i <= 10; i++) {
        clientsToCheck.push(String(i));
      }
    }

    // ตรวจสอบแต่ละ client โดยไม่ลบจริง
    for (const client of clientsToCheck) {
      // ตรวจสอบ pending
      const thumbnailPendingDir = path.join(THUMBNAIL_DIR, client, "pending");
      try {
        await fs.access(thumbnailPendingDir);
        const files = await fs.readdir(thumbnailPendingDir);

        for (const file of files) {
          const stat = await fs.stat(path.join(thumbnailPendingDir, file));
          if (!stat.isFile()) continue;

          const exists = await originalFileExists(client, "pending", file);
          if (!exists) {
            stats.totalDeleted++;
          } else {
            stats.totalKept++;
          }
        }
      } catch {
        // ไม่มีโฟลเดอร์
      }

      // ตรวจสอบ completed (แบบง่าย ไม่ recursive เพื่อความเร็ว)
      const thumbnailCompletedDir = path.join(
        THUMBNAIL_DIR,
        client,
        "completed"
      );
      try {
        await fs.access(thumbnailCompletedDir);

        async function countDirectory(dir: string, relativePath: string = "") {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = relativePath
              ? path.join(relativePath, entry.name)
              : entry.name;

            if (entry.isDirectory()) {
              await countDirectory(fullPath, relPath);
            } else if (entry.isFile()) {
              const exists = await originalFileExists(client, "completed", relPath);
              if (!exists) {
                stats.totalDeleted++;
              } else {
                stats.totalKept++;
              }
            }
          }
        }

        await countDirectory(thumbnailCompletedDir);
      } catch {
        // ไม่มีโฟลเดอร์
      }
    }

    stats.totalScanned = stats.totalDeleted + stats.totalKept;

    return NextResponse.json({
      success: true,
      message: "Thumbnail check completed (no files were deleted)",
      stats: {
        totalScanned: stats.totalScanned,
        totalOrphaned: stats.totalDeleted,
        totalValid: stats.totalKept,
      },
    });
  } catch (error) {
    console.error("Error checking thumbnails:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

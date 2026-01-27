import { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import chokidar from "chokidar";

const UPLOADS_DIR = path.join(process.cwd(), "public/uploads");

function formatDateTime(date: Date): string {
  const base = date.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const ms = date.getMilliseconds().toString().padStart(3, "0");
  return `${base}.${ms}`;
}

interface FileMetadata {
  [filename: string]: {
    rolledAt: string;
  };
}

async function getMetadataPath(clientId: string): Promise<string> {
  return path.join(UPLOADS_DIR, clientId, "pending", "file.txt");
}

async function readMetadata(clientId: string): Promise<FileMetadata> {
  const metadataPath = await getMetadataPath(clientId);
  try {
    const content = await fs.readFile(metadataPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeMetadata(clientId: string, metadata: FileMetadata): Promise<void> {
  const metadataPath = await getMetadataPath(clientId);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
}

async function addFileMetadata(clientId: string, filename: string): Promise<void> {
  const metadata = await readMetadata(clientId);
  if (!metadata[filename]) {
    metadata[filename] = {
      rolledAt: formatDateTime(new Date()),
    };
    await writeMetadata(clientId, metadata);
    console.log(`[Metadata] เพิ่ม: ${filename} -> ${metadata[filename].rolledAt}`);
  }
}

async function removeFileMetadata(clientId: string, filename: string): Promise<void> {
  const metadata = await readMetadata(clientId);
  if (metadata[filename]) {
    delete metadata[filename];
    await writeMetadata(clientId, metadata);
    console.log(`[Metadata] ลบ: ${filename}`);
  }
}

async function getPendingFiles(clientId: string) {
  const pendingDir = path.join(UPLOADS_DIR, clientId, "pending");
  try {
    const files = await fs.readdir(pendingDir);
    const imageFiles = files.filter(
      (f) => !f.startsWith(".") && f !== "file.txt" && /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );

    const metadata = await readMetadata(clientId);

    const fileStats = await Promise.all(
      imageFiles.map(async (file) => {
        const stat = await fs.stat(path.join(pendingDir, file));
        const createdAt = stat.birthtimeMs;
        // ใช้ rolledAt จาก metadata ถ้ามี ไม่งั้นใช้ file stat
        const rolledAt = metadata[file]?.rolledAt || formatDateTime(new Date(createdAt));
        return {
          name: file,
          createdAt,
          createdAtFormatted: rolledAt,
        };
      })
    );

    return fileStats.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

async function getCompletedFolders(clientId: string) {
  const completedDir = path.join(UPLOADS_DIR, clientId, "completed");
  try {
    const folders = await fs.readdir(completedDir);
    const results = await Promise.all(
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
    );
    return results.filter(Boolean);
  } catch {
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pendingDir = path.join(UPLOADS_DIR, id, "pending");
  const completedDir = path.join(UPLOADS_DIR, id, "completed");

  // สร้าง ReadableStream สำหรับ SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // ส่งข้อมูลเริ่มต้น
      const sendData = async () => {
        const pending = await getPendingFiles(id);
        const completed = await getCompletedFolders(id);
        const data = JSON.stringify({ clientId: id, pending, completed });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // ส่งข้อมูลเริ่มต้นทันที
      await sendData();

      // ใช้ polling แทน chokidar เพื่อหลีกเลี่ยง spawn EBADF error
      console.log("[Watch] Using polling mode (every 2 seconds)");

      let lastPendingHash = "";
      let lastCompletedHash = "";

      const pollingInterval = setInterval(async () => {
        try {
          const pending = await getPendingFiles(id);
          const completed = await getCompletedFolders(id);

          const pendingHash = JSON.stringify(pending.filter(f => f !== null).map(f => f.name).sort());
          const completedHash = JSON.stringify(completed.filter(f => f !== null).map(f => f.name).sort());

          if (pendingHash !== lastPendingHash || completedHash !== lastCompletedHash) {
            lastPendingHash = pendingHash;
            lastCompletedHash = completedHash;
            await sendData();
          }
        } catch (error) {
          console.error("[Watch] Polling error:", error);
        }
      }, 2000);

      // Heartbeat ทุก 30 วิ เพื่อ keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 30000);

      // Cleanup เมื่อ connection ถูกปิด
      request.signal.addEventListener("abort", () => {
        console.log("[Watch] Connection closed");
        clearInterval(heartbeat);
        clearInterval(pollingInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

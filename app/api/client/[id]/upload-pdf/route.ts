import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const UPLOADS_DIR = path.join(process.cwd(), "public/uploads");

interface ProgressEvent {
  type: "progress" | "complete" | "error";
  step?: string;
  current?: number;
  total?: number;
  percent?: number;
  message?: string;
  error?: string;
}

function createProgressStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const send = (event: ProgressEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  const close = () => {
    controller.close();
  };

  return { stream, send, close };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pendingDir = path.join(UPLOADS_DIR, id, "pending");
  const tempDir = path.join(process.cwd(), "tmp");
  const timestamp = Date.now();
  const tempPdfPath = path.join(tempDir, `upload_${timestamp}.pdf`);

  const { stream, send, close } = createProgressStream();

  // Process in background
  (async () => {
    try {
      // Step 1: Receive PDF
      send({
        type: "progress",
        step: "receiving",
        percent: 10,
        message: "กำลังรับไฟล์ PDF...",
      });

      const formData = await request.formData();
      const file = formData.get("pdf") as File | null;

      if (!file) {
        send({ type: "error", error: "No PDF file provided" });
        close();
        return;
      }

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        send({ type: "error", error: "File must be a PDF" });
        close();
        return;
      }

      // Step 2: Save PDF temporarily
      send({
        type: "progress",
        step: "saving",
        percent: 20,
        message: "กำลังบันทึกไฟล์ชั่วคราว...",
      });

      await fs.mkdir(pendingDir, { recursive: true });
      await fs.mkdir(tempDir, { recursive: true });

      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(tempPdfPath, Buffer.from(arrayBuffer));

      // Step 3: Convert PDF to images
      send({
        type: "progress",
        step: "converting",
        percent: 30,
        message: "กำลังแปลง PDF เป็นรูปภาพ...",
      });

      const outputPrefix = path.join(tempDir, `page_${timestamp}`);
      await execAsync(
        `pdftoppm -jpeg -r 150 "${tempPdfPath}" "${outputPrefix}"`
      );

      // Step 4: Find extracted files
      send({
        type: "progress",
        step: "processing",
        percent: 50,
        message: "กำลังประมวลผลหน้าที่แตกออกมา...",
      });

      const tempFiles = await fs.readdir(tempDir);
      const pageFiles = tempFiles
        .filter((f) => f.startsWith(`page_${timestamp}`) && f.endsWith(".jpg"))
        .sort();

      if (pageFiles.length === 0) {
        send({ type: "error", error: "No pages extracted from PDF" });
        // Cleanup
        try {
          await fs.unlink(tempPdfPath);
        } catch {}
        close();
        return;
      }

      const totalPages = pageFiles.length;

      send({
        type: "progress",
        step: "moving",
        percent: 60,
        current: 0,
        total: totalPages,
        message: `พบ ${totalPages} หน้า กำลังบันทึก...`,
      });

      // Step 5: Move files to pending (in order)
      const savedFiles: string[] = [];

      for (let i = 0; i < pageFiles.length; i++) {
        const sourceFile = pageFiles[i];
        const sourcePath = path.join(tempDir, sourceFile);

        const fileTimestamp = Date.now();
        const pageNum = i + 1;
        const fileName = `scan_${fileTimestamp}_page${pageNum}.jpeg`;
        const destPath = path.join(pendingDir, fileName);

        const imageData = await fs.readFile(sourcePath);
        await fs.writeFile(destPath, imageData);

        savedFiles.push(fileName);
        await fs.unlink(sourcePath);

        // Send progress for each page
        const percent = 60 + Math.round((i + 1) / totalPages * 35);
        send({
          type: "progress",
          step: "moving",
          current: i + 1,
          total: totalPages,
          percent,
          message: `กำลังบันทึกหน้า ${i + 1}/${totalPages}...`,
        });

        // Small delay for file timestamp
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Step 6: Cleanup and complete
      await fs.unlink(tempPdfPath);

      send({
        type: "complete",
        percent: 100,
        message: `แตก PDF ${totalPages} หน้าเรียบร้อย`,
      });

      close();
    } catch (error) {
      // Detailed error logging
      console.error("=== PDF Upload Error ===");
      console.error("Timestamp:", new Date().toISOString());
      console.error("Client ID:", id);
      console.error("Error:", error);
      console.error("Error Type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("Error Message:", error instanceof Error ? error.message : String(error));
      console.error("Error Stack:", error instanceof Error ? error.stack : "No stack trace");
      console.error("========================");

      // Cleanup
      try {
        await fs.unlink(tempPdfPath);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.constructor.name : "UnknownError";

      send({
        type: "error",
        error: `[${errorType}] ${errorMessage}`,
      });
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const THUMBNAILS_DIR = path.join(process.cwd(), "uploads", ".thumbnails");

interface ProgressEvent {
  type: "progress" | "complete" | "error";
  step?: string;
  current?: number;
  total?: number;
  percent?: number;
  message?: string;
  error?: string;
}

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
  } catch (error) {
    console.error("Error creating thumbnail:", error);
    // Continue even if thumbnail creation fails
  }
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

      // Get existing files to determine next number
      const existingFiles = await fs.readdir(pendingDir);
      const existingNumbers = existingFiles
        .filter(f => /^\d+\.(jpg|jpeg|png)$/i.test(f))
        .map(f => parseInt(f.replace(/\.(jpg|jpeg|png)$/i, '')))
        .filter(n => !isNaN(n));
      const startNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

      // Step 3: Use pdftoppm if available, fallback to pdf-lib
      send({
        type: "progress",
        step: "converting",
        percent: 30,
        message: "กำลังแปลง PDF เป็นรูปภาพ...",
      });

      let usePdftoppm = false;
      try {
        await execAsync("which pdftoppm");
        usePdftoppm = true;
      } catch {
        // pdftoppm not available, will use pdf-lib
      }

      const savedFiles: string[] = [];
      let totalPages = 0;

      if (usePdftoppm) {
        // Use pdftoppm method
        const outputPrefix = path.join(tempDir, `page_${timestamp}`);
        await execAsync(
          `pdftoppm -jpeg -r 150 "${tempPdfPath}" "${outputPrefix}"`
        );

        const tempFiles = await fs.readdir(tempDir);
        const pageFiles = tempFiles
          .filter((f) => f.startsWith(`page_${timestamp}`) && f.endsWith(".jpg"))
          .sort();

        totalPages = pageFiles.length;

        if (totalPages === 0) {
          send({ type: "error", error: "No pages extracted from PDF" });
          try {
            await fs.unlink(tempPdfPath);
          } catch {}
          close();
          return;
        }

        send({
          type: "progress",
          step: "processing",
          percent: 50,
          current: 0,
          total: totalPages,
          message: `พบ ${totalPages} หน้า กำลังบันทึก...`,
        });

        for (let i = 0; i < pageFiles.length; i++) {
          const sourceFile = pageFiles[i];
          const sourcePath = path.join(tempDir, sourceFile);

          const fileNumber = startNumber + i;
          const fileName = `${String(fileNumber).padStart(4, '0')}.jpeg`;
          const destPath = path.join(pendingDir, fileName);

          const imageData = await fs.readFile(sourcePath);
          await fs.writeFile(destPath, imageData);

          // Create thumbnail
          const thumbnailPath = path.join(THUMBNAILS_DIR, id, "pending", `thumb_${fileName}`);
          await createThumbnail(destPath, thumbnailPath);

          savedFiles.push(fileName);
          await fs.unlink(sourcePath);

          const percent = 50 + Math.round(((i + 1) / totalPages) * 45);
          send({
            type: "progress",
            step: "processing",
            current: i + 1,
            total: totalPages,
            percent,
            message: `กำลังบันทึกหน้า ${i + 1}/${totalPages}...`,
          });

          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } else {
        // Fallback: Use pdf-lib (pure JavaScript)
        const pdfBytes = await fs.readFile(tempPdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        totalPages = pdfDoc.getPageCount();

        if (totalPages === 0) {
          send({ type: "error", error: "PDF has no pages" });
          try {
            await fs.unlink(tempPdfPath);
          } catch {}
          close();
          return;
        }

        send({
          type: "progress",
          step: "processing",
          percent: 50,
          current: 0,
          total: totalPages,
          message: `พบ ${totalPages} หน้า (ใช้ pure JS mode)...`,
        });

        // Extract each page as a separate PDF, then convert with Sharp
        for (let i = 0; i < totalPages; i++) {
          const singlePagePdf = await PDFDocument.create();
          const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
          singlePagePdf.addPage(copiedPage);

          const singlePageBytes = await singlePagePdf.save();

          // Save temp PDF page
          const pagePdfPath = path.join(tempDir, `temp_page_${timestamp}_${i}.pdf`);
          await fs.writeFile(pagePdfPath, singlePageBytes);

          // Convert using ImageMagick's convert command (fallback)
          const fileNumber = startNumber + i;
          const fileName = `${String(fileNumber).padStart(4, '0')}.jpeg`;
          const destPath = path.join(pendingDir, fileName);

          try {
            // Try using ImageMagick convert
            await execAsync(
              `convert -density 150 "${pagePdfPath}" -quality 85 "${destPath}"`
            );
          } catch {
            // If convert fails, just save a placeholder message
            send({
              type: "error",
              error: "PDF conversion failed. Please install poppler-utils (pdftoppm) or ImageMagick (convert):\n\nOn macOS: brew install poppler imagemagick\nOn Ubuntu/Debian: sudo apt-get install poppler-utils imagemagick",
            });
            try {
              await fs.unlink(tempPdfPath);
              await fs.unlink(pagePdfPath);
            } catch {}
            close();
            return;
          }

          // Create thumbnail
          const thumbnailPath = path.join(THUMBNAILS_DIR, id, "pending", `thumb_${fileName}`);
          await createThumbnail(destPath, thumbnailPath);

          savedFiles.push(fileName);
          await fs.unlink(pagePdfPath);

          const percent = 50 + Math.round(((i + 1) / totalPages) * 45);
          send({
            type: "progress",
            step: "processing",
            current: i + 1,
            total: totalPages,
            percent,
            message: `กำลังแปลงหน้า ${i + 1}/${totalPages}...`,
          });

          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Step 7: Cleanup and complete
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

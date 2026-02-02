import fs from 'fs';
import path from 'path';

/**
 * สร้าง directory structure สำหรับ client
 * - uploads/{clientId}/pending
 * - uploads/{clientId}/completed
 * Note: ย้ายจาก public/uploads เป็น uploads (นอก public folder)
 * เพื่อรองรับ production mode และ file watching แบบ real-time
 */
export function ensureClientDirectories(clientId: string) {
  const baseDir = path.join(process.cwd(), 'uploads', clientId);
  const pendingDir = path.join(baseDir, 'pending');
  const completedDir = path.join(baseDir, 'completed');

  // สร้างทั้ง 2 folders พร้อมกัน
  [pendingDir, completedDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });

  return { baseDir, pendingDir, completedDir };
}

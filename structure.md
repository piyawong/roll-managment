# Roll Management System - Project Structure

## Overview
ระบบจัดการม้วนฟิล์ม (Roll Management System) ที่พัฒนาด้วย Next.js สำหรับการสแกน อัปโหลด และจัดการภาพจากม้วนฟิล์มของลูกค้า

## System Workflow

### ภาพรวมการทำงาน
ระบบนี้รันบนเครื่องหลัก (Main Server) และเชื่อมต่อกับเครื่องสแกน 5-10 เครื่อง ผ่านเครือข่าย WiFi เดียวกัน

### การเชื่อมต่อและการทำงาน

```
[Main Server - Port 3001]
         |
         ├── WiFi Network
         |
         ├── Scanner 1 ──> save files to ──> Pending Folder (Client 1)
         ├── Scanner 2 ──> save files to ──> Pending Folder (Client 2)
         ├── Scanner 3 ──> save files to ──> Pending Folder (Client 3)
         ├── Scanner 4 ──> save files to ──> Pending Folder (Client 4)
         ├── Scanner 5 ──> save files to ──> Pending Folder (Client 5)
         ├── Scanner 6 ──> save files to ──> Pending Folder (Client 6)
         ├── Scanner 7 ──> save files to ──> Pending Folder (Client 7)
         ├── Scanner 8 ──> save files to ──> Pending Folder (Client 8)
         ├── Scanner 9 ──> save files to ──> Pending Folder (Client 9)
         └── Scanner 10 ──> save files to ──> Pending Folder (Client 10)
```

### ขั้นตอนการทำงาน

1. **Server Setup**
   - ระบบรันบนเครื่องหลัก (Main Server)
   - เปิด Next.js server บน port 3001 (host: 0.0.0.0)
   - รองรับการเข้าถึงจากอุปกรณ์ในเครือข่าย WiFi เดียวกัน

2. **Scanner Connection**
   - เครื่องสแกน 5-10 เครื่องเชื่อมต่อกับ Main Server ผ่าน WiFi เดียวกัน
   - แต่ละเครื่องสแกนมี endpoint API ของตัวเอง (scanner, scanner-2, ... scanner-10)

3. **User Control**
   - ผู้ใช้/พนักงาน เชื่อมต่อ WiFi เดียวกันกับ Main Server
   - เข้าถึงระบบผ่าน browser: `http://[server-ip]:3001`
   - เลือกเครื่องสแกนที่ต้องการใช้งาน
   - กดปุ่มสั่งสแกน (Scan) ผ่าน Web UI

4. **Scanning Process**
   - เมื่อกดปุ่มสแกน ระบบจะเรียก API endpoint ของเครื่องสแกนนั้นๆ
   - เครื่องสแกนทำการสแกนภาพ
   - ภาพที่สแกนจะถูก save ลงใน **Pending Folder** ของลูกค้าที่กำลังทำงาน

5. **File Management**
   - ระบบใช้ **chokidar** เพื่อ watch การเปลี่ยนแปลงใน Pending Folder แบบ real-time
   - เมื่อมีไฟล์ใหม่เข้ามา ระบบจะแสดงผลทันทีบน Web UI
   - พนักงานสามารถ:
     - ดูภาพที่สแกน
     - อัปโหลด PDF
     - ลบภาพ
     - ทำเครื่องหมายว่าเสร็จสิ้น (Completed)

### Network Architecture
- **Main Server**: รันบนเครื่องหลัก, port 3001
- **WiFi Network**: เชื่อมต่อทุกอุปกรณ์ในระบบ
- **Scanner Devices**: 5-10 เครื่อง, เชื่อมต่อผ่าน WiFi
- **User Devices**: มือถือ/แท็บเล็ต/คอมพิวเตอร์, เชื่อมต่อผ่าน WiFi

### Key Points
- ทุกอุปกรณ์ต้องอยู่ใน WiFi เครือข่ายเดียวกัน
- Main Server เป็นศูนย์กลางในการควบคุมทุกอย่าง
- ผู้ใช้ควบคุมเครื่องสแกนผ่าน Web UI (ไม่ต้องไปจับเครื่องสแกนโดยตรง)
- Pending Folder แยกตามลูกค้า (Client 1-10)

## Image Serving Architecture

### ปัญหาที่แก้ไข
- ใน dev mode Next.js จะ watch `public` folder และ serve ไฟล์ใหม่ได้ทันที
- ใน production mode ไฟล์ใน `public` folder จะถูก copy ตอน build และไม่ watch การเปลี่ยนแปลง
- **Solution**: ย้ายจาก `public/uploads` เป็น `/uploads` (นอก public folder) และสร้าง API route เพื่อ serve images

### Image API Route
**Endpoint**: `/api/images/[clientId]/[type]/[...path]`

**Parameters**:
- `clientId`: 1-10
- `type`: `pending` หรือ `completed`
- `path`: ชื่อไฟล์หรือ `{folder}/{filename}`
- Query param `thumbnail=true`: สร้าง thumbnail แบบ on-the-fly

**ตัวอย่าง**:
```
/api/images/1/pending/image001.jpg?thumbnail=true    # Thumbnail 400x600px
/api/images/1/pending/image001.jpg                    # Full size
/api/images/1/completed/folder-name/1.jpeg            # Completed image
```

### Thumbnail Generation
- ใช้ **sharp** library สำหรับ image optimization
- ขนาด thumbnail: 400x600px (fit inside)
- คุณภาพ: 80% JPEG
- Cache thumbnails ไว้ที่ `/uploads/.thumbnails/` เพื่อประสิทธิภาพ
- Auto-generate เมื่อครั้งแรกที่ request

### Storage Structure
```
uploads/
├── .thumbnails/           # Cached thumbnails (auto-generated)
│   ├── 1/
│   │   ├── pending/
│   │   │   └── thumb_image001.jpg
│   │   └── completed/
│   │       └── folder-name/
│   │           └── thumb_1.jpeg
│   └── 2/...
├── 1/                     # Client 1 uploads
│   ├── pending/          # Images waiting to be processed
│   └── completed/        # Finished folders
│       └── folder-name/
│           ├── 1.jpeg
│           ├── 2.jpeg
│           └── ...
├── 2/                     # Client 2 uploads
└── ...                    # Clients 3-10
```

### Benefits
- ✅ รองรับ production mode โดยไม่ต้อง rebuild
- ✅ Real-time file updates (ไม่ต้อง refresh หรือ rebuild)
- ✅ Thumbnail auto-generation ลดขนาดไฟล์ที่ส่งไปยัง client
- ✅ Cache thumbnails เพื่อประสิทธิภาพ
- ✅ Flexible ต่อการเพิ่มฟีเจอร์ (เช่น watermark, resize, format conversion)

## Technology Stack
- **Framework**: Next.js 16.1.1
- **Runtime**: React 19.2.3
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **PDF Processing**: pdf-lib, pdfjs-dist
- **Image Processing**: canvas, sharp
- **File Watching**: chokidar

## Project Structure

```
roll-managment/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── scanner/              # Scanner 1 (default)
│   │   │   ├── health/          # Health check endpoint
│   │   │   └── scan/            # Scan endpoint
│   │   ├── scanner-2/           # Scanner 2
│   │   ├── scanner-3/           # Scanner 3
│   │   ├── scanner-4/           # Scanner 4
│   │   ├── scanner-5/           # Scanner 5
│   │   ├── scanner-6/           # Scanner 6
│   │   ├── scanner-7/           # Scanner 7
│   │   ├── scanner-8/           # Scanner 8
│   │   ├── scanner-9/           # Scanner 9
│   │   ├── scanner-10/          # Scanner 10
│   │   ├── images/              # Image Serving API Routes
│   │   │   └── [clientId]/[type]/[...path]/   # Dynamic image serving
│   │   │       └── route.ts                    # Serve images with thumbnail support
│   │   └── client/              # Client API Routes
│   │       └── [id]/            # Dynamic client routes
│   │           ├── route.ts                    # Get client data
│   │           ├── watch/                      # File watching endpoint
│   │           ├── completed/[folder]/         # Mark folder as completed
│   │           ├── upload-pdf/                 # Upload PDF
│   │           ├── upload-pdf-to-group/        # Upload PDF to group
│   │           └── delete-image/               # Delete image
│   ├── client/                   # Client Pages
│   │   ├── 1/page.tsx           # Client 1 page
│   │   ├── 2/page.tsx           # Client 2 page
│   │   ├── 3/page.tsx           # Client 3 page
│   │   ├── 4/page.tsx           # Client 4 page
│   │   ├── 5/page.tsx           # Client 5 page
│   │   ├── 6/page.tsx           # Client 6 page
│   │   ├── 7/page.tsx           # Client 7 page
│   │   ├── 8/page.tsx           # Client 8 page
│   │   ├── 9/page.tsx           # Client 9 page
│   │   └── 10/page.tsx          # Client 10 page
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── lib/                          # Utility functions
│   └── ensureClientDirs.ts      # Client directory creation utility
├── public/                       # Static assets
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── uploads/                      # Image storage (outside public folder)
│   ├── .thumbnails/             # Cached thumbnails
│   ├── 1/                       # Client 1 uploads
│   │   ├── pending/            # Pending images
│   │   └── completed/          # Completed folders
│   ├── 2/                       # Client 2 uploads
│   └── ...                      # Clients 3-10
├── claude.md                     # Claude Code instructions
├── structure.md                  # Project structure documentation
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── postcss.config.mjs            # PostCSS configuration
├── eslint.config.mjs             # ESLint configuration
├── exam.md                       # Example/exam documentation
├── request.md                    # Request documentation
└── test.pdf                      # Test PDF file

```

## Key Features

### Scanner System
- รองรับ 10 เครื่องสแกนเนอร์พร้อมกัน (scanner ถึง scanner-10)
- แต่ละเครื่องมี endpoint สำหรับ:
  - **Health Check**: ตรวจสอบสถานะการทำงาน
  - **Scan**: ทำการสแกนภาพ

### Client Management
- รองรับ 10 ลูกค้าพร้อมกัน (client 1-10)
- แต่ละลูกค้ามีหน้าเว็บและ API endpoints ของตัวเอง
- API endpoints สำหรับลูกค้า:
  - **GET /api/client/[id]**: ดึงข้อมูลลูกค้า
  - **POST /api/client/[id]/watch**: ติดตามการเปลี่ยนแปลงไฟล์
  - **POST /api/client/[id]/completed/[folder]**: ทำเครื่องหมายโฟลเดอร์ว่าเสร็จสิ้น
  - **POST /api/client/[id]/upload-pdf**: อัปโหลด PDF
  - **POST /api/client/[id]/upload-pdf-to-group**: อัปโหลด PDF ไปยังกลุ่ม
  - **POST /api/client/[id]/delete-image**: ลบภาพ

### File Processing
- รองรับการประมวลผล PDF (pdf-lib, pdfjs-dist)
- รองรับการประมวลผลภาพ (canvas, sharp)
- ระบบ file watching แบบ real-time (chokidar)

## Development Scripts
- `npm run dev`: รัน development server บน port 3001
- `npm run build`: Build production
- `npm start`: รัน production server บน port 3001
- `npm run lint`: รัน ESLint

## API Architecture
- ใช้ Next.js App Router API Routes
- แต่ละ endpoint มี route handler แยกตามฟังก์ชัน
- รองรับ dynamic routing สำหรับ client และ folder IDs

## Notes
- Server รันบน host 0.0.0.0 port 3001
- รองรับการทำงานพร้อมกันของหลาย scanner และ client

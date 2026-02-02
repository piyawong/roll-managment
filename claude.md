# Claude Code Instructions

## IMPORTANT: อ่านไฟล์นี้ก่อนทุกครั้ง
**กรุณาอ่านไฟล์ `structure.md` ทันทีเมื่อเริ่ม session ใหม่** เพื่อทำความเข้าใจโครงสร้างโปรเจค Roll Management System

## Session Initialization
1. อ่านไฟล์ `structure.md` เป็นอันดับแรก
2. ทำความเข้าใจโครงสร้างโปรเจค API endpoints และ features ทั้งหมด
3. ศึกษาไฟล์เพิ่มเติมตามความจำเป็น

## Project Context
โปรเจคนี้คือระบบจัดการม้วนฟิล์ม (Roll Management System) ที่:
- รองรับ 10 เครื่องสแกนเนอร์พร้อมกัน
- รองรับ 10 ลูกค้าพร้อมกัน
- ใช้ Next.js App Router
- ประมวลผล PDF และภาพ

## Important Files to Read
1. **structure.md** - โครงสร้างโปรเจคและสถาปัตยกรรม
2. **package.json** - Dependencies และ scripts
3. **exam.md** - ตัวอย่างและคำอธิบาย (ถ้ามี)
4. **request.md** - Requirements และ requests (ถ้ามี)

## Development Guidelines
- Server รันบน port 3001
- รองรับการทำงานแบบ concurrent สำหรับหลาย scanner และ client
- ใช้ TypeScript อย่างเคร่งครัด
- ใช้ Tailwind CSS สำหรับ styling

Use subagent if needed
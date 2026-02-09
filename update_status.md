# Machine Status Update API

## Endpoint
```
POST /employee-management/api/machines/status
```

## Description
Upsert (สร้างหรืออัพเดท) สถานะเครื่อง โดยใช้ `machineNumber` เป็น key
ถ้ายังไม่มีเครื่องนี้จะสร้างใหม่ ถ้ามีแล้วจะอัพเดทค่าที่ส่งมา

## Request Body (JSON)
```json
{
  "machineNumber": "1",
  "sheetCount": 15000,
  "bookCount": 300,
  "sheetsPerHour": 250.5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `machineNumber` | string | **Yes** | เลขเครื่อง |
| `sheetCount` | number | No | จำนวนแผ่นของเครื่อง |
| `bookCount` | number | No | จำนวนเล่มของเครื่อง |
| `sheetsPerHour` | number | No | แผ่น/ชั่วโมง |

## Example

### cURL
```bash
curl -X POST https://ocr-flow.piyawong.com/employee-management/api/machines/status \
  -H "Content-Type: application/json" \
  -d '{
    "machineNumber": "01",
    "sheetCount": 15000,
    "bookCount": 300,
    "sheetsPerHour": 250.5
  }'
```

### อัพเดทเฉพาะบางค่า
```bash
# อัพเดทแค่จำนวนแผ่น
curl -X POST https://ocr-flow.piyawong.com/employee-management/api/machines/status \
  -H "Content-Type: application/json" \
  -d '{
    "machineNumber": "1",
    "sheetCount": 20000
  }'

# อัพเดทแค่แผ่น/ชั่วโมง
curl -X POST https://ocr-flow.piyawong.com/employee-management/api/machines/status \
  -H "Content-Type: application/json" \
  -d '{
    "machineNumber": "1",
    "sheetsPerHour": 300
  }'
```

## Response
```json
{
  "id": "cm...",
  "machineNumber": "1",
  "sheetCount": 15000,
  "bookCount": 300,
  "sheetsPerHour": 250.5,
  "createdAt": "2026-02-08T...",
  "updatedAt": "2026-02-08T..."
}
```

## Get All Machines
```
GET /employee-management/api/machines
```

### Response
```json
[
  {
    "id": "cm...",
    "machineNumber": "1",
    "sheetCount": 15000,
    "bookCount": 300,
    "sheetsPerHour": 250.5,
    "createdAt": "2026-02-08T...",
    "updatedAt": "2026-02-08T..."
  }
]
```

## การแสดงผลฝั่ง User
เมื่อพนักงานลงเวลาเข้างานโดยระบุเลขเครื่อง ระบบจะแสดงสถานะเครื่องนั้น (จำนวนแผ่น, จำนวนเล่ม, แผ่น/ชม.) ในหน้าของพนักงานขณะทำงาน

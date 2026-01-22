# Register Organization API

Public endpoint สำหรับลงทะเบียนองค์กรใหม่ (ไม่ต้อง authentication)

## Endpoint

```
POST /organizations/register
```

## Headers

| Header       | Value            |
| ------------ | ---------------- |
| Content-Type | application/json |

## Request Body

| Field              | Type    | Required | Description                         |
| ------------------ | ------- | -------- | ----------------------------------- |
| districtOfficeName | string  | Yes      | สำนักงานเขต (เช่น "สำนักงานเขตจอมทอง") |
| orderNumber        | number  | No       | เลขลำดับ                             |
| name               | string  | Yes      | ชื่อองค์กร/มูลนิธิ/สมาคม              |
| type               | string  | Yes      | ประเภท: "สมาคม" หรือ "มูลนิธิ"        |
| registrationNumber | string  | Yes      | เลข กท. (เช่น "30", "31")            |
| description        | string  | No       | คำอธิบายเพิ่มเติม                     |
| displayOrder       | number  | No       | ลำดับการแสดงผล (default: 0)          |
| isActive           | boolean | No       | เปิด/ปิดการใช้งาน (default: true)    |
| matchedGroupId     | number  | No       | FK to groups.id                     |

## Example Request

```json
{
  "districtOfficeName": "สำนักงานเขตจอมทอง",
  "orderNumber": 1,
  "name": "มูลนิธิจอมทอง",
  "type": "มูลนิธิ",
  "registrationNumber": "30",
  "description": "มูลนิธิเพื่อการกุศลในพื้นที่เขตจอมทอง",
  "displayOrder": 1,
  "isActive": true
}
```

## Response

### Success (201 Created)

```json
{
  "message": "Organization registered successfully",
  "organization": {
    "id": 1,
    "districtOfficeName": "สำนักงานเขตจอมทอง",
    "orderNumber": 1,
    "name": "มูลนิธิจอมทอง",
    "type": "มูลนิธิ",
    "registrationNumber": "30",
    "description": "มูลนิธิเพื่อการกุศลในพื้นที่เขตจอมทอง",
    "displayOrder": 1,
    "isActive": true,
    "matchedGroupId": null,
    "createdAt": "2026-01-11T10:00:00.000Z",
    "updatedAt": "2026-01-11T10:00:00.000Z"
  }
}
```

### Error (400 Bad Request)

```json
{
  "statusCode": 400,
  "message": [
    "districtOfficeName must be a string",
    "name must be a string",
    "type must be a string",
    "registrationNumber must be a string"
  ],
  "error": "Bad Request"
}
```

## cURL Example

```bash
# Production (port 4004)
curl -X POST http://localhost:4004/organizations/register \
  -H "Content-Type: application/json" \
  -d '{
    "districtOfficeName": "สำนักงานเขตจอมทอง",
    "name": "มูลนิธิจอมทอง",
    "type": "มูลนิธิ",
    "registrationNumber": "30"
  }'

# Development (port 3000)
curl -X POST http://localhost:3000/organizations/register \
  -H "Content-Type: application/json" \
  -d '{
    "districtOfficeName": "สำนักงานเขตจอมทอง",
    "name": "มูลนิธิจอมทอง",
    "type": "มูลนิธิ",
    "registrationNumber": "30"
  }'
```

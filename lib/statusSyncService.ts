// Server-side Background Service (Alternative)
// This runs on the server, not in the browser

import fs from 'fs';
import path from 'path';

interface ClientTimer {
  startTime: number;
  startFilesCount: number;
}

function calculateSheets(totalPages: number): number {
  if (totalPages === 0) return 0;

  const first30Count = Math.ceil(totalPages * 0.3);
  const first30Sheets = Math.ceil(first30Count / 2);
  const remaining70 = totalPages - first30Count;

  return first30Sheets + remaining70;
}

async function getClientData(clientId: string) {
  // This would fetch from your API or file system
  try {
    const response = await fetch(`http://localhost:3001/api/client/${clientId}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching client ${clientId}:`, error);
    return null;
  }
}

export async function syncStatusToServer() {
  console.log(`[Server Status Sync] ${new Date().toLocaleTimeString('th-TH')}`);

  // Load timers from a persistent storage (e.g., JSON file or database)
  const timersPath = path.join(process.cwd(), 'data', 'clientTimers.json');

  let clientTimers: Record<string, ClientTimer> = {};

  try {
    if (fs.existsSync(timersPath)) {
      const data = fs.readFileSync(timersPath, 'utf8');
      clientTimers = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading timers:', error);
    return;
  }

  const activeClientIds = Object.keys(clientTimers);

  if (activeClientIds.length === 0) {
    return;
  }

  // Send updates for each active client
  for (const clientId of activeClientIds) {
    const timer = clientTimers[clientId];
    const clientData = await getClientData(clientId);

    if (!clientData) continue;

    // Calculate stats
    const startDate = new Date(timer.startTime);
    const now = new Date();

    // Check if we crossed midnight
    const startDay = new Date(startDate).setHours(0, 0, 0, 0);
    const nowDay = new Date(now).setHours(0, 0, 0, 0);

    let endTime = now;
    if (nowDay > startDay) {
      const midnight = new Date(startDate);
      midnight.setHours(23, 59, 59, 999);
      endTime = midnight;
    }

    const elapsedMs = endTime.getTime() - timer.startTime;
    const totalHours = elapsedMs / (1000 * 60 * 60);

    const completedFilesCount = clientData.completed?.reduce(
      (sum: number, folder: { fileCount: number }) => sum + folder.fileCount,
      0
    ) || 0;

    const startSheets = calculateSheets(timer.startFilesCount);
    const currentSheets = calculateSheets(completedFilesCount);
    const sheetsDone = currentSheets - startSheets;
    const sheetsPerHour = totalHours > 0 ? Math.round(sheetsDone / totalHours) : 0;

    const statusData = {
      machineNumber: clientId,
      sheetCount: currentSheets,
      bookCount: clientData.completed?.length || 0,
      sheetsPerHour: sheetsPerHour
    };

    // Send to API
    try {
      const response = await fetch('https://ocr-flow.piyawong.com/employee-management/api/machines/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(statusData),
      });

      if (response.ok) {
        console.log(`✅ Client ${clientId} synced`);
      } else {
        console.error(`❌ Client ${clientId} - HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Client ${clientId} - Error:`, error);
    }
  }
}

// Run this function periodically with a cron job or setInterval
// Example: setInterval(syncStatusToServer, 30000);

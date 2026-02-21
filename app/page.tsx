"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import defaultConfig from "../config.default.json";

// Calculate sheets from pages using 30% rule
// 30% first pages: 2 pages = 1 sheet (double-sided), odd page = 1 sheet
// 70% remaining: 1 page = 1 sheet (single-sided)
function calculateSheets(totalPages: number): number {
  if (totalPages === 0) return 0;

  const first30Count = Math.ceil(totalPages * 0.3);
  const first30Sheets = Math.ceil(first30Count / 2);
  const remaining70 = totalPages - first30Count;

  return first30Sheets + remaining70;
}

interface ClientStats {
  clientId: string;
  pendingCount: number;
  completedFolders: number;
  completedFilesCount: number;
}

interface ClientTimer {
  startTime: number;
  startFilesCount: number;
}

export default function Home() {
  const router = useRouter();
  const [clientsData, setClientsData] = useState<ClientStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clientTimers, setClientTimers] = useState<Record<string, ClientTimer>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [startTimeInput, setStartTimeInput] = useState("");
  const [hourInput, setHourInput] = useState("");
  const [minuteInput, setMinuteInput] = useState("");
  const [syncingThumbnails, setSyncingThumbnails] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [workerNames, setWorkerNames] = useState<Record<string, string[]>>({});
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>({});
  const [displayClients, setDisplayClients] = useState<string[]>(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/config.local.json');
        if (response.ok) {
          const localConfig = await response.json();
          if (localConfig.displayClients && Array.isArray(localConfig.displayClients)) {
            setDisplayClients(localConfig.displayClients);
            console.log('Loaded local config:', localConfig.displayClients);
          }
        } else {
          // If config.local.json doesn't exist, display all clients (1-10)
          console.log('No local config found, displaying all clients (1-10)');
        }
      } catch (error) {
        // Use default: display all clients (1-10)
        console.log('Error loading config, displaying all clients (1-10)');
      }
    };
    loadConfig();
  }, []);

  // Fetch all clients data
  const fetchClientsData = async () => {
    setRefreshing(true);
    try {
      // Fetch all 10 clients in parallel
      const promises = Array.from({ length: 10 }, (_, i) =>
        fetch(`/api/client/${i + 1}`).then((res) => res.json())
      );

      const results = await Promise.all(promises);

      const stats: ClientStats[] = results.map((data, index) => {
        const completedFilesCount = data.completed?.reduce(
          (sum: number, folder: { fileCount: number }) => sum + folder.fileCount,
          0
        ) || 0;

        return {
          clientId: `${index + 1}`,
          pendingCount: data.pending?.length || 0,
          completedFolders: data.completed?.length || 0,
          completedFilesCount,
        };
      });

      setClientsData(stats);
    } catch (error) {
      console.error("Error fetching clients data:", error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Fetch worker info from API on mount (once)
  useEffect(() => {
    const fetchWorkersInfo = async () => {
      try {
        const response = await fetch('http://5.223.72.18:3006/employee-management/api/machines/active');
        const machines = await response.json();

        const names: Record<string, string[]> = {};
        const counts: Record<string, number> = {};
        const savedTimers = localStorage.getItem('clientTimers');
        const existingTimers = savedTimers ? JSON.parse(savedTimers) : {};
        const newTimers: Record<string, ClientTimer> = { ...existingTimers };

        // Process each machine
        machines.forEach((machine: any) => {
          const clientId = machine.machineNumber;

          if (machine.workers && machine.workers.length > 0) {
            // Get all worker names
            const workerNamesList = machine.workers.map((w: any) => w.nickname || "").filter((n: string) => n);
            names[clientId] = workerNamesList;
            counts[clientId] = machine.workers.length;

            // Only set timer if it doesn't exist yet
            // Use the earliest clockInTime from all workers
            if (!existingTimers[clientId]) {
              const clockInTimes = machine.workers
                .map((w: any) => w.clockInTime)
                .filter((t: any) => t)
                .map((t: string) => new Date(t).getTime());

              if (clockInTimes.length > 0) {
                const earliestTime = Math.min(...clockInTimes);
                newTimers[clientId] = {
                  startTime: earliestTime,
                  startFilesCount: 0
                };
              }
            }
          }
        });

        setWorkerNames(names);
        setWorkerCounts(counts);

        // Update timers if there are new ones
        if (Object.keys(newTimers).length > Object.keys(existingTimers).length) {
          localStorage.setItem('clientTimers', JSON.stringify(newTimers));
          setClientTimers(newTimers);
        } else if (savedTimers) {
          setClientTimers(existingTimers);
        }
      } catch (error) {
        console.error('Failed to fetch workers info:', error);

        // Still load existing timers even if API fails
        const savedTimers = localStorage.getItem('clientTimers');
        if (savedTimers) {
          setClientTimers(JSON.parse(savedTimers));
        }
      }
    };

    fetchClientsData();
    fetchWorkersInfo();
  }, []);

  // Update current time every second for live clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Background service: Send status updates for active clients
  useEffect(() => {
    const sendStatusUpdate = async () => {
      // Get all active clients (those with timers)
      const activeClientIds = Object.keys(clientTimers);

      if (activeClientIds.length === 0) {
        return; // Don't log if no active clients
      }

      console.groupCollapsed(`[Status Sync] ${new Date().toLocaleTimeString('th-TH')} - Syncing ${activeClientIds.length} client(s)`);

      // Send updates for each active client
      for (const clientId of activeClientIds) {
        const timer = clientTimers[clientId];
        const client = clientsData.find(c => c.clientId === clientId);

        if (!client) {
          console.warn(`Client ${clientId} not found in data`);
          continue;
        }

        // Calculate stats using current time (not state)
        const startDate = new Date(timer.startTime);
        const now = new Date(); // Use actual current time, not state

        // Check if we crossed midnight (different days)
        const startDay = new Date(startDate).setHours(0, 0, 0, 0);
        const nowDay = new Date(now).setHours(0, 0, 0, 0);

        let endTime = now;
        if (nowDay > startDay) {
          // Crossed midnight - cap at end of start day (midnight)
          const midnight = new Date(startDate);
          midnight.setHours(23, 59, 59, 999);
          endTime = midnight;
        }

        const elapsedMs = endTime.getTime() - timer.startTime;
        const totalHours = elapsedMs / (1000 * 60 * 60);

        // Calculate sheets
        // Option: Use total sheets (not delta) for sheetsPerHour calculation
        const currentSheets = calculateSheets(client.completedFilesCount);

        // Calculate rate based on total sheets divided by elapsed time
        const sheetsPerHour = totalHours > 0 ? Math.round((currentSheets / totalHours) * 10) / 10 : 0;

        // Debug log
        console.log(`[Client ${clientId}] Calculation:`, {
          startFilesCount: timer.startFilesCount,
          currentFilesCount: client.completedFilesCount,
          currentSheets,
          totalHours: totalHours.toFixed(2),
          sheetsPerHour,
          note: 'Using total sheets (not delta)'
        });

        // Prepare data
        const statusData = {
          machineNumber: clientId, // Send as "1", "2", "3", etc. (no leading zero)
          sheetCount: currentSheets,
          bookCount: client.completedFolders,
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
            const result = await response.json();
            console.log(`✅ Client ${clientId}:`, {
              sent: statusData,
              received: result
            });
          } else {
            console.error(`❌ Client ${clientId} - HTTP ${response.status}:`, await response.text());
          }
        } catch (error) {
          console.error(`❌ Client ${clientId} - Network error:`, error);
        }
      }

      console.groupEnd();
    };

    // Run immediately on mount if there are active clients
    if (Object.keys(clientTimers).length > 0) {
      sendStatusUpdate();
    }

    // Then run every 30 seconds
    const interval = setInterval(sendStatusUpdate, 30000);

    return () => clearInterval(interval);
  }, [clientTimers, clientsData]); // Removed currentTime from dependencies

  // Save client timers to localStorage
  useEffect(() => {
    if (Object.keys(clientTimers).length > 0) {
      localStorage.setItem('clientTimers', JSON.stringify(clientTimers));
    } else {
      localStorage.removeItem('clientTimers');
    }
  }, [clientTimers]);

  const openTimeModal = (clientId: string) => {
    setSelectedClientId(clientId);

    // Set default time to current time
    const now = new Date();
    const hours = now.getHours().toString();
    const minutes = now.getMinutes().toString();
    setHourInput(hours);
    setMinuteInput(minutes);
    setStartTimeInput(`${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`);

    setShowTimeModal(true);
  };

  const handleHourChange = (value: string) => {
    // Allow only numbers
    const numValue = value.replace(/[^0-9]/g, '');

    // Limit to 0-23
    if (numValue === '' || (parseInt(numValue) >= 0 && parseInt(numValue) <= 23)) {
      setHourInput(numValue);
      updateStartTimeInput(numValue, minuteInput);

      // Auto-focus to minute input when 2 digits entered
      if (numValue.length === 2) {
        setTimeout(() => {
          document.getElementById('minute-input')?.focus();
        }, 0);
      }
    }
  };

  const handleMinuteChange = (value: string) => {
    // Allow only numbers
    const numValue = value.replace(/[^0-9]/g, '');

    // Limit to 0-59
    if (numValue === '' || (parseInt(numValue) >= 0 && parseInt(numValue) <= 59)) {
      setMinuteInput(numValue);
      updateStartTimeInput(hourInput, numValue);
    }
  };

  const updateStartTimeInput = (hours: string, minutes: string) => {
    if (hours !== '' && minutes !== '') {
      const h = hours.padStart(2, '0');
      const m = minutes.padStart(2, '0');
      setStartTimeInput(`${h}:${m}`);
    } else {
      setStartTimeInput('');
    }
  };

  const confirmStartTime = () => {
    if (!selectedClientId || !startTimeInput || !hourInput || !minuteInput) return;

    // Parse the input time (HH:mm)
    const hours = parseInt(hourInput);
    const minutes = parseInt(minuteInput);

    // Create a date object for today with the specified time
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);

    const startTime = startDate.getTime();

    // Get current files count for this client
    const client = clientsData.find(c => c.clientId === selectedClientId);
    if (!client) return;

    setClientTimers(prev => ({
      ...prev,
      [selectedClientId]: {
        startTime,
        startFilesCount: client.completedFilesCount,
      }
    }));

    // Close modal
    setShowTimeModal(false);
    setSelectedClientId(null);
    setStartTimeInput("");
    setHourInput("");
    setMinuteInput("");
  };

  const stopClientTimer = (clientId: string) => {
    if (!confirm(`หยุดนับเวลา Client ${clientId}?`)) {
      return;
    }
    setClientTimers(prev => {
      const newTimers = { ...prev };
      delete newTimers[clientId];
      return newTimers;
    });
  };

  // Sync Thumbnails
  const handleSyncThumbnails = async () => {
    if (!confirm("ต้องการลบ thumbnail ที่ไม่มีไฟล์ต้นฉบับ?\n\nการดำเนินการนี้จะลบ thumbnail ที่ไม่ตรงกับไฟล์จริงทั้งหมด")) {
      return;
    }

    setSyncingThumbnails(true);
    setSyncResult(null);

    try {
      const response = await fetch("/api/sync-thumbnails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // ไม่ระบุ clientId = sync ทั้งหมด
      });

      const data = await response.json();

      if (data.success) {
        setSyncResult(data);
        setShowSyncModal(true);
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (error) {
      console.error("Error syncing thumbnails:", error);
      alert("เกิดข้อผิดพลาดในการ sync thumbnails");
    } finally {
      setSyncingThumbnails(false);
    }
  };

  // Calculate totals
  const totalPending = clientsData.reduce((sum, client) => sum + client.pendingCount, 0);
  const totalPages = clientsData.reduce((sum, client) => sum + client.completedFilesCount, 0);
  const totalSheets = calculateSheets(totalPages);
  const totalFolders = clientsData.reduce((sum, client) => sum + client.completedFolders, 0);

  // Get tier color based on sheetsPerHour
  const getTierColor = (sheetsPerHour: number, clientId: string) => {
    // Multiply thresholds by worker count for this client
    const multiplier = workerCounts[clientId] || 1;

    if (sheetsPerHour >= 400 * multiplier) {
      return {
        gradient: 'bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500',
        text: 'text-white',
        glow: 'shadow-2xl ring-4 ring-purple-300 animate-pulse',
        label: '🌈'
      };
    } else if (sheetsPerHour >= 300 * multiplier) {
      return {
        gradient: 'bg-gradient-to-br from-emerald-500 to-teal-500',
        text: 'text-white',
        glow: 'shadow-xl ring-2 ring-emerald-300',
        label: '👑'
      };
    } else if (sheetsPerHour >= 200 * multiplier) {
      return {
        gradient: 'bg-gradient-to-br from-yellow-300 to-yellow-500',
        text: 'text-yellow-900',
        glow: 'shadow-lg',
        label: '⚡'
      };
    } else {
      return {
        gradient: 'bg-gradient-to-br from-red-400 to-red-600',
        text: 'text-white',
        glow: 'shadow-md',
        label: '🔥'
      };
    }
  };

  // Calculate stats for each client
  const getClientStats = (clientId: string, completedFilesCount: number) => {
    const timer = clientTimers[clientId];
    if (!timer) return null;

    const startDate = new Date(timer.startTime);
    const now = new Date(currentTime);

    // Check if start date is today or older
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let endTime = now;
    let elapsedMs = 0;

    if (today.getTime() > startDay.getTime()) {
      // Start date is in the past (not today)
      // Cap at midnight of start day
      const midnight = new Date(startDate);
      midnight.setHours(23, 59, 59, 999);
      endTime = midnight;
      elapsedMs = endTime.getTime() - timer.startTime;
    } else {
      // Start date is today - calculate normally
      elapsedMs = now.getTime() - timer.startTime;
    }

    const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
    const elapsedMinutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

    // Calculate sheets using total (not delta) - same as client page
    const currentSheets = calculateSheets(completedFilesCount);

    const totalHours = elapsedMs / (1000 * 60 * 60);
    const sheetsPerHour = totalHours > 0 ? Math.round((currentSheets / totalHours) * 10) / 10 : 0;

    const startTimeStr = startDate.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      elapsedHours,
      elapsedMinutes,
      sheetsDone: currentSheets, // Show total sheets instead of delta
      sheetsPerHour,
      startTimeStr,
      tier: getTierColor(sheetsPerHour, clientId)
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Roll Management Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">ระบบจัดการม้วนฟิล์ม - 10 เครื่อง</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSyncThumbnails}
                disabled={syncingThumbnails}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  syncingThumbnails
                    ? "bg-gray-200 text-gray-400 cursor-wait"
                    : "bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 shadow-md hover:shadow-lg"
                }`}
              >
                <svg
                  className={`w-5 h-5 ${syncingThumbnails ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>{syncingThumbnails ? "กำลัง Sync..." : "Sync Thumbnails"}</span>
              </button>
              <button
                onClick={fetchClientsData}
                disabled={refreshing}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  refreshing
                    ? "bg-gray-200 text-gray-400 cursor-wait"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-md hover:shadow-lg"
                }`}
              >
                <svg
                  className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{refreshing ? "กำลังโหลด..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          {!loading && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              {/* Total Pending */}
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-yellow-700 text-sm font-medium">Pending</p>
                    <p className="text-2xl font-bold text-yellow-900">{totalPending}</p>
                    <p className="text-yellow-600 text-xs">รอดำเนินการ</p>
                  </div>
                </div>
              </div>

              {/* Total Folders */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-green-700 text-sm font-medium">เล่ม</p>
                    <p className="text-2xl font-bold text-green-900">{totalFolders}</p>
                    <p className="text-green-600 text-xs">folders</p>
                  </div>
                </div>
              </div>

              {/* Total Sheets */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-purple-700 text-sm font-medium">แผ่น (โดยประมาณ)</p>
                    <p className="text-2xl font-bold text-purple-900">{totalSheets}</p>
                    <p className="text-purple-600 text-xs">({totalPages} หน้า)</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-md border border-gray-200 p-6 animate-pulse"
              >
                <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
                <div className="h-10 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        )}

        {/* Client Cards Grid */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clientsData
              .filter((client) => displayClients.includes(client.clientId))
              .map((client) => {
              const hasData = client.pendingCount > 0 || client.completedFolders > 0;
              const hasTimer = !!clientTimers[client.clientId];
              const stats = hasTimer ? getClientStats(client.clientId, client.completedFilesCount) : null;

              return (
                <div
                  key={client.clientId}
                  className={`bg-white rounded-xl shadow-md border p-6 transition-all duration-200 ${
                    hasTimer
                      ? 'border-indigo-400 shadow-lg ring-2 ring-indigo-200'
                      : 'border-gray-200 hover:shadow-xl hover:scale-[1.02]'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800">
                        Client {client.clientId}
                      </h3>
                      {workerNames[client.clientId] && workerNames[client.clientId].length > 0 && (
                        <p className="text-sm text-blue-600 font-medium">
                          {workerNames[client.clientId].join(', ')}
                        </p>
                      )}
                    </div>
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        hasTimer ? "bg-indigo-500 animate-pulse" : hasData ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={hasTimer ? "กำลังทำงาน" : hasData ? "มีข้อมูล" : "ไม่มีข้อมูล"}
                    ></div>
                  </div>

                  {/* Timer Info */}
                  {hasTimer && stats && (
                    <div className={`${stats.tier.gradient} ${stats.tier.glow} rounded-lg p-2 mb-3 transition-all duration-500`}>
                      {/* Tier Emoji */}
                      <div className="text-center">
                        <span className="text-lg">
                          {stats.tier.label}
                        </span>
                      </div>

                      {/* Prominent Rate Display */}
                      <div className="text-center mb-1">
                        <p className={`${stats.tier.text} text-3xl font-bold`}>{stats.sheetsPerHour}</p>
                        <p className={`${stats.tier.text} opacity-90 text-xs font-semibold`}>แผ่น/ชม.</p>
                      </div>

                      {/* Time Info */}
                      <div className={`flex items-center justify-center gap-1 pt-1 border-t ${stats.tier.text === 'text-white' ? 'border-white/20' : 'border-black/20'}`}>
                        <svg className={`w-3 h-3 ${stats.tier.text} opacity-80`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className={`${stats.tier.text} opacity-80 text-[10px]`}>
                          {stats.startTimeStr} • {stats.elapsedHours}:{stats.elapsedMinutes.toString().padStart(2, '0')} ชม.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Files Stats - More Prominent */}
                  <div className="mb-4">
                    {/* Pending - Compact */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-yellow-700">Pending</span>
                        <span className="text-lg font-bold text-yellow-900">{client.pendingCount}</span>
                      </div>
                    </div>

                    {/* Completed - Large & Prominent */}
                    <div
                      className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => router.push(`/client/${client.clientId}`)}
                    >
                      <div className="text-center">
                        <p className="text-white/90 text-xs font-medium mb-1">แผ่น (โดยประมาณ)</p>
                        <p className="text-white text-5xl font-bold mb-1">{calculateSheets(client.completedFilesCount)}</p>
                        <p className="text-white/70 text-xs mb-2">({client.completedFilesCount} หน้า)</p>
                        <div className="flex items-center justify-center gap-2 text-white/80 text-xs">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span>{client.completedFolders} เล่ม</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {!hasTimer ? (
                      <button
                        onClick={() => openTimeModal(client.clientId)}
                        className="flex-1 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:from-indigo-800 active:to-purple-800 transition-all duration-200 shadow-md text-sm flex items-center justify-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ตั้งค่าเวลา
                      </button>
                    ) : (
                      <button
                        onClick={() => stopClientTimer(client.clientId)}
                        className="flex-1 py-2 rounded-lg font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 transition-all duration-200 shadow-md text-sm flex items-center justify-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        หยุด
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/client/${client.clientId}`)}
                      className="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-all duration-200 text-sm"
                    >
                      เปิด
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && clientsData.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-300">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium text-lg">ไม่มีข้อมูล</p>
            <p className="text-gray-400 text-sm mt-2">กด Refresh เพื่อโหลดข้อมูล</p>
          </div>
        )}
      </main>

      {/* Sync Result Modal */}
      {showSyncModal && syncResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                ผลการ Sync Thumbnails
              </h3>
              <button
                onClick={() => setShowSyncModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-blue-600 text-xs font-medium mb-1">สแกนทั้งหมด</p>
                <p className="text-blue-900 text-2xl font-bold">{syncResult.stats.totalScanned}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-red-600 text-xs font-medium mb-1">ลบแล้ว</p>
                <p className="text-red-900 text-2xl font-bold">{syncResult.stats.totalDeleted}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-green-600 text-xs font-medium mb-1">เก็บไว้</p>
                <p className="text-green-900 text-2xl font-bold">{syncResult.stats.totalKept}</p>
              </div>
            </div>

            {syncResult.emptyDirectoriesDeleted > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                <p className="text-purple-700 text-sm">
                  ลบโฟลเดอร์ว่าง: <span className="font-bold">{syncResult.emptyDirectoriesDeleted}</span> โฟลเดอร์
                </p>
              </div>
            )}

            {/* Detailed Results */}
            {syncResult.stats.results.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">รายละเอียดแต่ละ Client:</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {syncResult.stats.results
                    .filter((result: any) => result.deleted.length > 0 || result.kept.length > 0)
                    .map((result: any, index: number) => (
                      <div
                        key={index}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-semibold text-gray-800">
                            Client {result.client} - {result.type}
                          </h5>
                          <div className="flex gap-2 text-xs">
                            {result.deleted.length > 0 && (
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                                ลบ {result.deleted.length}
                              </span>
                            )}
                            {result.kept.length > 0 && (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                เก็บ {result.kept.length}
                              </span>
                            )}
                          </div>
                        </div>

                        {result.deleted.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-red-600 mb-1">ไฟล์ที่ลบ:</p>
                            <div className="bg-white rounded border border-red-200 p-2 max-h-32 overflow-y-auto">
                              {result.deleted.slice(0, 10).map((file: string, i: number) => (
                                <p key={i} className="text-xs text-gray-600 font-mono">
                                  {file}
                                </p>
                              ))}
                              {result.deleted.length > 10 && (
                                <p className="text-xs text-gray-500 italic mt-1">
                                  ... และอีก {result.deleted.length - 10} ไฟล์
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {result.errors.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-orange-600 mb-1">
                              ข้อผิดพลาด ({result.errors.length}):
                            </p>
                            <div className="bg-orange-50 rounded border border-orange-200 p-2 max-h-20 overflow-y-auto">
                              {result.errors.slice(0, 3).map((error: string, i: number) => (
                                <p key={i} className="text-xs text-orange-700">
                                  {error}
                                </p>
                              ))}
                              {result.errors.length > 3 && (
                                <p className="text-xs text-orange-600 italic mt-1">
                                  ... และอีก {result.errors.length - 3} ข้อผิดพลาด
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setShowSyncModal(false)}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 active:from-purple-800 active:to-indigo-800 transition-colors shadow-md"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Input Modal */}
      {showTimeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              ตั้งเวลาเริ่มงาน
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Client {selectedClientId}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
                เวลาเริ่มงาน (24 ชั่วโมง)
              </label>

              {/* Quick Select */}
              <div className="mb-3">
                <button
                  onClick={() => {
                    const now = new Date();
                    const h = now.getHours().toString().padStart(2, '0');
                    const m = now.getMinutes().toString().padStart(2, '0');
                    setHourInput(h);
                    setMinuteInput(m);
                    updateStartTimeInput(h, m);
                  }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:from-emerald-700 active:to-teal-700 text-white rounded-lg font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ตอนนี้
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                {[9, 10, 11, 12, 13, 14, 15, 16].map((hour) => (
                  <button
                    key={hour}
                    onClick={() => {
                      const h = hour.toString().padStart(2, '0');
                      setHourInput(h);
                      setMinuteInput('00');
                      updateStartTimeInput(h, '00');
                    }}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 rounded-lg text-sm font-semibold transition-colors border border-emerald-200"
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-gray-500">หรือระบุเอง</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                {/* Hour Input */}
                <div className="flex-1 max-w-[120px]">
                  <input
                    id="hour-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={hourInput}
                    onChange={(e) => handleHourChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || (hourInput.length === 2 && e.key >= '0' && e.key <= '9')) {
                        e.preventDefault();
                        document.getElementById('minute-input')?.focus();
                      }
                    }}
                    onBlur={() => {
                      if (hourInput && hourInput.length === 1) {
                        setHourInput(hourInput.padStart(2, '0'));
                        updateStartTimeInput(hourInput.padStart(2, '0'), minuteInput);
                      }
                    }}
                    placeholder="00"
                    maxLength={2}
                    className="w-full px-4 py-4 text-4xl text-center border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-gray-50 font-bold"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 text-center mt-1">ชั่วโมง (0-23)</p>
                </div>

                {/* Separator */}
                <div className="text-4xl font-bold text-gray-400 pb-5">:</div>

                {/* Minute Input */}
                <div className="flex-1 max-w-[120px]">
                  <input
                    id="minute-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={minuteInput}
                    onChange={(e) => handleMinuteChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (hourInput && minuteInput && !(() => {
                          const hours = parseInt(hourInput);
                          const minutes = parseInt(minuteInput);
                          if (isNaN(hours) || isNaN(minutes)) return true;
                          const startDate = new Date();
                          startDate.setHours(hours, minutes, 0, 0);
                          return Date.now() < startDate.getTime();
                        })()) {
                          confirmStartTime();
                        }
                      }
                    }}
                    onBlur={() => {
                      if (minuteInput && minuteInput.length === 1) {
                        setMinuteInput(minuteInput.padStart(2, '0'));
                        updateStartTimeInput(hourInput, minuteInput.padStart(2, '0'));
                      }
                    }}
                    placeholder="00"
                    maxLength={2}
                    className="w-full px-4 py-4 text-4xl text-center border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-gray-50 font-bold"
                  />
                  <p className="text-xs text-gray-500 text-center mt-1">นาที (0-59)</p>
                </div>
              </div>
            </div>

            {/* Preview */}
            {hourInput && minuteInput && (
              <div className="mb-6">
                {(() => {
                  const hours = parseInt(hourInput);
                  const minutes = parseInt(minuteInput);
                  if (isNaN(hours) || isNaN(minutes)) return null;

                  const startDate = new Date();
                  startDate.setHours(hours, minutes, 0, 0);
                  const elapsedMs = Date.now() - startDate.getTime();
                  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
                  const elapsedMinutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

                  const displayTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

                  if (elapsedMs > 0) {
                    return (
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
                        <div className="text-center">
                          <p className="text-emerald-600 text-sm mb-2">เริ่มงานเวลา</p>
                          <p className="text-emerald-700 font-bold text-3xl mb-3">
                            {displayTime}
                          </p>
                          <div className="bg-white/70 rounded-lg p-3 border border-emerald-100">
                            <p className="text-emerald-600 text-xs mb-1">ทำงานมาแล้ว</p>
                            <p className="text-emerald-700 font-bold text-lg">
                              {elapsedHours}:{elapsedMinutes.toString().padStart(2, '0')} ชม.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 rounded-xl p-4">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="text-red-700 font-bold text-sm">
                            เวลาที่เลือกอยู่ในอนาคต
                          </p>
                        </div>
                        <p className="text-red-600 text-xs text-center">
                          กรุณาเลือกเวลาในอดีตหรือปัจจุบัน
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTimeModal(false);
                  setSelectedClientId(null);
                  setStartTimeInput("");
                  setHourInput("");
                  setMinuteInput("");
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 active:bg-gray-400 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmStartTime}
                disabled={!hourInput || !minuteInput || (() => {
                  const hours = parseInt(hourInput);
                  const minutes = parseInt(minuteInput);
                  if (isNaN(hours) || isNaN(minutes)) return true;
                  const startDate = new Date();
                  startDate.setHours(hours, minutes, 0, 0);
                  return Date.now() < startDate.getTime();
                })()}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 active:from-emerald-800 active:to-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

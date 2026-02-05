"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    fetchClientsData();

    // Load client timers from localStorage
    const savedTimers = localStorage.getItem('clientTimers');
    if (savedTimers) {
      setClientTimers(JSON.parse(savedTimers));
    }
  }, []);

  // Update current time every second for live clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    setStartTimeInput(`${hours}:${minutes}`);

    setShowTimeModal(true);
  };

  const confirmStartTime = () => {
    if (!selectedClientId || !startTimeInput) return;

    // Parse the input time (HH:mm)
    const [hours, minutes] = startTimeInput.split(':').map(Number);

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

  // Calculate totals
  const totalPending = clientsData.reduce((sum, client) => sum + client.pendingCount, 0);
  const totalPages = clientsData.reduce((sum, client) => sum + client.completedFilesCount, 0);
  const totalSheets = calculateSheets(totalPages);
  const totalFolders = clientsData.reduce((sum, client) => sum + client.completedFolders, 0);

  // Calculate stats for each client
  const getClientStats = (clientId: string, completedFilesCount: number) => {
    const timer = clientTimers[clientId];
    if (!timer) return null;

    const elapsedMs = currentTime - timer.startTime;
    const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
    const elapsedMinutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

    const filesDone = completedFilesCount - timer.startFilesCount;
    const totalHours = elapsedMs / (1000 * 60 * 60);
    const filesPerHour = totalHours > 0 ? Math.round(filesDone / totalHours) : 0;

    const startDate = new Date(timer.startTime);
    const startTimeStr = startDate.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      elapsedHours,
      elapsedMinutes,
      filesDone,
      filesPerHour,
      startTimeStr,
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
            {clientsData.map((client) => {
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
                    <h3 className="text-lg font-bold text-gray-800">
                      Client {client.clientId}
                    </h3>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        hasTimer ? "bg-indigo-500 animate-pulse" : hasData ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={hasTimer ? "กำลังทำงาน" : hasData ? "มีข้อมูล" : "ไม่มีข้อมูล"}
                    ></div>
                  </div>

                  {/* Timer Info */}
                  {hasTimer && stats && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-medium text-indigo-700">เริ่มเมื่อ {stats.startTimeStr}</span>
                        </div>
                      </div>
                      <div className={`grid ${stats.filesDone > 0 ? 'grid-cols-3' : 'grid-cols-1'} gap-2 text-center`}>
                        {/* Always show elapsed time */}
                        <div>
                          <p className="text-indigo-900 text-lg font-bold">{stats.elapsedHours}:{stats.elapsedMinutes.toString().padStart(2, '0')}</p>
                          <p className="text-indigo-600 text-[10px]">ชม.</p>
                        </div>

                        {/* Only show files done and rate if files > 0 */}
                        {stats.filesDone > 0 && (
                          <>
                            <div>
                              <p className="text-indigo-900 text-lg font-bold">{stats.filesDone}</p>
                              <p className="text-indigo-600 text-[10px]">ไฟล์</p>
                            </div>
                            <div>
                              <p className="text-indigo-900 text-lg font-bold">{stats.filesPerHour}</p>
                              <p className="text-indigo-600 text-[10px]">ไฟล์/ชม.</p>
                            </div>
                          </>
                        )}
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
                        เริ่มงาน
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

      {/* Time Input Modal */}
      {showTimeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              ตั้งเวลาเริ่มงาน
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Client {selectedClientId}
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                เวลาเริ่มงาน
              </label>
              <input
                type="time"
                value={startTimeInput}
                onChange={(e) => setStartTimeInput(e.target.value)}
                className="w-full px-4 py-3 text-2xl text-center border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                ระบุเวลาที่เริ่มทำงาน (เช่น 11:00)
              </p>
            </div>

            {/* Preview */}
            {startTimeInput && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-indigo-700 text-center">
                  เริ่มงานเวลา <span className="font-bold text-lg">{startTimeInput}</span>
                </p>
                {(() => {
                  const [hours, minutes] = startTimeInput.split(':').map(Number);
                  const startDate = new Date();
                  startDate.setHours(hours, minutes, 0, 0);
                  const elapsedMs = Date.now() - startDate.getTime();
                  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
                  const elapsedMinutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

                  if (elapsedMs > 0) {
                    return (
                      <p className="text-xs text-indigo-600 text-center mt-1">
                        ทำงานมาแล้ว {elapsedHours} ชั่วโมง {elapsedMinutes} นาที
                      </p>
                    );
                  } else {
                    return (
                      <p className="text-xs text-red-600 text-center mt-1">
                        เวลาที่เลือกอยู่ในอนาคต กรุณาเลือกเวลาในอดีต
                      </p>
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
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmStartTime}
                disabled={!startTimeInput || (() => {
                  const [hours, minutes] = startTimeInput.split(':').map(Number);
                  const startDate = new Date();
                  startDate.setHours(hours, minutes, 0, 0);
                  return Date.now() < startDate.getTime();
                })()}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

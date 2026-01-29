"use client";

import { useState, useEffect, useRef } from "react";

// รายชื่อเขตทั้งหมดในกรุงเทพมหานคร
const BANGKOK_DISTRICTS = [
  "พระนคร",
  "ดุสิต",
  "หนองจอก",
  "บางรัก",
  "บางเขน",
  "บางกะปิ",
  "ปทุมวัน",
  "ป้อมปราบศัตรูพ่าย",
  "พระโขนง",
  "มีนบุรี",
  "ลาดกระบัง",
  "ยานนาวา",
  "สัมพันธวงศ์",
  "พญาไท",
  "ธนบุรี",
  "บางกอกใหญ่",
  "ห้วยขวาง",
  "คลองสาน",
  "ตลิ่งชัน",
  "บางกอกน้อย",
  "บางขุนเทียน",
  "ภาษีเจริญ",
  "หนองแขม",
  "ราษฎร์บูรณะ",
  "บางพลัด",
  "ดินแดง",
  "บึงกุ่ม",
  "สาทร",
  "บางซื่อ",
  "จตุจักร",
  "บางคอแหลม",
  "ประเวศ",
  "คลองเตย",
  "สวนหลวง",
  "จอมทอง",
  "ดอนเมือง",
  "ราชเทวี",
  "ลาดพร้าว",
  "วัฒนา",
  "บางแค",
  "หลักสี่",
  "สายไหม",
  "คันนายาว",
  "สะพานสูง",
  "วังทองหลาง",
  "คลองสามวา",
  "บางนา",
  "ทวีวัฒนา",
  "ทุ่งครุ",
  "บางบอน",
];

interface PendingFile {
  name: string;
  createdAt: number;
}

interface CompletedFolder {
  name: string;
  fileCount: number;
}

interface ClientData {
  clientId: string;
  pending: PendingFile[];
  completed: CompletedFolder[];
}

interface UploadProgress {
  isOpen: boolean;
  step: string;
  percent: number;
  message: string;
  current?: number;
  total?: number;
  isComplete: boolean;
  isError: boolean;
  errorMessage?: string;
}

interface ScannerStatus {
  status: string;
  is_scanning: boolean;
  scanner_connected: boolean;
  profile: string;
  device: string;
}

export default function ClientFivePage() {
  const [data, setData] = useState<ClientData | null>(null);
  const [connected, setConnected] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(Date.now());
  const [formData, setFormData] = useState({
    districtOfficeName: "",
    orderNumber: "",
    name: "",
    type: "มูลนิธิ",
    registrationNumber: "",
  });
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showAllImages, setShowAllImages] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    isOpen: false,
    step: "",
    percent: 0,
    message: "",
    isComplete: false,
    isError: false,
  });
  const [scannerInfo, setScannerInfo] = useState<ScannerStatus | null>(null);
  const [scannerOnline, setScannerOnline] = useState<"online" | "offline" | "checking">("checking");
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
  const [filteredDistricts, setFilteredDistricts] = useState<string[]>(BANGKOK_DISTRICTS);
  const [restarting, setRestarting] = useState(false);
  const [uploadToGroupModal, setUploadToGroupModal] = useState<{isOpen: boolean; groupName: string}>({isOpen: false, groupName: ""});
  const [uploadToGroupProgress, setUploadToGroupProgress] = useState<UploadProgress>({
    isOpen: false,
    step: "",
    percent: 0,
    message: "",
    isComplete: false,
    isError: false,
  });
  const [completedFolderImages, setCompletedFolderImages] = useState<string[]>([]);
  const [selectedCompletedFolder, setSelectedCompletedFolder] = useState<string | null>(null);
  const [selectedCompletedImageIndex, setSelectedCompletedImageIndex] = useState<number | null>(null);
  const [loadingCompletedImages, setLoadingCompletedImages] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfToGroupInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const completedScrollContainerRef = useRef<HTMLDivElement>(null);
  const districtDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource("/api/client/5/watch");

    eventSource.onopen = () => {
      console.log("SSE connected");
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);
        setData(json);
        setCacheVersion(Date.now());
      } catch (error) {
        console.error("Failed to parse SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Check scanner status via proxy
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/scanner-5/health");
        if (res.ok) {
          const data: ScannerStatus = await res.json();
          setScannerInfo(data);
          setScannerOnline("online");
        } else {
          setScannerInfo(null);
          setScannerOnline("offline");
        }
      } catch {
        setScannerInfo(null);
        setScannerOnline("offline");
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (districtDropdownRef.current && !districtDropdownRef.current.contains(event.target as Node)) {
        setShowDistrictDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter districts when user types
  const handleDistrictInputChange = (value: string) => {
    setFormData({ ...formData, districtOfficeName: value });

    if (value.trim() === "") {
      setFilteredDistricts(BANGKOK_DISTRICTS);
    } else {
      const filtered = BANGKOK_DISTRICTS.filter((district) =>
        district.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredDistricts(filtered);
    }
    setShowDistrictDropdown(true);
  };

  // Select district from dropdown
  const handleSelectDistrict = (district: string) => {
    setFormData({ ...formData, districtOfficeName: district });
    setShowDistrictDropdown(false);
    setFilteredDistricts(BANGKOK_DISTRICTS);
  };

  const handleScan = async () => {
    if (scannerOnline !== "online" || !scannerInfo?.scanner_connected) {
      alert("Scanner ไม่พร้อมใช้งาน");
      return;
    }

    try {
      const res = await fetch("/api/scanner-5/scan", {
        method: "POST",
      });
      if (!res.ok) {
        alert("Scan failed");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการ Scan");
    }
  };

  const handleFinish = async () => {
    // Validate required fields
    if (!formData.districtOfficeName.trim()) {
      alert("กรุณาเลือกเขต");
      return;
    }
    if (!formData.orderNumber.trim()) {
      alert("กรุณาใส่เลขลำดับ");
      return;
    }
    if (!formData.name.trim()) {
      alert("กรุณาใส่ชื่อมูลนิธิ/สมาคม");
      return;
    }
    if (!formData.registrationNumber.trim()) {
      alert("กรุณาใส่เลข กท");
      return;
    }

    setProcessing(true);

    const requestData = {
      districtOfficeName: formData.districtOfficeName.trim(),
      orderNumber: formData.orderNumber ? parseFloat(formData.orderNumber) : undefined,
      name: formData.name.trim(),
      type: formData.type,
      registrationNumber: formData.registrationNumber.trim(),
    };

    console.log("=== Creating Folder ===");
    console.log("Request Data:", requestData);

    try {
      const res = await fetch("/api/client/5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      console.log("Response Status:", res.status);

      const result = await res.json();
      console.log("Response Data:", result);

      if (res.ok) {
        console.log("=== Folder Created Successfully ===");
        console.log("Folder Name:", result.folderName);
        console.log("Files Processed:", result.filesProcessed);
        console.log("===================================");
        alert(`สร้าง folder "${result.folderName}" สำเร็จ! (${result.filesProcessed} ไฟล์)`);
        setFormData({
          districtOfficeName: "",
          orderNumber: "",
          name: "",
          type: "มูลนิธิ",
          registrationNumber: "",
        });
        setIsFinishing(false);
      } else {
        console.error("=== Failed to Create Folder ===");
        console.error("Error:", result.error);
        console.error("Details:", result.details);
        console.error("================================");

        // แสดง error message ที่ละเอียด
        const errorMessage = result.error || "เกิดข้อผิดพลาด";
        alert(`❌ ไม่สามารถสร้าง folder ได้\n\n${errorMessage}\n\nกรุณาตรวจสอบ Console (F12) เพื่อดูรายละเอียดเพิ่มเติม`);
      }
    } catch (error) {
      console.error("=== Connection Error ===");
      console.error("Error:", error);
      console.error("=======================");
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับ server\n\nกรุณาลองใหม่อีกครั้ง");
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = async () => {
    if (!data?.pending.length) return;

    if (!confirm(`ต้องการลบไฟล์ใน pending ทั้งหมด ${data.pending.length} ไฟล์?`)) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch("/api/client/5", {
        method: "DELETE",
      });

      const result = await res.json();

      if (res.ok) {
        console.clear();
        console.log("[Clear] ล้างไฟล์และ log เรียบร้อย");
        alert(result.message);
      } else {
        alert(result.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setClearing(false);
    }
  };

  const handleUploadPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("กรุณาเลือกไฟล์ PDF เท่านั้น");
      return;
    }

    console.log("=== Starting PDF Upload ===");
    console.log("File name:", file.name);
    console.log("File size:", file.size, "bytes");
    console.log("File type:", file.type);
    console.log("User Agent:", navigator.userAgent);
    console.log("Platform:", navigator.platform);

    setUploading(true);
    setUploadProgress({
      isOpen: true,
      step: "starting",
      percent: 0,
      message: "เริ่มต้น Upload...",
      isComplete: false,
      isError: false,
    });

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      console.log("Sending request to /api/client/5/upload-pdf");
      const res = await fetch("/api/client/5/upload-pdf", {
        method: "POST",
        body: formData,
      });

      console.log("Response status:", res.status);
      console.log("Response headers:", Object.fromEntries(res.headers.entries()));

      const reader = res.body?.getReader();
      if (!reader) {
        console.error("No reader available from response");
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("Stream reading completed");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              console.log("Received event:", event);

              if (event.type === "progress") {
                setUploadProgress((prev) => ({
                  ...prev,
                  step: event.step || prev.step,
                  percent: event.percent || prev.percent,
                  message: event.message || prev.message,
                  current: event.current,
                  total: event.total,
                }));
              } else if (event.type === "complete") {
                console.log("Upload completed successfully");
                setUploadProgress((prev) => ({
                  ...prev,
                  percent: 100,
                  message: event.message || "เสร็จสิ้น!",
                  isComplete: true,
                }));
              } else if (event.type === "error") {
                console.error("=== Upload Error Received ===");
                console.error("Error:", event.error);
                console.error("Full event:", event);
                console.error("===========================");
                setUploadProgress((prev) => ({
                  ...prev,
                  isError: true,
                  errorMessage: event.error || "เกิดข้อผิดพลาด",
                }));
              }
            } catch (parseError) {
              console.error("Failed to parse SSE event:", line);
              console.error("Parse error:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("=== Client-side Upload Error ===");
      console.error("Error:", error);
      console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      console.error("================================");

      const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการ upload";
      setUploadProgress((prev) => ({
        ...prev,
        isError: true,
        errorMessage: errorMessage,
      }));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      console.log("=== Upload Process Ended ===");
    }
  };

  const handleUploadPDFToGroup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      if (file) alert("กรุณาเลือกไฟล์ PDF เท่านั้น");
      return;
    }
    const groupName = uploadToGroupModal.groupName;
    if (!groupName) return;
    setUploadToGroupProgress({ isOpen: true, step: "starting", percent: 0, message: "เริ่มต้น Upload...", isComplete: false, isError: false });
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("groupName", groupName);
      const res = await fetch("/api/client/5/upload-pdf-to-group", { method: "POST", body: formData });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader available");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "progress") {
                setUploadToGroupProgress((prev) => ({ ...prev, step: event.step || prev.step, percent: event.percent || prev.percent, message: event.message || prev.message, current: event.current, total: event.total }));
              } else if (event.type === "complete") {
                setUploadToGroupProgress((prev) => ({ ...prev, percent: 100, message: event.message || "เสร็จสิ้น!", isComplete: true }));
              } else if (event.type === "error") {
                setUploadToGroupProgress((prev) => ({ ...prev, isError: true, errorMessage: event.error || "เกิดข้อผิดพลาด" }));
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      setUploadToGroupProgress((prev) => ({ ...prev, isError: true, errorMessage: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" }));
    } finally {
      if (pdfToGroupInputRef.current) pdfToGroupInputRef.current.value = "";
    }
  };

  const closeProgressModal = () => {
    setUploadProgress({
      isOpen: false,
      step: "",
      percent: 0,
      message: "",
      isComplete: false,
      isError: false,
    });
  };

  const closeUploadToGroupModal = () => {
    setUploadToGroupModal({isOpen: false, groupName: ""});
    setUploadToGroupProgress({ isOpen: false, step: "", percent: 0, message: "", isComplete: false, isError: false });
  };

  const handleViewCompletedFolder = async (folderName: string) => {
    setLoadingCompletedImages(true);
    setSelectedCompletedFolder(folderName);
    try {
      const response = await fetch(`/api/client/5/completed/${encodeURIComponent(folderName)}`);
      if (!response.ok) throw new Error('Failed to load images');
      const data = await response.json();
      setCompletedFolderImages(data.files);
      setSelectedCompletedImageIndex(0);
    } catch (error) {
      console.error('Error:', error);
      alert('ไม่สามารถโหลดรูปภาพได้');
    } finally {
      setLoadingCompletedImages(false);
    }
  };

  const handlePreviousCompletedImage = () => {
    if (selectedCompletedImageIndex === null || !completedFolderImages.length) return;
    setSelectedCompletedImageIndex(selectedCompletedImageIndex === 0 ? completedFolderImages.length - 1 : selectedCompletedImageIndex - 1);
  };

  const handleNextCompletedImage = () => {
    if (selectedCompletedImageIndex === null || !completedFolderImages.length) return;
    setSelectedCompletedImageIndex(selectedCompletedImageIndex === completedFolderImages.length - 1 ? 0 : selectedCompletedImageIndex + 1);
  };

  const closeCompletedImageModal = () => {
    setSelectedCompletedFolder(null);
    setSelectedCompletedImageIndex(null);
    setCompletedFolderImages([]);
  };

  const handleRestartService = async () => {
    if (!confirm("ต้องการ Restart Scanner Service หรือไม่?")) {
      return;
    }

    setRestarting(true);
    try {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const res = await fetch(`http://${hostname}:9009/clients/client05/restart`, {
        method: "POST",
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Restart สำเร็จ\nStatus: ${result.status}`);
      } else {
        const error = await res.json();
        alert(`Restart ไม่สำเร็จ: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      alert("ไม่สามารถเชื่อมต่อ Manager Server ได้");
    } finally {
      setRestarting(false);
    }
  };

  const handlePreviousImage = () => {
    if (selectedImageIndex === null || !data?.pending.length) return;
    const newIndex = selectedImageIndex === 0 ? data.pending.length - 1 : selectedImageIndex - 1;
    setSelectedImageIndex(newIndex);
  };

  const handleNextImage = () => {
    if (selectedImageIndex === null || !data?.pending.length) return;
    const newIndex = selectedImageIndex === data.pending.length - 1 ? 0 : selectedImageIndex + 1;
    setSelectedImageIndex(newIndex);
  };

  const handleDeleteImage = async () => {
    if (selectedImageIndex === null || !data?.pending.length) return;

    const imageToDelete = data.pending[selectedImageIndex];

    if (!confirm(`ต้องการลบรูปภาพ "${imageToDelete.name}" หรือไม่?`)) {
      return;
    }

    setDeletingImage(true);
    try {
      const res = await fetch(`/api/client/5/delete-image?filename=${encodeURIComponent(imageToDelete.name)}`, {
        method: "DELETE",
      });

      const result = await res.json();

      if (res.ok) {
        // ถ้าลบสำเร็จ ปิด modal หรือไปรูปถัดไป
        if (data.pending.length > 1) {
          // ถ้ามีรูปอื่นอีก ไปรูปถัดไป
          const newIndex = selectedImageIndex >= data.pending.length - 1 ? 0 : selectedImageIndex;
          setSelectedImageIndex(newIndex);
        } else {
          // ถ้าเป็นรูปสุดท้าย ปิด modal
          setSelectedImageIndex(null);
        }
      } else {
        alert(result.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setDeletingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Client 5</h1>
            <p className="text-sm text-gray-500">จัดการ Roll</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Restart Service Button */}
            <button
              onClick={handleRestartService}
              disabled={restarting}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                restarting
                  ? "bg-gray-200 text-gray-400 cursor-wait"
                  : "bg-orange-100 text-orange-700 hover:bg-orange-200 active:bg-orange-300"
              }`}
              title="Restart Scanner Service"
            >
              {restarting ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Restarting...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restart
                </span>
              )}
            </button>
            {/* SSE Connection Status */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? "bg-green-500" : "bg-red-500"
                }`}
              ></span>
              <span className="text-xs text-gray-500">
                {connected ? "Live" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-md mx-auto w-full">
        {/* Scanner Status Card */}
        <div className="mb-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-600">Scanner Status</h3>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  scannerOnline === "online" && scannerInfo?.scanner_connected
                    ? "bg-green-500"
                    : scannerOnline === "checking"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
                }`}
              ></span>
              <span className={`text-xs font-medium ${
                scannerOnline === "online" && scannerInfo?.scanner_connected
                  ? "text-green-600"
                  : scannerOnline === "checking"
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}>
                {scannerOnline === "checking"
                  ? "Checking..."
                  : scannerOnline === "online" && scannerInfo?.scanner_connected
                  ? "Connected"
                  : "Disconnected"}
              </span>
            </div>
          </div>

          {scannerInfo && scannerOnline === "online" ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Device</p>
                <p className="font-medium text-gray-800">{scannerInfo.device}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Profile</p>
                <p className="font-medium text-gray-800">{scannerInfo.profile}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Scanner</p>
                <p className={`font-medium ${scannerInfo.scanner_connected ? "text-green-600" : "text-red-600"}`}>
                  {scannerInfo.scanner_connected ? "Connected" : "Disconnected"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Status</p>
                <p className={`font-medium ${scannerInfo.is_scanning ? "text-blue-600" : "text-gray-600"}`}>
                  {scannerInfo.is_scanning ? "Scanning..." : "Idle"}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-red-600 text-sm">ไม่สามารถเชื่อมต่อ Scanner ได้</p>
            </div>
          )}
        </div>

        {/* Big Scan Button */}
        <div className="mb-6">
          <button
            onClick={handleScan}
            disabled={scannerInfo?.is_scanning || scannerOnline !== "online" || !scannerInfo?.scanner_connected}
            className={`w-full py-6 rounded-2xl font-bold text-2xl shadow-lg transition-all duration-200 flex items-center justify-center gap-3 ${
              scannerInfo?.is_scanning
                ? "bg-blue-400 text-white cursor-wait"
                : scannerOnline !== "online" || !scannerInfo?.scanner_connected
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 active:scale-[0.98]"
            }`}
          >
            {scannerInfo?.is_scanning ? (
              <>
                <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Scan</span>
              </>
            )}
          </button>
        </div>

        {/* Pending Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
              รอ Roll ({data?.pending.length || 0} ไฟล์)
            </h2>
            <div className="flex items-center gap-2">
              {/* Clear Button */}
              {data?.pending.length ? (
                <button
                  onClick={handleClear}
                  disabled={clearing}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    clearing
                      ? "bg-gray-200 text-gray-400"
                      : "bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300"
                  }`}
                >
                  {clearing ? "กำลังลบ..." : "Clear"}
                </button>
              ) : null}
              {/* Upload PDF Button */}
              <label className="cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleUploadPDF}
                  className="hidden"
                  disabled={uploading}
                />
                <span
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    uploading
                      ? "bg-gray-200 text-gray-400"
                      : "bg-purple-100 text-purple-700 hover:bg-purple-200 active:bg-purple-300"
                  }`}
                >
                  {uploading ? "กำลัง Upload..." : "+ Upload PDF"}
                </span>
              </label>
            </div>
          </div>

          {!data?.pending.length ? (
            <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">ยังไม่มีไฟล์</p>
              <p className="text-gray-400 text-sm mt-1">รอเครื่อง roll ส่งไฟล์มา หรือ upload PDF</p>
            </div>
          ) : (
            <>
              {/* Horizontal Scrollable Preview */}
              <div className="relative">
                <div
                  ref={scrollContainerRef}
                  className="flex gap-3 overflow-x-auto pb-4 px-1 snap-x snap-mandatory scrollbar-hide"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {data.pending.slice(0, showAllImages ? undefined : 6).map((file, index) => {
                    const displayNumber = index + 1;
                    const originalIndex = index;
                    return (
                      <div
                        key={`${file.name}-${file.createdAt}`}
                        className="flex-shrink-0 snap-start"
                        onClick={() => setSelectedImageIndex(originalIndex)}
                      >
                        <div className="w-28 bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 transition-all duration-200 active:scale-95 hover:shadow-lg cursor-pointer">
                          {/* Document Preview */}
                          <div className="aspect-[3/4] bg-gradient-to-b from-gray-50 to-gray-100 relative overflow-hidden">
                            <img key={`${file.name}-${file.createdAt}-${cacheVersion}`}
                              src={`/uploads/5/pending/${file.name}?v=${file.createdAt}&t=${cacheVersion}`}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                            {/* Page Number Badge */}
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                              {displayNumber}
                            </div>
                          </div>
                          {/* Document Footer */}
                          <div className="px-2 py-2 bg-white border-t border-gray-100">
                            <p className="text-[10px] text-gray-500 truncate text-center">
                              หน้า {displayNumber}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* View More Card */}
                  {!showAllImages && data.pending.length > 6 && (
                    <div
                      className="flex-shrink-0 snap-start"
                      onClick={() => setShowAllImages(true)}
                    >
                      <div className="w-28 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-md overflow-hidden border border-purple-200 transition-all duration-200 active:scale-95 hover:shadow-lg cursor-pointer">
                        <div className="aspect-[3/4] flex flex-col items-center justify-center p-3">
                          <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center mb-2">
                            <span className="text-purple-700 font-bold text-sm">+{data.pending.length - 6}</span>
                          </div>
                          <p className="text-purple-700 text-xs font-medium text-center">ดูทั้งหมด</p>
                        </div>
                        <div className="px-2 py-2 bg-purple-100/50 border-t border-purple-200">
                          <p className="text-[10px] text-purple-600 text-center font-medium">
                            {data.pending.length} ไฟล์
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Scroll Indicator Dots */}
                {data.pending.length > 3 && (
                  <div className="flex justify-center gap-1.5 mt-2">
                    {Array.from({ length: Math.min(Math.ceil((showAllImages ? data.pending.length : Math.min(data.pending.length, 6)) / 3), 5) }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === 0 ? 'bg-purple-500' : 'bg-gray-300'}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Collapse Button */}
              {showAllImages && data.pending.length > 6 && (
                <button
                  onClick={() => setShowAllImages(false)}
                  className="mt-3 w-full py-2 text-sm text-purple-600 font-medium hover:bg-purple-50 rounded-lg transition-colors"
                >
                  ย่อรูปภาพ
                </button>
              )}

              {/* Image Preview Modal */}
              {selectedImageIndex !== null && data.pending[selectedImageIndex] && (
                <div
                  className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                  onClick={() => setSelectedImageIndex(null)}
                >
                  {/* Close Button */}
                  <button
                    className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                    onClick={() => setSelectedImageIndex(null)}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Delete Button */}
                  <button
                    className="absolute top-4 right-16 w-10 h-10 bg-red-500/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-red-600/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteImage();
                    }}
                    disabled={deletingImage}
                  >
                    {deletingImage ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>

                  {/* Previous Button */}
                  <button
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviousImage();
                    }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Next Button */}
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Image */}
                  <img
                    key={`${data.pending[selectedImageIndex].name}-${data.pending[selectedImageIndex].createdAt}-${cacheVersion}`}
                    src={`/uploads/5/pending/${data.pending[selectedImageIndex].name}?v=${data.pending[selectedImageIndex].createdAt}&t=${cacheVersion}`}
                    alt={data.pending[selectedImageIndex].name}
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* Image Counter & Slider */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
                    <div className="bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
                      {selectedImageIndex + 1} / {data.pending.length}
                    </div>
                    {data.pending.length > 1 && (
                      <div className="flex items-center gap-3 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
                        <span className="text-white text-xs">1</span>
                        <input
                          type="range"
                          min="0"
                          max={data.pending.length - 1}
                          value={selectedImageIndex}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedImageIndex(Number(e.target.value));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-48 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                        />
                        <span className="text-white text-xs">{data.pending.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Finish Button */}
        {data?.pending.length ? (
          !isFinishing ? (
            <button
              onClick={() => setIsFinishing(true)}
              className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold shadow-md hover:bg-green-700 active:bg-green-800 transition-colors mb-6"
            >
              Roll เสร็จ - สร้าง Folder
            </button>
          ) : (
            <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200 mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">กรอกข้อมูลองค์กร</h3>

              {/* เขต - Autocomplete */}
              <div className="mb-3 relative" ref={districtDropdownRef}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  เขต <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.districtOfficeName}
                  onChange={(e) => handleDistrictInputChange(e.target.value)}
                  onFocus={() => setShowDistrictDropdown(true)}
                  placeholder="พิมพ์เพื่อค้นหา หรือเลือกจากรายการ"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  autoFocus
                  disabled={processing}
                  autoComplete="off"
                />

                {/* Dropdown */}
                {showDistrictDropdown && filteredDistricts.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredDistricts.map((district, index) => (
                      <div
                        key={index}
                        onClick={() => handleSelectDistrict(district)}
                        className="px-4 py-2 hover:bg-green-50 cursor-pointer text-gray-900 text-sm transition-colors"
                      >
                        {district}
                      </div>
                    ))}
                  </div>
                )}

                {showDistrictDropdown && filteredDistricts.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                    <p className="text-gray-500 text-sm text-center">ไม่พบเขตที่ค้นหา</p>
                  </div>
                )}
              </div>

              {/* เลขลำดับ */}
              <div className="mb-3">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  เลขลำดับ <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.orderNumber}
                  onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  placeholder="เช่น 1, 1.1, 1.2, 2..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  disabled={processing}
                />
              </div>

              {/* ชื่อองค์กร */}
              <div className="mb-3">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  ชื่อมูลนิธิ/สมาคม <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น มูลนิธิจอมทอง"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  disabled={processing}
                />
              </div>

              {/* ประเภท */}
              <div className="mb-3">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  ประเภท <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  disabled={processing}
                >
                  <option value="มูลนิธิ">มูลนิธิ</option>
                  <option value="สมาคม">สมาคม</option>
                </select>
              </div>

              {/* เลข กท */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  เลข กท <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="เช่น 30, 31"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  disabled={processing}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleFinish}
                  disabled={processing}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 active:bg-green-800 transition-colors disabled:bg-gray-400"
                >
                  {processing ? "กำลังสร้าง..." : "สร้าง"}
                </button>
                <button
                  onClick={() => {
                    setIsFinishing(false);
                    setFormData({
                      districtOfficeName: "",
                      orderNumber: "",
                      name: "",
                      type: "มูลนิธิ",
                      registrationNumber: "",
                    });
                  }}
                  disabled={processing}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 active:bg-gray-400 transition-colors disabled:bg-gray-100"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )
        ) : null}

        {/* Completed Section */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Folder ที่สร้างแล้ว ({data?.completed.length || 0})
          </h2>

          {!data?.completed.length ? (
            <div className="bg-white rounded-lg p-6 text-center border-2 border-dashed border-gray-300">
              <p className="text-gray-400 text-sm">ยังไม่มี folder</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.completed.map((folder) => (
                <div
                  key={folder.name}
                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{folder.name}</p>
                      <p className="text-xs text-gray-500">{folder.fileCount} ไฟล์</p>
                    </div>
                    <button
                      onClick={() => setUploadToGroupModal({isOpen: true, groupName: folder.name})}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors mr-2"
                    >
                      + PDF
                    </button>
                    <button
                      onClick={() => handleViewCompletedFolder(folder.name)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                    >
                      ดู
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Upload Progress Modal */}
      {uploadProgress.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 ${uploadProgress.isError ? 'bg-red-500' : uploadProgress.isComplete ? 'bg-green-500' : 'bg-purple-500'}`}>
              <div className="flex items-center gap-3">
                {uploadProgress.isError ? (
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                ) : uploadProgress.isComplete ? (
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                    <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                <div>
                  <h3 className="text-white font-semibold text-lg">
                    {uploadProgress.isError ? 'เกิดข้อผิดพลาด' : uploadProgress.isComplete ? 'เสร็จสิ้น!' : 'กำลัง Upload PDF'}
                  </h3>
                  <p className="text-white/80 text-sm">
                    {uploadProgress.isError ? 'ไม่สามารถประมวลผลได้' : uploadProgress.isComplete ? 'ประมวลผลเรียบร้อย' : 'กรุณารอสักครู่...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {uploadProgress.isError ? (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-semibold text-sm mb-2">รายละเอียดข้อผิดพลาด:</p>
                    <p className="text-red-700 text-sm break-words">{uploadProgress.errorMessage}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-gray-600 text-xs">
                      <strong>การแก้ไข:</strong><br/>
                      • ตรวจสอบว่าไฟล์ PDF ไม่เสียหาย<br/>
                      • ตรวจสอบ pdftoppm ติดตั้งแล้ว<br/>
                      • ลองใช้ไฟล์ PDF อื่น<br/>
                      • ดู Console (F12) สำหรับข้อมูลเพิ่มเติม
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">ความคืบหน้า</span>
                      <span className="text-sm font-bold text-purple-600">{uploadProgress.percent}%</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${uploadProgress.isComplete ? 'bg-green-500' : 'bg-purple-500'}`}
                        style={{ width: `${uploadProgress.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Message */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-700 text-sm font-medium">{uploadProgress.message}</p>
                    {uploadProgress.current !== undefined && uploadProgress.total !== undefined && (
                      <p className="text-gray-500 text-xs mt-1">
                        หน้า {uploadProgress.current} จาก {uploadProgress.total}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {(uploadProgress.isComplete || uploadProgress.isError) && (
              <div className="px-6 pb-5">
                <button
                  onClick={closeProgressModal}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    uploadProgress.isError
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {uploadProgress.isError ? 'ปิด' : 'เสร็จสิ้น'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload PDF to Group Modal */}
      {uploadToGroupModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Upload PDF ย้อนหลัง</h3>
            <p className="text-sm text-gray-600 mb-4">เพิ่มรูปจาก PDF ไปต่อท้ายใน: <span className="font-semibold">{uploadToGroupModal.groupName}</span></p>
            <input ref={pdfToGroupInputRef} type="file" accept=".pdf" onChange={handleUploadPDFToGroup} className="hidden" />
            <div className="flex gap-3">
              <button onClick={() => pdfToGroupInputRef.current?.click()} className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors">เลือกไฟล์ PDF</button>
              <button onClick={() => setUploadToGroupModal({isOpen: false, groupName: ""})} className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload PDF to Group Progress Modal */}
      {uploadToGroupProgress.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {uploadToGroupProgress.isComplete ? (<><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Upload สำเร็จ</>) : uploadToGroupProgress.isError ? (<><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>เกิดข้อผิดพลาด</>) : (<><svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>กำลัง Upload...</>)}
              </h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              {uploadToGroupProgress.isError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800 text-sm font-medium">{uploadToGroupProgress.errorMessage || "เกิดข้อผิดพลาด"}</p></div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600 font-medium">{uploadToGroupProgress.step}</span><span className="text-purple-600 font-bold">{uploadToGroupProgress.percent}%</span></div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300 ease-out rounded-full" style={{ width: `${uploadToGroupProgress.percent}%` }} /></div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-700 text-sm font-medium">{uploadToGroupProgress.message}</p>
                    {uploadToGroupProgress.current !== undefined && uploadToGroupProgress.total !== undefined && (<p className="text-gray-500 text-xs mt-1">หน้า {uploadToGroupProgress.current} จาก {uploadToGroupProgress.total}</p>)}
                  </div>
                </>
              )}
            </div>
            {(uploadToGroupProgress.isComplete || uploadToGroupProgress.isError) && (
              <div className="px-6 pb-5">
                <button onClick={closeUploadToGroupModal} className={`w-full py-3 rounded-lg font-semibold transition-colors ${uploadToGroupProgress.isError ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}>{uploadToGroupProgress.isError ? 'ปิด' : 'เสร็จสิ้น'}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed Folder Image Preview Modal */}
      {selectedCompletedFolder && selectedCompletedImageIndex !== null && completedFolderImages.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={closeCompletedImageModal}>
          <button className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors" onClick={closeCompletedImageModal}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors" onClick={(e) => { e.stopPropagation(); handlePreviousCompletedImage(); }}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
          <button className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors" onClick={(e) => { e.stopPropagation(); handleNextCompletedImage(); }}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
          <img key={`${selectedCompletedFolder}-${completedFolderImages[selectedCompletedImageIndex]}-${cacheVersion}`} src={`/uploads/5/completed/${selectedCompletedFolder}/${completedFolderImages[selectedCompletedImageIndex]}?v=${cacheVersion}`} alt={completedFolderImages[selectedCompletedImageIndex]} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
            <div className="bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">{selectedCompletedImageIndex + 1} / {completedFolderImages.length}</div>
            {completedFolderImages.length > 1 && (<div className="flex items-center gap-3 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full"><span className="text-white text-xs">1</span><input type="range" min="0" max={completedFolderImages.length - 1} value={selectedCompletedImageIndex} onChange={(e) => { e.stopPropagation(); setSelectedCompletedImageIndex(Number(e.target.value)); }} onClick={(e) => e.stopPropagation()} className="w-48 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0" /><span className="text-white text-xs">{completedFolderImages.length}</span></div>)}
          </div>
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">{selectedCompletedFolder}</div>
        </div>
      )}
    </div>
  );
}

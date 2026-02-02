import fs from 'fs/promises';
import path from 'path';

const touchStates = `  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);`;

const swipeHandlers = `
  // Swipe handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNextImage();
    }
    if (isRightSwipe) {
      handlePreviousImage();
    }
  };

  const onCompletedTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNextCompletedImage();
    }
    if (isRightSwipe) {
      handlePreviousCompletedImage();
    }
  };`;

for (let clientId = 2; clientId <= 10; clientId++) {
  const filePath = `app/client/${clientId}/page.tsx`;

  try {
    let content = await fs.readFile(filePath, 'utf8');

    // Skip if already has touchStart state
    if (content.includes('touchStart')) {
      console.log(`✓ Client ${clientId}: Already has swipe gestures`);
      continue;
    }

    // 1. Add touch states after districtDropdownRef
    content = content.replace(
      /const districtDropdownRef = useRef<HTMLDivElement>\(null\);/,
      `const districtDropdownRef = useRef<HTMLDivElement>(null);\n${touchStates}`
    );

    // 2. Add swipe handlers after the useEffect for selectedCompletedImageIndex
    content = content.replace(
      /(}, \[selectedCompletedImageIndex, selectedCompletedFolder\]\);)/,
      `$1\n${swipeHandlers}`
    );

    // 3. Fix priority preload for pending - add setTimeout
    content = content.replace(
      /\/\/ Priority preload for pending images\n  useEffect\(\(\) => \{[\s\S]*?}, \[selectedImageIndex, data\?\. pending\]\);/,
      `// Priority preload for pending images - load current first, then surrounding
  useEffect(() => {
    if (selectedImageIndex === null || !data?.pending.length) return;

    const preloadRange = 2; // Preload 2 images before and after

    // Priority 1: Load current image immediately
    const currentFile = data.pending[selectedImageIndex];
    if (currentFile) {
      const currentImg = new Image();
      currentImg.src = \`/api/images/${clientId}/pending/\${currentFile.name}?v=\${currentFile.createdAt}\`;

      // Priority 2: Preload surrounding images after a short delay
      setTimeout(() => {
        const imagesToPreload: number[] = [];

        // Add surrounding images
        for (let i = 1; i <= preloadRange; i++) {
          // Next images
          const nextIndex = (selectedImageIndex + i) % data.pending.length;
          imagesToPreload.push(nextIndex);

          // Previous images
          const prevIndex = (selectedImageIndex - i + data.pending.length) % data.pending.length;
          imagesToPreload.push(prevIndex);
        }

        // Preload surrounding images
        imagesToPreload.forEach((index) => {
          const file = data.pending[index];
          if (file) {
            const img = new Image();
            img.src = \`/api/images/${clientId}/pending/\${file.name}?v=\${file.createdAt}\`;
          }
        });
      }, 100); // Delay 100ms to prioritize current image
    }
  }, [selectedImageIndex, data?.pending]);`
    );

    // 4. Fix priority preload for completed - add setTimeout
    content = content.replace(
      /\/\/ Priority preload for completed folder images\n  useEffect\(\(\) => \{[\s\S]*?}, \[selectedCompletedImageIndex, completedFolderImages, selectedCompletedFolder\]\);/,
      `// Priority preload for completed folder images - load current first, then surrounding
  useEffect(() => {
    if (selectedCompletedImageIndex === null || !completedFolderImages.length || !selectedCompletedFolder) return;

    const preloadRange = 2; // Preload 2 images before and after

    // Priority 1: Load current image immediately
    const currentFilename = completedFolderImages[selectedCompletedImageIndex];
    if (currentFilename) {
      const currentImg = new Image();
      currentImg.src = \`/api/images/${clientId}/completed/\${selectedCompletedFolder}/\${currentFilename}?thumbnail=true\`;

      // Priority 2: Preload surrounding images after a short delay
      setTimeout(() => {
        const imagesToPreload: number[] = [];

        // Add surrounding images
        for (let i = 1; i <= preloadRange; i++) {
          // Next images
          const nextIndex = (selectedCompletedImageIndex + i) % completedFolderImages.length;
          imagesToPreload.push(nextIndex);

          // Previous images
          const prevIndex = (selectedCompletedImageIndex - i + completedFolderImages.length) % completedFolderImages.length;
          imagesToPreload.push(prevIndex);
        }

        // Preload surrounding images
        imagesToPreload.forEach((index) => {
          const filename = completedFolderImages[index];
          if (filename) {
            const img = new Image();
            img.src = \`/api/images/${clientId}/completed/\${selectedCompletedFolder}/\${filename}?thumbnail=true\`;
          }
        });
      }, 100); // Delay 100ms to prioritize current image
    }
  }, [selectedCompletedImageIndex, completedFolderImages, selectedCompletedFolder]);`
    );

    // 5. Add touch events to pending modal
    content = content.replace(
      /(className="fixed inset-0 z-50 bg-black\/90 flex items-center justify-center p-4"\n\s+onClick=\{\(\) => setSelectedImageIndex\(null\)\})/,
      `$1\n                  onTouchStart={onTouchStart}\n                  onTouchMove={onTouchMove}\n                  onTouchEnd={onTouchEnd}`
    );

    // 6. Add touch events to completed modal
    content = content.replace(
      /(className="fixed inset-0 z-50 bg-black\/90 flex items-center justify-center p-4" onClick=\{closeCompletedImageModal\})/,
      `$1\n          onTouchStart={onTouchStart}\n          onTouchMove={onTouchMove}\n          onTouchEnd={onCompletedTouchEnd}`
    );

    await fs.writeFile(filePath, content);
    console.log(`✓ Client ${clientId} updated`);
  } catch (error) {
    console.error(`✗ Client ${clientId} error:`, error.message);
  }
}

console.log('\n✅ All clients updated!');

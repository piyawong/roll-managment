import fs from 'fs/promises';

for (let clientId = 2; clientId <= 10; clientId++) {
  const filePath = `app/client/${clientId}/page.tsx`;

  try {
    let content = await fs.readFile(filePath, 'utf8');

    // Check if already fixed
    if (content.includes('Priority 1: Load current image immediately')) {
      console.log(`✓ Client ${clientId}: Already has priority load`);
      continue;
    }

    // Fix pending images preload
    const pendingPreloadOld = /\/\/ Priority preload for pending images\s+useEffect\(\(\) => \{[\s\S]*?  \}, \[selectedImageIndex, data\?\.pending\]\);/;

    const pendingPreloadNew = `// Priority preload for pending images - load current first, then surrounding
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
  }, [selectedImageIndex, data?.pending]);`;

    content = content.replace(pendingPreloadOld, pendingPreloadNew);

    // Fix completed images preload
    const completedPreloadOld = /\/\/ Priority preload for completed folder images\s+useEffect\(\(\) => \{[\s\S]*?  \}, \[selectedCompletedImageIndex, completedFolderImages, selectedCompletedFolder\]\);/;

    const completedPreloadNew = `// Priority preload for completed folder images - load current first, then surrounding
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
  }, [selectedCompletedImageIndex, completedFolderImages, selectedCompletedFolder]);`;

    content = content.replace(completedPreloadOld, completedPreloadNew);

    await fs.writeFile(filePath, content);
    console.log(`✓ Client ${clientId} priority preload updated`);
  } catch (error) {
    console.error(`✗ Client ${clientId} error:`, error.message);
  }
}

console.log('\n✅ All clients updated!');

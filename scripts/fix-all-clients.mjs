import fs from 'fs/promises';

const swipeHandlers = `  // Swipe handlers
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
  };
`;

for (let clientId = 3; clientId <= 10; clientId++) {
  const filePath = `app/client/${clientId}/page.tsx`;

  try {
    let content = await fs.readFile(filePath, 'utf8');

    // Check if already has swipe handlers
    if (content.includes('const onTouchStart')) {
      console.log(`✓ Client ${clientId}: Already has swipe handlers`);
      continue;
    }

    // Find position to insert (before "// Filter districts")
    const insertBefore = '  // Filter districts when user types';
    const insertPos = content.indexOf(insertBefore);

    if (insertPos === -1) {
      console.log(`✗ Client ${clientId}: Cannot find insertion point`);
      continue;
    }

    // Insert swipe handlers
    const newContent = content.substring(0, insertPos) + swipeHandlers + '\n' + content.substring(insertPos);

    await fs.writeFile(filePath, newContent);
    console.log(`✓ Client ${clientId} swipe handlers added`);
  } catch (error) {
    console.error(`✗ Client ${clientId} error:`, error.message);
  }
}

console.log('\n✅ All clients updated!');

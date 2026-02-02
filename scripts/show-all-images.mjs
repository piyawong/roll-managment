import fs from 'fs/promises';

for (let clientId = 2; clientId <= 10; clientId++) {
  const filePath = `app/client/${clientId}/page.tsx`;

  try {
    let content = await fs.readFile(filePath, 'utf8');

    // 1. Remove showAllImages state
    content = content.replace(
      /const \[showAllImages, setShowAllImages\] = useState\(false\);?\n?/,
      ''
    );

    // 2. Change slice to show all images
    content = content.replace(
      /data\.pending\.slice\(0, showAllImages \? undefined : 6\)/,
      'data.pending'
    );

    // 3. Remove "View More Card" (+44)
    const viewMoreCard = /\{\/\* View More Card \*\/\}\s+\{!showAllImages && data\.pending\.length > 6 && \([\s\S]*?\)\s+\)\}/;
    content = content.replace(viewMoreCard, '');

    // 4. Remove "Collapse Button"
    const collapseButton = /\{\/\* Collapse Button \*\/\}\s+\{showAllImages && data\.pending\.length > 6 && \([\s\S]*?\)\s+\)\}/;
    content = content.replace(collapseButton, '');

    // 5. Change smooth scroll to instant
    content = content.replace(
      /scrollContainerRef\.current\.scrollTo\(\{ left: scrollTo, behavior: 'smooth' \}\);/,
      'scrollContainerRef.current.scrollLeft = scrollTo; // Instant scroll, no smooth animation'
    );

    await fs.writeFile(filePath, content);
    console.log(`✓ Client ${clientId} updated to show all images`);
  } catch (error) {
    console.error(`✗ Client ${clientId} error:`, error.message);
  }
}

console.log('\n✅ All clients updated!');

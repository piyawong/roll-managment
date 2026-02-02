import fs from 'fs/promises';

for (let clientId = 2; clientId <= 10; clientId++) {
  const filePath = `app/client/${clientId}/page.tsx`;

  try {
    let content = await fs.readFile(filePath, 'utf8');

    // Check if already has scrollPosition state
    if (content.includes('scrollPosition')) {
      console.log(`✓ Client ${clientId}: Already has scroll slider`);
      continue;
    }

    // 1. Add scrollPosition state after touchEnd
    content = content.replace(
      /const \[touchEnd, setTouchEnd\] = useState<number \| null>\(null\);/,
      `const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);`
    );

    // 2. Add scroll handlers after onCompletedTouchEnd
    const scrollHandlers = `

  // Handle scroll position update
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;
    const position = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0;
    setScrollPosition(position);
  };

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const position = Number(e.target.value);
    setScrollPosition(position);

    if (scrollContainerRef.current) {
      const maxScroll = scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth;
      const scrollTo = (position / 100) * maxScroll;
      scrollContainerRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };`;

    // Find position after onCompletedTouchEnd
    const insertAfter = /  const onCompletedTouchEnd = \(\) => \{[\s\S]*?  \};/;
    content = content.replace(insertAfter, (match) => match + scrollHandlers);

    // 3. Add onScroll event to scroll container
    content = content.replace(
      /(className="flex gap-3 overflow-x-auto pb-4 px-1 snap-x snap-mandatory scrollbar-hide"\n\s+style=\{\{ scrollbarWidth: 'none', msOverflowStyle: 'none' \}\})/,
      `$1\n                  onScroll={handleScroll}`
    );

    // 4. Replace Scroll Indicator Dots with Slider
    const oldDots = /\{\/\* Scroll Indicator Dots \*\/\}[\s\S]*?\{data\.pending\.length > 3 && \([\s\S]*?\{Array\.from[\s\S]*?\}\n\s+\)\}\n\s+\}\n\s+\)\n\s+\}\)/;

    const newSlider = `{/* Scroll Slider */}
                {showAllImages && data.pending.length > 3 && (
                  <div className="mt-3 px-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-medium">1</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={scrollPosition}
                        onChange={handleSliderChange}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-purple-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                      />
                      <span className="text-xs text-gray-500 font-medium">{data.pending.length}</span>
                    </div>
                  </div>
                )}`;

    content = content.replace(oldDots, newSlider);

    await fs.writeFile(filePath, content);
    console.log(`✓ Client ${clientId} scroll slider added`);
  } catch (error) {
    console.error(`✗ Client ${clientId} error:`, error.message);
  }
}

console.log('\n✅ All clients updated!');

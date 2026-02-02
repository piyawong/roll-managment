import fs from 'fs/promises';

const clients = [2, 3, 5, 6, 7, 8, 9, 10];

for (const clientId of clients) {
  const filePath = `app/client/${clientId}/page.tsx`;

  try {
    let content = await fs.readFile(filePath, 'utf8');

    // 1. Replace Scroll Indicator Dots with Slider
    const oldDots = /\{\/\* Scroll Indicator Dots \*\/\}\s+\{data\.pending\.length > 3 && \([\s\S]*?\)\s+\)\}/;

    const newSlider = `{/* Scroll Slider - แสดงเมื่อมีรูปมากกว่า 3 */}
                {data.pending.length > 3 && (
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

    // 2. Add ?thumbnail=true to pending modal image
    content = content.replace(
      new RegExp(`src={\`/api/images/${clientId}/pending/\\$\\{data\\.pending\\[selectedImageIndex\\]\\.name\\}\\?v=\\$\\{data\\.pending\\[selectedImageIndex\\]\\.createdAt\\}\`}`, 'g'),
      `src={\`/api/images/${clientId}/pending/\${data.pending[selectedImageIndex].name}?thumbnail=true&v=\${data.pending[selectedImageIndex].createdAt}\`}`
    );

    // 3. Add ?thumbnail=true to preload (if not already there)
    content = content.replace(
      new RegExp(`img\\.src = \`/api/images/${clientId}/pending/\\$\\{currentFile\\.name\\}\\?v=\\$\\{currentFile\\.createdAt\\}\`;`, 'g'),
      `img.src = \`/api/images/${clientId}/pending/\${currentFile.name}?thumbnail=true&v=\${currentFile.createdAt}\`;`
    );

    content = content.replace(
      new RegExp(`img\\.src = \`/api/images/${clientId}/pending/\\$\\{file\\.name\\}\\?v=\\$\\{file\\.createdAt\\}\`;`, 'g'),
      `img.src = \`/api/images/${clientId}/pending/\${file.name}?thumbnail=true&v=\${file.createdAt}\`;`
    );

    await fs.writeFile(filePath, content);
    console.log(`✓ Client ${clientId} fixed`);
  } catch (error) {
    console.error(`✗ Client ${clientId} error:`, error.message);
  }
}

console.log('\n✅ All clients fixed!');

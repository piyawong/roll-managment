#!/bin/bash

for i in {2..10}; do
  file="app/client/$i/page.tsx"
  echo "Processing client $i..."

  # 1. Add touchStart and touchEnd states after districtDropdownRef
  perl -i -pe '
    if (/const districtDropdownRef = useRef/) {
      $_ .= "  const [touchStart, setTouchStart] = useState<number | null>(null);\n  const [touchEnd, setTouchEnd] = useState<number | null>(null);\n";
    }
  ' "$file"

  # 2. Add swipe handlers after selectedCompletedImageIndex useEffect
  perl -i -0777 -pe "
    s|(useEffect\(\(\) => \{\n    // Reset image loading state.*?\n  }, \[selectedCompletedImageIndex, selectedCompletedFolder\]\);)|
\$1

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
  };|gs
  " "$file"

  # 3. Add swipe events to pending modal
  perl -i -pe '
    s|(className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"\n\s+onClick=\{\(\) => setSelectedImageIndex\(null\)\})|$1\n                  onTouchStart={onTouchStart}\n                  onTouchMove={onTouchMove}\n                  onTouchEnd={onTouchEnd}|
  ' "$file"

  # 4. Add swipe events to completed modal
  perl -i -pe '
    s|(className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick=\{closeCompletedImageModal\})|$1\n          onTouchStart={onTouchStart}\n          onTouchMove={onTouchMove}\n          onTouchEnd={onCompletedTouchEnd}|
  ' "$file"

  echo "✓ Client $i updated"
done

echo "✅ All clients updated with swipe gestures!"

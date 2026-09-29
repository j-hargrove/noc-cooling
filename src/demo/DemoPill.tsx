import { useEffect, useState } from 'react';

/**
 * Mobile only (CSS hides it above the breakpoint): a floating "Demo
 * controls" link down to the panel. It only floats while the app is on
 * screen — once less than half of it is visible, it fades out
 * (contract/components.md §9).
 */
export function DemoPill({ targetId }: { targetId: string }) {
  const [off, setOff] = useState(false);
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOff(e.intersectionRatio < 0.5), { threshold: [0, 0.5, 1] });
    io.observe(target);
    return () => io.disconnect();
  }, [targetId]);

  return (
    <a className={`demo-pill${off ? ' off' : ''}`} href="#panel" tabIndex={off ? -1 : undefined}>
      Demo controls
    </a>
  );
}

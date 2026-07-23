import { useState, useEffect } from 'react';

/**
 * True when the viewport is at or below `breakpoint` px wide. Used to swap
 * the desktop chrome (vertical bias/type/category lists) for the mobile
 * layout (horizontal, swipeable filter bars).
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);

  useEffect(() => {
    const checkWidth = () => setIsMobile(window.innerWidth <= breakpoint);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, [breakpoint]);

  return isMobile;
}

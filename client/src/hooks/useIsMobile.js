import { useState, useEffect } from 'react';

/**
 * useIsMobile Hook
 * 
 * Reactive hook to detect if the viewport matches a mobile breakpoint (default: 768px).
 * Listens to matchMedia change events for instant responsiveness when resizing or toggling device emulators.
 * 
 * @param {number} breakpoint - Max width in pixels for mobile view (default: 768)
 * @returns {boolean} - true if currently in mobile viewport, false otherwise
 */
export default function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
        const handleMediaChange = (e) => setIsMobile(e.matches);

        // Modern browsers
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleMediaChange);
            return () => mediaQuery.removeEventListener('change', handleMediaChange);
        } else {
            // Older Safari / WebKit fallback
            mediaQuery.addListener(handleMediaChange);
            return () => mediaQuery.removeListener(handleMediaChange);
        }
    }, [breakpoint]);

    return isMobile;
}

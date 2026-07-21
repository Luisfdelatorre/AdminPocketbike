import { useEffect } from 'react';

const DOWN_THRESHOLD = 10;
const UP_THRESHOLD = 15;

const useFilterVisibilityOnScroll = (setShowFilters) => {
    useEffect(() => {
        const content = document.querySelector('.admin-content');
        let lastWindowPosition = window.scrollY;
        let lastContentPosition = content?.scrollTop ?? 0;

        const updateVisibility = (currentPosition, previousPosition) => {
            const difference = currentPosition - previousPosition;

            if (difference > DOWN_THRESHOLD) {
                setShowFilters(false);
            } else if (difference < -UP_THRESHOLD) {
                setShowFilters(true);
            }
        };

        const handleWindowScroll = () => {
            const currentPosition = window.scrollY;
            updateVisibility(currentPosition, lastWindowPosition);
            lastWindowPosition = currentPosition;
        };

        const handleContentScroll = () => {
            const currentPosition = content.scrollTop;
            updateVisibility(currentPosition, lastContentPosition);
            lastContentPosition = currentPosition;
        };

        window.addEventListener('scroll', handleWindowScroll, { passive: true });
        content?.addEventListener('scroll', handleContentScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleWindowScroll);
            content?.removeEventListener('scroll', handleContentScroll);
        };
    }, [setShowFilters]);
};

export default useFilterVisibilityOnScroll;

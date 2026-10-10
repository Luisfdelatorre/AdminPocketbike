import { useEffect, useRef } from 'react';

const DOWN_THRESHOLD = 15;
const UP_THRESHOLD = 15;
const COOLDOWN_MS = 400; // Ignora eventos de scroll generados por el cambio de tamaño del layout

const useFilterVisibilityOnScroll = (setShowFilters) => {
    const lastToggleTimeRef = useRef(0);

    useEffect(() => {
        const content = document.querySelector('.admin-content');
        let lastWindowPosition = window.scrollY;
        let lastContentPosition = content?.scrollTop ?? 0;

        const updateVisibility = (currentPosition, previousPosition) => {
            // Previene bucle infinito ignorando el scroll inducido por el colapso/expansión del layout
            if (Date.now() - lastToggleTimeRef.current < COOLDOWN_MS) {
                return;
            }

            // En la parte superior del contenedor, mantener filtros visibles sin oscilar
            if (currentPosition <= 20) {
                return;
            }

            const difference = currentPosition - previousPosition;

            if (difference > DOWN_THRESHOLD) {
                lastToggleTimeRef.current = Date.now();
                setShowFilters(false);
            } else if (difference < -UP_THRESHOLD) {
                lastToggleTimeRef.current = Date.now();
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

import { useEffect } from 'react';

const useAdminScrollLock = (isLocked) => {
    useEffect(() => {
        if (!isLocked) {
            return undefined;
        }

        const content = document.querySelector('.admin-content');
        const previousBodyOverflow = document.body.style.overflow;
        const previousDocumentOverflow = document.documentElement.style.overflow;
        const previousBodyOverscroll = document.body.style.overscrollBehavior;
        const previousContentOverflow = content?.style.overflowY;
        const previousContentOverscroll = content?.style.overscrollBehaviorY;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';

        if (content) {
            content.style.overflowY = 'hidden';
            content.style.overscrollBehaviorY = 'none';
        }

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousDocumentOverflow;
            document.body.style.overscrollBehavior = previousBodyOverscroll;

            if (content) {
                content.style.overflowY = previousContentOverflow;
                content.style.overscrollBehaviorY = previousContentOverscroll;
            }
        };
    }, [isLocked]);
};

export default useAdminScrollLock;

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const MobileHeaderAction = ({ children }) => {
    const [container, setContainer] = useState(null);

    useEffect(() => {
        setContainer(document.getElementById('mobile-header-actions'));
    }, []);

    if (!container) return null;
    return createPortal(children, container);
};

export default MobileHeaderAction;

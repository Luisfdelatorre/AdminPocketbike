import React from 'react';

/**
 * Loader for the admin content area while a lazy tab page loads.
 * Lives inside AdminLayout's <main>, so the header, sidebar and bottom tab bar stay visible.
 */
const ContentLoader = () => (
    <div className="content-loader" role="status" aria-live="polite">
        <span className="content-loader-spinner" />
        <span className="sr-only">Cargando…</span>
    </div>
);

export default ContentLoader;

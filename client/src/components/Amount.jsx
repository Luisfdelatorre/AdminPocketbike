import React from 'react';

/**
 * Formats a numeric amount for desktop (full currency) and mobile (compact) display.
 * If `value` is undefined or null, renders $0.
 */
const Amount = ({ value }) => {
  if (value === undefined || value === null) {
    return (
      <>
        <span className="desktop-only">$0 COP</span>
        <span className="mobile-only">$0</span>
      </>
    );
  }
  const formattedDesktop = `$${value.toLocaleString()} COP`;
  const formattedMobile = `$${value.toLocaleString()}`;
  return (
    <>
      <span className="desktop-only">{formattedDesktop}</span>
      <span className="mobile-only">{formattedMobile}</span>
    </>
  );
};

export default Amount;

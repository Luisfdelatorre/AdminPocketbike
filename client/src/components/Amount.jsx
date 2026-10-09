import React from 'react';
import { formatCompact } from '../utils/helpers';

/**
 * Formats a numeric amount for desktop (full currency) and mobile (compact) display.
 * If `value` is undefined or null, renders $0.
 */
const Amount = ({ value, compact = true }) => {
  if (value === undefined || value === null) {
    return (
      <>
        <span className="desktop-only">$0 COP</span>
        <span className="mobile-only">$0</span>
      </>
    );
  }
  const num = Number(value);
  const formattedDesktop = isNaN(num) ? '$0 COP' : `$${num.toLocaleString('es-CO')} COP`;
  const formattedMobile = compact ? formatCompact(num) : (isNaN(num) ? '$0' : `$${num.toLocaleString('es-CO')}`);
  return (
    <>
      <span className="desktop-only">{formattedDesktop}</span>
      <span className="mobile-only">{formattedMobile}</span>
    </>
  );
};

export default Amount;

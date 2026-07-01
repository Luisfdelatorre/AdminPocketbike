import React from 'react';
/**
 * Displays a date string formatted for desktop and mobile.
 * Props:
 *  - dateString: ISO string or Date parsable string.
 *  - mobile: boolean optional, forces mobile format when true.
 */
const DateDisplay = ({ dateString }) => {
  if (!dateString) return <>
    <span className="desktop-only">--</span>
    <span className="mobile-only">--</span>
  </>;
  const date = new Date(dateString);
  // Desktop format (full): e.g., 2026 Sep 02, 03:45 PM
  const desktop = date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  // Mobile compact format: day month on two lines and time am/pm
  const day = date.getDate();
  const month = date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const mobile = (
    <div style={{ lineHeight: '1.2' }}>
      <div>{day} {month}</div>
      <div style={{ fontSize: '0.65rem', color: '#6B7280' }}>{hours}:{minutes}{ampm}</div>
    </div>
  );
  return (
    <>
      <span className="desktop-only">{desktop}</span>
      <span className="mobile-only">{mobile}</span>
    </>
  );
};
export default DateDisplay;

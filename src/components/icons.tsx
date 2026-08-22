/** Icons are decorative; every control that uses one carries its own label. */
const base = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const, 'aria-hidden': true,
};

export const Plus = () => (<svg {...base}><path d="M12 5v14M5 12h14" /></svg>);
export const Chevron = () => (<svg {...base} className="chev"><path d="m9 18 6-6-6-6" /></svg>);
export const Dots = () => (
  <svg {...base}><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" /></svg>
);
export const Close = () => (<svg {...base}><path d="M18 6 6 18M6 6l12 12" /></svg>);

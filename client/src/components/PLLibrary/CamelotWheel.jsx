import React from "react";
import { camelotColor } from "../../utils/harmonic";

// An interactive Camelot wheel used as a visual key filter. Outer ring = B
// (major), inner ring = A (minor), numbers 1-12 clockwise from the top — the
// layout DJs know from Mixed In Key / Rekordbox. Clicking a wedge toggles that
// key in the filter.

const SIZE = 300;
const CENTER = SIZE / 2;
const R_OUTER = 145;
const R_MID = 100; // boundary between the B (outer) and A (inner) rings
const R_INNER = 52;

// Polar (degrees, 0 = top, clockwise) to cartesian.
const pt = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
};

// Path for an annular wedge between two radii and two angles.
const wedge = (rInner, rOuter, startDeg, endDeg) => {
  const [x1, y1] = pt(rOuter, startDeg);
  const [x2, y2] = pt(rOuter, endDeg);
  const [x3, y3] = pt(rInner, endDeg);
  const [x4, y4] = pt(rInner, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
};

const CamelotWheel = ({ selected = [], onToggle }) => {
  const hasSelection = selected.length > 0;
  const segments = [];

  for (let n = 1; n <= 12; n++) {
    const startDeg = (n - 1) * 30 - 15;
    const endDeg = startDeg + 30;
    const midDeg = (n - 1) * 30;

    // Outer ring is B (major), inner ring is A (minor).
    [
      { letter: "B", rIn: R_MID, rOut: R_OUTER },
      { letter: "A", rIn: R_INNER, rOut: R_MID },
    ].forEach(({ letter, rIn, rOut }) => {
      const code = `${n}${letter}`;
      const color = camelotColor(code);
      const isSelected = selected.includes(code);
      const [lx, ly] = pt((rIn + rOut) / 2, midDeg);

      segments.push(
        <g
          key={code}
          onClick={() => onToggle && onToggle(code)}
          style={{ cursor: "pointer" }}
        >
          <path
            d={wedge(rIn, rOut, startDeg, endDeg)}
            fill={color.bg}
            stroke="#ffffff"
            strokeWidth={isSelected ? 3 : 1}
            opacity={hasSelection && !isSelected ? 0.3 : 1}
          />
          <text
            x={lx}
            y={ly}
            fill={color.text}
            fontSize="11"
            fontWeight="700"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ pointerEvents: "none" }}
          >
            {code}
          </text>
        </g>
      );
    });
  }

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ maxWidth: "100%", height: "auto" }}
    >
      {segments}
    </svg>
  );
};

export default CamelotWheel;

// grading.js - the grading scale, shared by the demo store and every screen.
// The Django backend (students/grading.py) uses the SAME scale, so numbers match.

const BANDS = [
  ["A", 90],
  ["B", 80],
  ["C", 70],
  ["D", 60],
];

export const LETTERS = ["A", "B", "C", "D", "F"];

export function percent(score, max) {
  return max > 0 ? (score / max) * 100 : 0;
}

export function letterFor(pct) {
  for (const [letter, min] of BANDS) if (pct >= min) return letter;
  return "F";
}

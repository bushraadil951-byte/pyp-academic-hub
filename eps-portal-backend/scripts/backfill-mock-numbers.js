// Guesses the IBT Mock number (1-5) from a test title such as "IBT Science Mock -2" or "IBT Mock Test-1 (English)".
// Returns null when the title has no clear number. Used by scripts/backfill-mock-numbers.js.
export function guessMockNumber(name) {
  const re = /(?:mock|test)[\s_-]*(?:no\.?|number|#)?[\s_-]*([1-5])(?!\d)/gi;
  let last = null;
  for (let m = re.exec(String(name || '')); m; m = re.exec(String(name || ''))) last = Number(m[1]);
  return last;
}

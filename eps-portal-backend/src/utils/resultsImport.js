// Turns one CSV row of answers (A/B/C/D per question) into a scored result. Pure (no database), so it is easy to test.
// Same marking as submit_test(): 1 mark per correct answer, per-section tallies.
import { scoreAttempt } from './scoring.js';

const LETTERS = { A: 0, B: 1, C: 2, D: 3 };
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// 'B' / 'b' -> 1. Also accepts "B)" / "B." and, for Google Forms exports, the text of the chosen option.
export function answerIndex(raw, options = []) {
  const v = String(raw ?? '').trim();
  if (!v) return { blank: true };
  const letter = v.toUpperCase().match(/^([ABCD])\s*[).:]?$/);
  if (letter) return { index: LETTERS[letter[1]] };
  const byText = options.findIndex((o) => norm(o) === norm(v));
  return byText >= 0 ? { index: byText } : { unreadable: true };
}

// questions: the test's questions; row: { q1: 'A', q2: 'c', ... }
export function evaluateRow(questions, row = {}) {
  const answers = {};
  let blank = 0; let unreadable = 0;
  questions.forEach((q, i) => {
    const r = answerIndex(row[`q${i + 1}`], q.options);
    if (r.blank) blank += 1;
    else if (r.unreadable) unreadable += 1;
    else answers[String(q.id)] = r.index;
  });
  const scored = scoreAttempt(questions, answers);
  return { answers, blank, unreadable, ...scored };
}

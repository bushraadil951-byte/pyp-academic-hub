import { round1 } from './math.js';

// Same maths as submit_test() in app.py: 1 mark per correct answer, per-section tallies.
export function scoreAttempt(questions, answers = {}) {
  let score = 0;
  const sectionScores = {};
  for (const q of questions) {
    const sec = q.section || 'General';
    sectionScores[sec] ??= { correct: 0, total: 0 };
    sectionScores[sec].total += 1;
    const given = answers[String(q.id)];
    if (given !== undefined && given !== null && Number(given) === q.answer) {
      score += 1;
      sectionScores[sec].correct += 1;
    }
  }
  const total = questions.length;
  return { score, total, percent: total ? round1((score / total) * 100) : 0, sectionScores };
}

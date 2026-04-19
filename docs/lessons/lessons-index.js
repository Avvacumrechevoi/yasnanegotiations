// ═══════════════════════════════════════════════════════════════════
// LESSONS INDEX — assembly point
// Each lesson-*.js pushes its data into window.YasnaLessons.lessons.
// This file exposes it as the LESSONS global that the app expects.
// Must load AFTER all lesson-*.js files.
// ═══════════════════════════════════════════════════════════════════

const LESSONS = window.YasnaLessons.lessons;
window.YasnaLessons.LESSONS = LESSONS;

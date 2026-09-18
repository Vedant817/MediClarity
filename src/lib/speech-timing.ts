const MINIMUM_WATCHDOG_MS = 12_000;
const MAXIMUM_WATCHDOG_MS = 90_000;
const EXPECTED_WORDS_PER_MINUTE = 145;
const WATCHDOG_GRACE_MS = 8_000;

export function speechWatchdogMs(text: string): number {
  const wordCount = text.trim().split(/\s+/u).filter(Boolean).length;
  const expectedSpeechMs = (wordCount / EXPECTED_WORDS_PER_MINUTE) * 60_000;
  return Math.min(
    MAXIMUM_WATCHDOG_MS,
    Math.max(MINIMUM_WATCHDOG_MS, Math.ceil(expectedSpeechMs + WATCHDOG_GRACE_MS)),
  );
}

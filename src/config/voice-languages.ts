export const VOICE_LANGUAGES = [
  { locale: "en-IN", preference: "en", label: "English (India)", nativeLabel: "English" },
  { locale: "hi-IN", preference: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { locale: "pa-IN", preference: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ" },
  { locale: "bn-IN", preference: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { locale: "ta-IN", preference: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { locale: "te-IN", preference: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { locale: "mr-IN", preference: "mr", label: "Marathi", nativeLabel: "मराठी" },
  { locale: "gu-IN", preference: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી" },
  { locale: "kn-IN", preference: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { locale: "ml-IN", preference: "ml", label: "Malayalam", nativeLabel: "മലയാളം" },
] as const;

export type VoiceLocale = (typeof VOICE_LANGUAGES)[number]["locale"];
export type PreferenceLocale = (typeof VOICE_LANGUAGES)[number]["preference"];

const localeSet = new Set<string>(VOICE_LANGUAGES.map((language) => language.locale));

export function isVoiceLocale(value: unknown): value is VoiceLocale {
  return typeof value === "string" && localeSet.has(value);
}

export function voiceLocaleForPreference(value: unknown): VoiceLocale {
  return VOICE_LANGUAGES.find((language) => language.preference === value)?.locale ?? "en-IN";
}

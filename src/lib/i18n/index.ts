/**
 * Localisation foundation (31-plan #31). Kept deliberately simple and honest: a
 * dictionary keyed by the English string, a pure `t()` that returns the
 * translation for the chosen language or **falls back to English** when a string
 * hasn't been translated yet. That fallback is what lets coverage roll out
 * incrementally without anything ever breaking or showing a blank.
 *
 * Hindi is the first language beyond English; more can be added by extending the
 * dictionary. Client components read the person's choice via the LanguageProvider.
 */
export type Lang = 'en' | 'hi';

export const LANGS: Array<{ code: Lang; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
];

const HI: Record<string, string> = {
  // Menu sections
  'My Day': 'मेरा दिन',
  'Sales & Leads': 'बिक्री और लीड',
  'Inventory & Bookings': 'इन्वेंटरी और बुकिंग',
  'Marketing': 'मार्केटिंग',
  'Money': 'पैसा',
  'Build & Site': 'निर्माण और साइट',
  'Land, Lease & Legal': 'भूमि, लीज़ और कानूनी',
  'Documents': 'दस्तावेज़',
  'Insights & Reports': 'इनसाइट्स और रिपोर्ट',
  'Team & Admin': 'टीम और एडमिन',
  // Common actions & labels
  'Save': 'सहेजें',
  'Cancel': 'रद्द करें',
  'Delete': 'हटाएं',
  'Add': 'जोड़ें',
  'Edit': 'संपादित करें',
  'Search': 'खोजें',
  'Close': 'बंद करें',
  'Send': 'भेजें',
  'Messages': 'संदेश',
  'Today': 'आज',
  'Dashboard': 'डैशबोर्ड',
  'Settings': 'सेटिंग्स',
  'Yes': 'हाँ',
  'No': 'नहीं',
  'Status': 'स्थिति',
  'Amount': 'राशि',
  'Date': 'तारीख',
  'Name': 'नाम',
  'Notes': 'टिप्पणियाँ',
  'Loading…': 'लोड हो रहा है…',
};

const TABLES: Record<Lang, Record<string, string>> = { en: {}, hi: HI };

/** Translate an English string into `lang`, falling back to the English itself. */
export function t(text: string, lang: Lang): string {
  if (lang === 'en') return text;
  return TABLES[lang]?.[text] ?? text;
}

export function isLang(v: string): v is Lang {
  return v === 'en' || v === 'hi';
}

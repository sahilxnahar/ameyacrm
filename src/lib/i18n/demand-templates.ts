/**
 * Multilingual payment-demand templates (module #71/#6). Reviewed, deterministic
 * translations for the dunning message in the four languages Ameya Heights buyers
 * use — English, Hindi, Kannada, Tamil. Deterministic beats live AI translation
 * for legal/financial dunning: no rate limits, no drift, no surprise wording, and
 * it can never block the send. An AI fallback (wrapped) covers anything else.
 */
export type DemandLang = 'en' | 'hi' | 'kn' | 'ta';
export const DEMAND_LANGS: Array<{ code: DemandLang; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ta', label: 'தமிழ்' },
];

export function isDemandLang(v: string | null | undefined): v is DemandLang {
  return v === 'en' || v === 'hi' || v === 'kn' || v === 'ta';
}

export interface DemandVars { name: string; label: string; amount: string; whenStr: string; overdue: boolean }

export function demandMessageIn(lang: DemandLang, v: DemandVars): string {
  switch (lang) {
    case 'hi':
      return v.overdue
        ? `प्रिय ${v.name},\n\nयह स्मरण पत्र है कि *${v.label}* हेतु आपकी ${v.amount} की राशि ${v.whenStr} को देय थी और अब विलंबित है। कृपया शीघ्र भुगतान करें।\n\n— आमेय हाइट्स`
        : `प्रिय ${v.name},\n\nयह एक विनम्र स्मरण है कि *${v.label}* हेतु आपकी ${v.amount} की राशि ${v.whenStr} को देय है। कृपया समय पर भुगतान करें।\n\n— आमेय हाइट्स`;
    case 'kn':
      return v.overdue
        ? `ಆತ್ಮೀಯ ${v.name},\n\n*${v.label}* ಗಾಗಿ ನಿಮ್ಮ ${v.amount} ಮೊತ್ತವು ${v.whenStr} ರಂದು ಪಾವತಿಸಬೇಕಿತ್ತು ಮತ್ತು ಈಗ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಶೀಘ್ರ ಪಾವತಿಸಿ.\n\n— ಅಮೇಯ ಹೈಟ್ಸ್`
        : `ಆತ್ಮೀಯ ${v.name},\n\n*${v.label}* ಗಾಗಿ ನಿಮ್ಮ ${v.amount} ಮೊತ್ತವು ${v.whenStr} ರಂದು ಪಾವತಿಸಬೇಕಿದೆ. ದಯವಿಟ್ಟು ಸಮಯಕ್ಕೆ ಪಾವತಿಸಿ.\n\n— ಅಮೇಯ ಹೈಟ್ಸ್`;
    case 'ta':
      return v.overdue
        ? `அன்புள்ள ${v.name},\n\n*${v.label}* க்கான உங்கள் ${v.amount} தொகை ${v.whenStr} அன்று செலுத்தப்பட வேண்டியிருந்தது, தற்போது நிலுவையில் உள்ளது. விரைவில் செலுத்தவும்.\n\n— அமேயா ஹைட்ஸ்`
        : `அன்புள்ள ${v.name},\n\n*${v.label}* க்கான உங்கள் ${v.amount} தொகை ${v.whenStr} அன்று செலுத்த வேண்டும். சரியான நேரத்தில் செலுத்தவும்.\n\n— அமேயா ஹைட்ஸ்`;
    case 'en':
    default:
      return v.overdue
        ? `Dear ${v.name},\n\nThis is a reminder that your payment towards *${v.label}* of *${v.amount}* was due on ${v.whenStr} and is now overdue.\n\nKindly arrange the payment at your earliest convenience.\n\n— Ameya Heights`
        : `Dear ${v.name},\n\nThis is a gentle reminder that your payment towards *${v.label}* of *${v.amount}* falls due on ${v.whenStr}.\n\nKindly arrange the payment on time.\n\n— Ameya Heights`;
  }
}

'use client';
import * as React from 'react';
import { Smartphone, Monitor, Download, Share, MoreVertical, CheckCircle2, BellRing } from 'lucide-react';

type Platform = 'android' | 'iphone' | 'desktop';

/** Detect the device so the right instructions are shown first. */
function guess(): Platform {
  if (typeof navigator === 'undefined') return 'android';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

const TABS: Array<{ id: Platform; label: string; icon: React.ElementType }> = [
  { id: 'android', label: 'Android', icon: Smartphone },
  { id: 'iphone', label: 'iPhone', icon: Smartphone },
  { id: 'desktop', label: 'Computer', icon: Monitor },
];

export function InstallGuide({ apkUrl, compact = false }: { apkUrl: string | null; compact?: boolean }) {
  const [tab, setTab] = React.useState<Platform>('android');
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    setTab(guess());
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  if (installed) {
    return (
      <p className="flex items-center gap-2 text-sm text-[#2A261E]">
        <CheckCircle2 className="h-4 w-4 text-emerald-700" /> You are already using the installed app.
      </p>
    );
  }

  const step = (n: number, text: React.ReactNode) => (
    <li key={n} className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#A07D34] text-[11px] font-semibold text-white">{n}</span>
      <span>{text}</span>
    </li>
  );

  return (
    <div className={compact ? 'text-[#2A261E]' : 'space-y-4 text-[#2A261E]'}>
      <div className="mb-3 flex gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                tab === t.id ? 'border-[#A07D34] bg-[#A07D34] text-white' : 'border-[#D9D2C4] bg-white'}`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'android' && (
        <div className="space-y-3 text-sm">
          {apkUrl ? (
            <>
              <a href={apkUrl} download
                className="flex items-center justify-center gap-2 rounded-md bg-[#A07D34] px-4 py-2.5 font-medium text-white">
                <Download className="h-4 w-4" /> Download the Android app (.apk)
              </a>
              <ol className="space-y-2">
                {step(1, 'Tap the button above. Chrome will warn that this file type can be harmful — that warning appears for every app not from the Play Store. Tap Download anyway.')}
                {step(2, <>Open the downloaded file. Android will ask permission to <strong>install unknown apps</strong> — allow it for Chrome, then tap Install.</>)}
                {step(3, 'Open Ameya CRM, sign in, and allow notifications when asked.')}
              </ol>
            </>
          ) : (
            <p className="rounded-md border border-dashed border-[#B9B0A0] bg-white p-3">
              The Android app file has not been uploaded yet. Use the browser method below in the meantime —
              it gives you the same app, the same icon and the same notifications.
            </p>
          )}
          <p className="pt-1 font-medium">Or install straight from the browser — no file needed:</p>
          <ol className="space-y-2">
            {step(1, 'Open this site in Chrome.')}
            {step(2, <>Tap the <MoreVertical className="inline h-3.5 w-3.5" /> menu, top right.</>)}
            {step(3, <>Choose <strong>Add to Home screen</strong>, then <strong>Install</strong>.</>)}
            {step(4, 'Open it from your home screen and allow notifications.')}
          </ol>
        </div>
      )}

      {tab === 'iphone' && (
        <div className="space-y-3 text-sm">
          <ol className="space-y-2">
            {step(1, <>Open this site in <strong>Safari</strong>. This does not work in Chrome on iPhone.</>)}
            {step(2, <>Tap the <Share className="inline h-3.5 w-3.5" /> share button at the bottom.</>)}
            {step(3, <>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</>)}
            {step(4, 'Open it from your home screen and allow notifications when asked.')}
          </ol>
          <p className="text-xs text-[#5E584C]">
            There is no .apk for iPhone — Apple does not allow app files to be installed outside the App Store.
            The home-screen version is the full app.
          </p>
        </div>
      )}

      {tab === 'desktop' && (
        <div className="space-y-3 text-sm">
          <ol className="space-y-2">
            {step(1, 'Open this site in Chrome or Edge.')}
            {step(2, <>Look for the small <Download className="inline h-3.5 w-3.5" /> install icon at the right-hand end of the address bar.</>)}
            {step(3, <>Click it, then <strong>Install</strong>. It opens in its own window like any other program.</>)}
          </ol>
        </div>
      )}

      <p className="flex items-start gap-2 rounded-md bg-[#F3EFE7] p-2.5 text-xs">
        <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A07D34]" />
        <span>Say yes to notifications. Overdue work is pushed to your phone every hour until it is closed — that only reaches you if notifications are allowed.</span>
      </p>
    </div>
  );
}

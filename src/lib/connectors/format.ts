// Pure, testable formatter that turns a CRM event into a human notification line.
// Shared by every messaging driver so Slack, Discord and Telegram read the same.

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function money(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? ` · ₹${INR.format(n)}` : '';
}

export function formatConnectorMessage(event: string, data: Record<string, unknown>): string {
  const name = String(data.name ?? data.title ?? 'record');
  switch (event) {
    case 'lead.created':
      return `🎯 New enquiry: ${name}${money(data.budgetMax)}${data.source ? ` · ${String(data.source)}` : ''}`;
    case 'lead.stage_changed': {
      const status = String(data.status ?? '').toUpperCase();
      const emoji = status === 'WON' ? '✅' : status === 'LOST' ? '❌' : '➡️';
      return `${emoji} Enquiry ${name} → ${status || 'updated'}`;
    }
    case 'task.created':
      return `📋 New task: ${name}`;
    case 'task.status_changed':
      return `🔄 Task ${name} → ${String(data.status ?? 'updated')}`;
    default:
      return `🔔 ${event}: ${name}`;
  }
}

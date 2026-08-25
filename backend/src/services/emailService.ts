export async function sendEmail(msg: { to: string; subject: string; body: string }) {
  // Swap this for SES / SendGrid / Postmark etc. Kept as a stub so the
  // engine and its tests don't depend on a real provider.
  console.log(`[email:mock] simulated to=${msg.to} subject="${msg.subject}" (not delivered)`);
  return { id: `mock-${Date.now()}`, status: 'mocked' as const, delivered: false };
}

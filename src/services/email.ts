import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.FROM_EMAIL ?? 'support@iceclaw.online'

export async function sendWelcomeEmail(email: string, port: number, authToken: string) {
  const subject = 'Your IceClaw Stronghold is Ready'
  const html = `<div style="font-family:'JetBrains Mono',monospace;max-width:600px;margin:0 auto;background:#0a1628;color:#f0f4f8;padding:40px;border-radius:8px">
<h1 style="font-family:Georgia,serif;color:#f0f4f8;font-size:28px;margin-bottom:8px">Your IceClaw Stronghold is live.</h1>
<p style="color:#4fc3f7;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:32px">Sovereign OpenClaw · Iceland Infrastructure</p>
<div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:24px;margin-bottom:24px">
<p style="color:#f0f4f8;font-size:13px;margin-bottom:8px">Gateway WebSocket:</p>
<code style="background:rgba(0,0,0,0.3);padding:8px 12px;border-radius:4px;color:#4fc3f7;font-size:12px;display:block;margin-bottom:16px">wss://agents.iceclaw.online/u/${port}</code>
</div>
<a href="https://www.iceclaw.online/dashboard" style="display:inline-block;background:#e85d24;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:32px">Go to Dashboard →</a>
<p style="color:#445566;font-size:12px;border-top:1px solid rgba(255,255,255,0.08);padding-top:24px">Questions? Reply to this email · <a href="https://iceclaw.online/terms" style="color:#445566">Terms</a> · <a href="https://iceclaw.online/privacy" style="color:#445566">Privacy</a></p>
</div>`

  await resend.emails.send({ from: `IceClaw <${FROM}>`, to: [email], subject, html })
}

export async function sendWaitlistEmail(email: string, position: number) {
  const subject = "You're on the IceClaw waitlist"
  const html = `<div style="font-family:'JetBrains Mono',monospace;max-width:600px;margin:0 auto;background:#0a1628;color:#f0f4f8;padding:40px;border-radius:8px">
<h1 style="font-family:Georgia,serif;color:#f0f4f8;font-size:26px;margin-bottom:32px">You're on the waitlist.</h1>
<p style="color:#f0f4f8;font-size:14px;line-height:1.7;margin-bottom:16px">Your payment was received. We're at capacity and provisioning new servers.</p>
<p style="color:#f0f4f8;font-size:14px;line-height:1.7">You are position <strong style="color:#4fc3f7">#${position}</strong>. Typically within 24 hours.</p>
<p style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:16px">Your $19/mo billing begins when your Stronghold goes live.</p>
</div>`

  await resend.emails.send({ from: `IceClaw <${FROM}>`, to: [email], subject, html })
}

export async function sendCapacityAlert(email: string, used: number, max: number) {
  await resend.emails.send({
    from: `IceClaw <${FROM}>`,
    to: ['info@iceclaw.online'],
    subject: `IceClaw at capacity — waitlisting ${email}`,
    text: `${used}/${max} Strongholds active. ${email} waitlisted.`,
  })
}

export async function sendVersionNotification(email: string, name: string, version: string, releaseNotes: string, scheduledDate: string) {
  const html = `<div style="font-family:'JetBrains Mono',monospace;max-width:600px;margin:0 auto;background:#0a1628;color:#f0f4f8;padding:40px;border-radius:8px">
<h1 style="font-family:Georgia,serif;color:#f0f4f8;font-size:24px;margin-bottom:24px">Hi ${name},</h1>
<p style="color:#f0f4f8;font-size:14px;line-height:1.7">We're rolling out OpenClaw <strong style="color:#4fc3f7">${version}</strong> on <strong>${scheduledDate}</strong>.</p>
<div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:20px;margin:16px 0"><p style="color:#f0f4f8;font-size:13px;line-height:1.7">${releaseNotes}</p></div>
<p style="color:rgba(255,255,255,0.6);font-size:13px">Agents offline ~60 seconds during update (2-4am Iceland time). No action needed.</p>
<p style="color:#445566;font-size:12px;margin-top:32px">— The IceClaw Team</p>
</div>`

  await resend.emails.send({
    from: `IceClaw <${FROM}>`,
    to: [email],
    subject: 'Your IceClaw Stronghold is getting an update',
    html,
  })
}

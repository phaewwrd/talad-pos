import "server-only";

// TODO(decision): email provider. Uses Resend's HTTP API when RESEND_API_KEY is
// set; otherwise logs the message (useful in development).
export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Talad POS <no-reply@example.com>";
  if (!key) {
    console.info(
      `[email:dev] to=${message.to} subject=${message.subject}\n${message.text}`,
    );
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...message }),
  });
  if (!res.ok) {
    throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
  }
}

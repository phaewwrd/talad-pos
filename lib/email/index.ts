import "server-only";

/** Plain-text transactional email (password reset, …). */
export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}) {
  const { deliverEmail } = await import("./send");
  await deliverEmail(message);
}

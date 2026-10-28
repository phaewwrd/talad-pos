import "server-only";
import { deliverEmail } from "./send";

/** Plain-text transactional email (password reset, …). */
export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}) {
  await deliverEmail(message);
}

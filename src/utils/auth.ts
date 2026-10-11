/**
 * Review emails identify UI context only.
 * Client builds must never contain or override account passwords.
 */
const REVIEW_EMAILS = (process.env.EXPO_PUBLIC_REVIEW_EMAILS || "")
  .split(",")
  .map((v: string) => v.trim().toLowerCase())
  .filter(Boolean);

export function isReviewEmail(email: string): boolean {
  if (!email) return false;
  return REVIEW_EMAILS.includes(email.trim().toLowerCase());
}

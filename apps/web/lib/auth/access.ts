import "server-only";

const ownerEmail = process.env.SETRA_OWNER_EMAIL?.trim().toLowerCase();

export function isOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(ownerEmail && email?.trim().toLowerCase() === ownerEmail);
}

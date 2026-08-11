import type { User } from "@prisma/client";

// Never send passwordHash (or any future secret field) to the client —
// centralised here so a new column doesn't get leaked by accident from a
// route that forgot to strip it.
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    customerNo: user.customerNo,
    role: user.role,
    emailVerified: user.emailVerifiedAt != null,
    createdAt: user.createdAt,
  };
}

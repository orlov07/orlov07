import "server-only";

import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";

type AuthUser = { id: string; email: string; name: string };

function newFriendCode() {
  return randomBytes(6).toString("base64url").toUpperCase();
}

export async function ensureProfile(user: AuthUser) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const code = newFriendCode();
      const rows = await sql`
        insert into public.setra_profiles (user_id, email, username, friend_code)
        values (${user.id}, ${user.email.toLowerCase()}, ${user.name}, ${code})
        on conflict (user_id) do update set
          email = excluded.email,
          username = excluded.username,
          updated_at = now()
        returning user_id, username, friend_code
      `;
      return rows[0] as { user_id: string; username: string; friend_code: string };
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  throw new Error("Não foi possível criar o perfil.");
}

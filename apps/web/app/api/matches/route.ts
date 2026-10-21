import type { MatchState } from "@setra/scoring-engine";
import { auth } from "@/lib/auth/server";
import { ensureProfile } from "@/lib/friends";
import { sql } from "@/lib/db";

async function currentUser() {
  const { data } = await auth.getSession();
  return data?.user ?? null;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });
  await ensureProfile({ id: user.id, email: user.email, name: user.name });
  const rows = await sql`select state from public.setra_matches where owner_id = ${user.id} order by updated_at desc limit 50`;
  return Response.json({ matches: rows.map(row => row.state) });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });
  await ensureProfile({ id: user.id, email: user.email, name: user.name });
  const state = await request.json().catch(() => null) as MatchState | null;
  if (!state || typeof state.id !== "string" || !state.id || !["draft","live","paused","finished","cancelled"].includes(state.status)) {
    return Response.json({ error: "Partida inválida." }, { status: 400 });
  }
  await sql`
    insert into public.setra_matches (match_id, owner_id, state, status)
    values (${state.id}, ${user.id}, ${JSON.stringify(state)}, ${state.status})
    on conflict (match_id) do update set state = excluded.state, status = excluded.status, updated_at = now()
    where public.setra_matches.owner_id = ${user.id}
  `;
  return Response.json({ ok: true });
}

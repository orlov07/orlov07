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
  const profile = await ensureProfile({ id: user.id, email: user.email, name: user.name });

  const [friends, incoming, outgoing] = await Promise.all([
    sql`
      select p.username
      from public.setra_friendships f
      join public.setra_profiles p on p.user_id = case when f.user_a = ${user.id} then f.user_b else f.user_a end
      where f.user_a = ${user.id} or f.user_b = ${user.id}
      order by p.username
    `,
    sql`
      select r.id, p.username, r.created_at
      from public.setra_friend_requests r
      join public.setra_profiles p on p.user_id = r.sender_id
      where r.recipient_id = ${user.id} and r.status = 'pending'
      order by r.created_at desc
    `,
    sql`
      select r.id, p.username, r.created_at
      from public.setra_friend_requests r
      join public.setra_profiles p on p.user_id = r.recipient_id
      where r.sender_id = ${user.id} and r.status = 'pending'
      order by r.created_at desc
    `,
  ]);

  return Response.json({
    profile: { username: profile.username, friendCode: profile.friend_code },
    friends,
    incoming,
    outgoing,
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });
  await ensureProfile({ id: user.id, email: user.email, name: user.name });

  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return Response.json({ error: "Informe um código de amizade." }, { status: 400 });

  const recipient = await sql`select user_id from public.setra_profiles where friend_code = ${code} limit 1`;
  if (!recipient[0]) return Response.json({ error: "Código de amizade inválido." }, { status: 404 });
  const recipientId = recipient[0].user_id as string;
  if (recipientId === user.id) return Response.json({ error: "Você não pode adicionar a si mesmo." }, { status: 400 });

  const [a, b] = [user.id, recipientId].sort();
  const existing = await sql`select 1 from public.setra_friendships where user_a = ${a} and user_b = ${b}`;
  if (existing[0]) return Response.json({ error: "Esse usuário já está na sua lista de amigos." }, { status: 409 });

  await sql`
    insert into public.setra_friend_requests (sender_id, recipient_id, status)
    values (${user.id}, ${recipientId}, 'pending')
    on conflict (sender_id, recipient_id) do update set status = 'pending', updated_at = now()
  `;
  return Response.json({ ok: true });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { requestId?: unknown; action?: unknown } | null;
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const action = body?.action === "accept" || body?.action === "reject" ? body.action : null;
  if (!requestId || !action) return Response.json({ error: "Solicitação inválida." }, { status: 400 });

  if (action === "reject") {
    const rows = await sql`
      update public.setra_friend_requests set status = 'rejected', updated_at = now()
      where id = ${requestId} and recipient_id = ${user.id} and status = 'pending'
      returning id
    `;
    if (!rows[0]) return Response.json({ error: "Solicitação não encontrada." }, { status: 404 });
    return Response.json({ ok: true });
  }

  const rows = await sql`
    with accepted as (
      update public.setra_friend_requests set status = 'accepted', updated_at = now()
      where id = ${requestId} and recipient_id = ${user.id} and status = 'pending'
      returning sender_id, recipient_id
    )
    insert into public.setra_friendships (user_a, user_b)
    select least(sender_id, recipient_id), greatest(sender_id, recipient_id) from accepted
    on conflict do nothing
    returning user_a
  `;
  if (!rows[0]) return Response.json({ error: "Solicitação não encontrada." }, { status: 404 });
  return Response.json({ ok: true });
}

import { isOwnerEmail } from "@/lib/auth/access";
import { auth } from "@/lib/auth/server";

export async function GET() {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ authenticated: false, owner: false }, { status: 401 });

  return Response.json({
    authenticated: true,
    owner: isOwnerEmail(data.user.email),
  });
}

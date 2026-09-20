import { getServices } from "@/services/container";
import { routeUser } from "@/services/request-user";

async function context(request: Request) {
  const actor = await routeUser(request);
  if (actor instanceof Response) return actor;
  if (actor.role !== "manager") {
    return Response.json(
      { error: "Manager access is required." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  const body = (await request.json()) as { userId: string };
  return { actor, userId: body.userId };
}

export async function POST(request: Request) {
  const resolved = await context(request);
  if (resolved instanceof Response) return resolved;
  const { users } = await getServices();
  const credential = await users.createOpdsCredential(
    resolved.actor,
    resolved.userId,
  );
  return Response.json(credential, {
    headers: { "cache-control": "no-store" },
  });
}

export async function DELETE(request: Request) {
  const resolved = await context(request);
  if (resolved instanceof Response) return resolved;
  const { users } = await getServices();
  await users.revokeOpdsCredential(resolved.actor, resolved.userId);
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

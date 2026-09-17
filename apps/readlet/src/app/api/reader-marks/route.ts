import type { User } from "@readlet/core";
import { parseReaderMark } from "@/domain/reader-marks";
import { enforceR2RateLimit } from "@/lib/rate-limit";
import { getServices } from "@/services/container";
import { routeUser } from "@/services/request-user";

async function context(bookId: string, user: User) {
  const services = await getServices();
  if (!(await services.catalog.find(bookId))) return null;
  return { services, user };
}

export async function GET(request: Request) {
  const user = await routeUser(request);
  if (user instanceof Response) return user;
  const bookId = new URL(request.url).searchParams.get("bookId");
  if (!bookId)
    return Response.json({ error: "bookId is required" }, { status: 400 });
  const found = await context(bookId, user);
  if (!found) return Response.json({ error: "no such book" }, { status: 404 });
  return Response.json(
    {
      marks: await found.services.readerMarks.list(found.user.id, bookId),
      writable: found.services.readerMarks.writable,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const user = await routeUser(request);
  if (user instanceof Response) return user;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const mark = parseReaderMark(body?.mark);
  if (!body || typeof body.bookId !== "string" || !mark) {
    return Response.json({ error: "invalid reader mark" }, { status: 400 });
  }
  const { limits } = await getServices();
  const limited = await enforceR2RateLimit(request, limits);
  if (limited) return limited;
  const found = await context(body.bookId, user);
  if (!found) return Response.json({ error: "no such book" }, { status: 404 });
  if (!found.services.readerMarks.writable)
    return Response.json({ error: "read only" }, { status: 403 });
  await found.services.readerMarks.upsert(found.user.id, body.bookId, mark);
  return Response.json({ saved: true });
}

export async function DELETE(request: Request) {
  const user = await routeUser(request);
  if (user instanceof Response) return user;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body.bookId !== "string" || typeof body.id !== "string") {
    return Response.json(
      { error: "bookId and id are required" },
      { status: 400 },
    );
  }
  const { limits } = await getServices();
  const limited = await enforceR2RateLimit(request, limits);
  if (limited) return limited;
  const found = await context(body.bookId, user);
  if (!found) return Response.json({ error: "no such book" }, { status: 404 });
  if (!found.services.readerMarks.writable)
    return Response.json({ error: "read only" }, { status: 403 });
  await found.services.readerMarks.remove(found.user.id, body.bookId, body.id);
  return Response.json({ removed: true });
}

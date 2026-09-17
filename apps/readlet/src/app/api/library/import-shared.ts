import type { User } from "@readlet/core";
import { enforceR2RateLimit } from "@/lib/rate-limit";
import { getServices } from "@/services/container";
import { routeUser } from "@/services/request-user";

export const MAX_BOOK_BYTES = 100_000_000;

export async function managerForImport(
  request: Request,
): Promise<User | Response> {
  const actor = await routeUser(request);
  if (actor instanceof Response) return actor;
  if (actor.role !== "manager")
    return Response.json(
      { error: "Manager access is required." },
      { status: 403 },
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Cross-origin imports are not allowed." },
      { status: 403 },
    );
  try {
    const { library, limits } = await getServices();
    if (!library.writable)
      return Response.json(
        { error: "This library is read-only." },
        { status: 403 },
      );
    return (await enforceR2RateLimit(request, limits)) ?? actor;
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The library is unavailable.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export function bookSize(value: string | null): number | null {
  const size = Number(value);
  return value &&
    Number.isSafeInteger(size) &&
    size > 0 &&
    size <= MAX_BOOK_BYTES
    ? size
    : null;
}

export async function publish(
  actor: User,
  name: string,
  body: ReadableStream<Uint8Array>,
  size: number,
): Promise<Response> {
  try {
    const { library } = await getServices();
    const book = await library.importBook(actor, name, body, size);
    return Response.json(
      { book },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
}

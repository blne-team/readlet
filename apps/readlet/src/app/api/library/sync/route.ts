import {
  CATALOG_FILE,
  CONTRIBUTED_BOOK_PREFIX,
  parseBookKey,
  writableStorage,
} from "@readlet/core";
import {
  AccessServiceError,
  accessConfig,
  accessServiceForToken,
  accessToken,
} from "@/services/access-identity";
import { getServices } from "@/services/container";

const NO_STORE = { "cache-control": "no-store" };

async function authorize(request: Request): Promise<Response | null> {
  try {
    const config = accessConfig();
    await accessServiceForToken(accessToken(request.headers), config);
    return null;
  } catch (error) {
    if (error instanceof AccessServiceError) {
      return Response.json(
        { error: error.message },
        { status: 401, headers: NO_STORE },
      );
    }
    throw error;
  }
}

export async function GET(request: Request): Promise<Response> {
  const denied = await authorize(request);
  if (denied) return denied;

  const { storage } = await getServices();
  const object = await storage.read(CATALOG_FILE);
  if (!object?.body)
    return new Response(null, { status: 404, headers: NO_STORE });
  return new Response(object.body, {
    headers: {
      ...NO_STORE,
      "content-type": "application/json",
      etag: object.object.etag,
    },
  });
}

export async function PUT(request: Request): Promise<Response> {
  const denied = await authorize(request);
  if (denied) return denied;

  const key = request.headers.get("x-readlet-key") ?? "";
  const parsed = parseBookKey(key);
  const size = Number(request.headers.get("content-length"));
  if (
    !parsed?.id.startsWith(CONTRIBUTED_BOOK_PREFIX) ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    !request.body
  ) {
    return Response.json(
      { error: "A synced book key and content length are required." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { storage } = await getServices();
  const target = writableStorage(storage);
  if (!target?.putStream) {
    return Response.json(
      { error: "This library cannot accept synced books." },
      { status: 403, headers: NO_STORE },
    );
  }
  await target.putStream(
    key,
    request.body,
    size,
    request.headers.get("content-type") ?? "application/octet-stream",
  );
  return new Response(null, { status: 204, headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const denied = await authorize(request);
  if (denied) return denied;

  const { library } = await getServices();
  const removed = await library.publishContribution(await request.json());
  return Response.json({ removed }, { headers: NO_STORE });
}

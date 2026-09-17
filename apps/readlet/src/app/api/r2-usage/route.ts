import { R2UsageLimitError } from "@readlet/provider-r2/worker";
import { getServices } from "@/services/container";
import { routeUser } from "@/services/request-user";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const user = await routeUser(request);
  if (user instanceof Response) return user;
  if (user.role !== "manager") {
    return Response.json(
      { error: "Manager access is required." },
      { status: 403, headers: NO_STORE },
    );
  }

  const { r2Usage } = await getServices();
  if (!r2Usage) {
    return Response.json(
      { error: "This deployment does not use R2." },
      { status: 404, headers: NO_STORE },
    );
  }
  return Response.json(await r2Usage.status(), { headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.READLET_SYNC_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json(
      { error: "Invalid sync credentials." },
      { status: 401, headers: NO_STORE },
    );
  }

  const { r2Usage } = await getServices();
  if (!r2Usage) {
    return Response.json(
      { error: "This deployment does not use R2." },
      { status: 404, headers: NO_STORE },
    );
  }

  try {
    await r2Usage.reserve(await request.json());
    return new Response(null, { status: 204, headers: NO_STORE });
  } catch (error) {
    if (error instanceof R2UsageLimitError) {
      return Response.json(
        { error: error.message, status: error.status },
        { status: 503, headers: NO_STORE },
      );
    }
    throw error;
  }
}

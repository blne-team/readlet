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

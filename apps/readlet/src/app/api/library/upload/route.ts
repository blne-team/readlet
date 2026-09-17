import {
  bookSize,
  managerForImport,
  publish,
} from "@/app/api/library/import-shared";

export async function POST(request: Request): Promise<Response> {
  const actor = await managerForImport(request);
  if (actor instanceof Response) return actor;
  const size = bookSize(
    request.headers.get("x-file-size") ?? request.headers.get("content-length"),
  );
  const name = request.headers.get("x-file-name");
  if (!size || !name || !request.body)
    return Response.json(
      { error: "A file name and size are required (100 MB maximum)." },
      { status: 400 },
    );
  return publish(actor, decodeURIComponent(name), request.body, size);
}

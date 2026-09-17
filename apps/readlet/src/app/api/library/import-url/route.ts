import {
  bookSize,
  managerForImport,
  publish,
} from "@/app/api/library/import-shared";

function publicHttps(value: string): URL {
  const url = new URL(value);
  if (url.protocol === "blob:")
    throw new Error(
      "A blob: link only works in the browser that created it. Download the file and upload it, or use a public HTTPS file URL.",
    );
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !host.includes(".") ||
    /^(localhost|\d+\.\d+\.\d+\.\d+)$/.test(host) ||
    /\.(local|localhost|internal|test|invalid)$/.test(host) ||
    host.startsWith("[")
  )
    throw new Error("Use a public HTTPS file URL.");
  return url;
}

function downloadableUrl(value: string): URL {
  const url = publicHttps(value);
  if (
    url.hostname.toLowerCase() === "github.com" &&
    /^\/[^/]+\/[^/]+\/blob\/.+\.(epub|pdf)$/i.test(url.pathname)
  ) {
    // GitHub's file page is HTML; raw=1 redirects to the file download.
    url.search = "?raw=1";
    url.hash = "";
  }
  return url;
}

export async function POST(request: Request): Promise<Response> {
  const actor = await managerForImport(request);
  if (actor instanceof Response) return actor;
  const input = (await request.json()) as { url?: string };
  if (typeof input.url !== "string")
    return Response.json({ error: "A URL is required." }, { status: 400 });

  try {
    let url = downloadableUrl(input.url);
    for (let redirect = 0; redirect < 4; redirect++) {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(120_000),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location)
          throw new Error("The download redirected without a destination.");
        await response.body?.cancel();
        url = publicHttps(new URL(location, url).href);
        continue;
      }
      if (!response.ok || !response.body)
        throw new Error(`Download failed (${response.status}).`);
      if (response.headers.get("content-type")?.startsWith("text/html"))
        throw new Error(
          "The URL points to a web page, not an EPUB or PDF file.",
        );
      const size = bookSize(response.headers.get("content-length"));
      if (!size)
        throw new Error(
          "The file server must provide Content-Length for a file no larger than 100 MB. You can also download the file and upload it here.",
        );
      let name = decodeURIComponent(url.pathname.split("/").pop() || "book");
      if (!/\.(epub|pdf)$/i.test(name)) {
        const type = response.headers.get("content-type")?.split(";")[0];
        name +=
          type === "application/pdf"
            ? ".pdf"
            : type === "application/epub+zip"
              ? ".epub"
              : "";
      }
      return publish(actor, name, response.body, size);
    }
    throw new Error("Too many redirects.");
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Download failed." },
      { status: 400 },
    );
  }
}

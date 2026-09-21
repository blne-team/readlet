import type { ProviderManifest } from "@readlet/core";

/**
 * A directory on disk. The library is exactly the tree the sync tool builds,
 * copied into place, so it can be inspected, backed up and moved with ordinary
 * tools — which is much of the point of keeping a library as plain files.
 *
 * Publishing creates the directory when needed.
 */
export const manifest: ProviderManifest = {
  id: "fs",
  title: "Local filesystem",
  summary:
    "Holds the library in a directory. Needs no account and no network — for " +
    "a machine on your own network, or a VPS you run the app on.",
  options: [
    {
      key: "directory",
      required: true,
      summary:
        "Where the published library lives. Relative paths resolve against " +
        "the config file, not the working directory.",
      example: "library-data",
    },
  ],
  notes: [
    "The app must run somewhere with a filesystem — `next start` on a VPS or " +
      "on your own machine — rather than on Workers, which has none.",
  ],
};

/** What this provider accepts under `storage` in readlet.config.json. */
export type FsConfig = {
  directory: string;
};

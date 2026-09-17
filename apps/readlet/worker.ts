// OpenNext creates this module during bundling. This wrapper keeps its request
// handler intact while exporting Readlet's own Durable Object to Wrangler.
// biome-ignore lint/suspicious/noTsIgnore: this file must typecheck before the generated module exists
// @ts-ignore generated build artifact; it is absent before OpenNext bundles
import worker from "./.open-next/worker.js";

export { R2UsageLedger } from "./src/services/r2-usage-ledger";
export default worker;

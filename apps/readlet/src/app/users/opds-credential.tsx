"use client";

import { useState } from "react";
import { BUTTON } from "@/app/ui";

type Credential = { username: string; password: string };

export function OpdsCredentialControl({
  userId,
  enabled,
  configured,
}: {
  userId: string;
  enabled: boolean;
  configured: boolean;
}) {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [exists, setExists] = useState(configured);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const request = async (method: "POST" | "DELETE") => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/opds-credentials", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok)
        throw new Error("The OPDS password could not be saved.");
      if (method === "POST") {
        setCredential((await response.json()) as Credential);
        setExists(true);
      } else {
        setCredential(null);
        setExists(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BUTTON}
          disabled={!enabled || busy}
          onClick={() => request("POST")}
        >
          {exists ? "Replace OPDS password" : "Create OPDS password"}
        </button>
        {exists && (
          <button
            type="button"
            className={BUTTON}
            disabled={busy}
            onClick={() => request("DELETE")}
          >
            Revoke OPDS password
          </button>
        )}
      </div>
      {credential && (
        <div className="rounded-xl bg-fill p-3 text-sm">
          <p className="font-medium">Copy this password now.</p>
          <p className="mt-2 break-all text-secondary">
            Username: <code>{credential.username}</code>
          </p>
          <p className="mt-1 break-all text-secondary">
            Password: <code>{credential.password}</code>
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

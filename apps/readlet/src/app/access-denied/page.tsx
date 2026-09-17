import { ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { State, StatePage } from "@/app/state";
import { AccessIdentityError } from "@/services/access-identity";
import { currentIdentity } from "@/services/session";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

export default async function AccessDeniedPage() {
  let email: string | null = null;
  try {
    email = (await currentIdentity()).email;
  } catch (error) {
    if (!(error instanceof AccessIdentityError)) throw error;
  }
  return (
    <StatePage>
      <State icon={ShieldX} title="Access denied">
        {email ? (
          <p>
            Cloudflare verified <strong>{email}</strong>, but that identity is
            not an active Readlet user. Ask a library manager to add or enable
            it.
          </p>
        ) : (
          <p>
            A valid Cloudflare Access session is required to open this library.
          </p>
        )}
      </State>
    </StatePage>
  );
}

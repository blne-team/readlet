import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Avatar } from "@/app/avatar";
import { ManagementHeader } from "@/app/management-header";
import { BUTTON, INPUT } from "@/app/ui";
import {
  deleteUser,
  inviteUser,
  rebindUser,
  setUserEnabled,
  updateUser,
} from "@/app/users/actions";
import { DeleteButton } from "@/app/users/delete-button";
import { OpdsCredentialControl } from "@/app/users/opds-credential";
import { OG_BASE, SITE_DESCRIPTION } from "@/lib/site";
import { getServices } from "@/services/container";
import { pageUser } from "@/services/session";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
  openGraph: { ...OG_BASE, title: "Users", url: "/users" },
  twitter: {
    card: "summary",
    title: "Users",
    description: SITE_DESCRIPTION,
  },
};

export default async function UsersPage() {
  const actor = await pageUser();
  if (actor.role !== "manager") redirect("/");
  const { users } = await getServices();
  const directory = await users.list();

  return (
    <main className="page-safe mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      <ManagementHeader name={actor.displayName} current="/users" />

      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Users</h1>
      <p className="mt-2 text-secondary">
        Managers invite readers and control who can use this library.
      </p>

      <ul className="mt-10 divide-y divide-separator">
        {directory.map((user) => (
          <li key={user.id} className="flex flex-col gap-3 py-5">
            <div className="flex items-center gap-3">
              <Avatar name={user.displayName} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{user.displayName}</p>
                <p className="truncate text-sm text-secondary">{user.email}</p>
              </div>
              <span className="rounded-full bg-fill px-2.5 py-1 text-xs font-medium capitalize text-secondary">
                {user.status}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pl-13">
              {user.status !== "deleting" && (
                <form
                  action={updateUser}
                  className="flex flex-1 flex-wrap gap-2"
                >
                  <input type="hidden" name="id" value={user.id} />
                  <input
                    name="displayName"
                    defaultValue={user.displayName}
                    aria-label={`Display name for ${user.email}`}
                    maxLength={80}
                    required
                    className={`${INPUT} min-w-44 flex-1 sm:max-w-64`}
                  />
                  <select
                    name="role"
                    defaultValue={user.role}
                    aria-label={`Role for ${user.email}`}
                    className={INPUT}
                  >
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                  </select>
                  <button type="submit" className={BUTTON}>
                    Save
                  </button>
                </form>
              )}

              {user.status !== "deleting" && (
                <form action={setUserEnabled}>
                  <input type="hidden" name="id" value={user.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={user.status === "disabled" ? "true" : "false"}
                  />
                  <button type="submit" className={BUTTON}>
                    {user.status === "disabled" ? "Enable" : "Disable"}
                  </button>
                </form>
              )}

              {user.status !== "deleting" && user.accessSubject && (
                <form action={rebindUser}>
                  <input type="hidden" name="id" value={user.id} />
                  <button type="submit" className={BUTTON}>
                    Rebind login
                  </button>
                </form>
              )}

              <form action={deleteUser}>
                <input type="hidden" name="id" value={user.id} />
                <DeleteButton
                  email={user.email}
                  deleting={user.status === "deleting"}
                />
              </form>
              {user.status !== "deleting" && (
                <OpdsCredentialControl
                  userId={user.id}
                  enabled={user.status === "active"}
                  configured={!!user.opdsCredential}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      <form
        action={inviteUser}
        className="mt-10 flex flex-wrap gap-2 border-t border-separator pt-8"
      >
        <input
          name="email"
          type="email"
          placeholder="reader@example.com"
          aria-label="Email address"
          maxLength={254}
          required
          className={`${INPUT} min-w-52 flex-1 sm:max-w-72`}
        />
        <input
          name="displayName"
          placeholder="Display name"
          aria-label="Display name"
          maxLength={80}
          className={`${INPUT} min-w-44 flex-1 sm:max-w-64`}
        />
        <select name="role" aria-label="Role" className={INPUT}>
          <option value="member">Member</option>
          <option value="manager">Manager</option>
        </select>
        <button type="submit" className={BUTTON}>
          Invite user
        </button>
      </form>
      <p className="mt-3 text-sm text-secondary">
        A pending user becomes active the first time that verified email signs
        in through Cloudflare Access.
      </p>
    </main>
  );
}

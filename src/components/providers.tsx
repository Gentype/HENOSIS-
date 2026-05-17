"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import type { Session } from "next-auth";
import { useUser } from "@/lib/store";

/**
 * App-wide providers:
 *  - `SessionProvider` receives the SSR-resolved session so the first client
 *    render already knows whether the user is signed in (no "Not signed in"
 *    flash between hydration and the first `/api/auth/session` fetch).
 *  - `UserHydrator` keeps the `useUser` zustand store in sync with the
 *    server-side user record (/api/me).
 */
export function Providers({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: Session | null;
}) {
  return (
    <SessionProvider session={initialSession} refetchOnWindowFocus={false}>
      <UserHydrator />
      {children}
    </SessionProvider>
  );
}

function UserHydrator() {
  const { data: session, status } = useSession();
  const refetch = useUser((s) => s.refetch);
  const setUser = useUser((s) => s._setUser);
  const setLoading = useUser((s) => s._setLoading);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      setUser(null);
      setLoading(false);
      return;
    }
    void refetch();
  }, [session, status, refetch, setUser, setLoading]);

  return null;
}

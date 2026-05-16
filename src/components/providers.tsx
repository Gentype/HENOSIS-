"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useUser } from "@/lib/store";

/**
 * App-wide providers:
 *  - `SessionProvider` so client components can read the NextAuth session.
 *  - `UserHydrator` keeps the `useUser` zustand store in sync with the
 *    server-side user record (/api/me).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
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

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * NextAuth.js v5 configuration.
 *
 * - JWT session strategy (no database needed; we keep our own tiny
 *   file-backed user store in `src/lib/user-store.ts` for plan + quota).
 * - Google as the only OAuth provider. The Google `sub` claim becomes the
 *   stable user id throughout the app.
 * - `prompt: "select_account"` so the user can pick an account every time
 *   (matches the user's spec: "выбрал акк и все").
 *
 * Required env vars (see `.env.example`):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    async session({ session, token }) {
      // Surface the Google `sub` as session.user.id so the rest of the app
      // can look up the user record by a stable id.
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

import { signOut } from "@/server/auth";
import { Button } from "@/components/ui/Button";

interface SignOutButtonProps {
  className?: string;
}

// A Server Component -- no client JS needed. `signOut` (server/auth.ts) is
// Auth.js's Server Action for this app; calling it from an inline `"use
// server"` action deletes the database Session row (see server/auth.ts's
// `session: { strategy: "database" }` comment) as part of the same request
// that submits the form, then redirects to the sign-in page. No
// useActionState -- sign-out has no pending/error state worth showing
// before the redirect takes over.
//
// Not `action={signOut}` directly: `signOut`'s declared signature takes an
// optional `options` object (`{ redirectTo?, redirect? }`), which
// TypeScript won't structurally accept where a `(formData: FormData) =>
// ...` is expected, even though the options are all optional. Wrapping in
// an inline `"use server"` closure sidesteps the mismatch and is the
// pattern Auth.js's own docs use for this exact case.
export function SignOutButton({ className = "" }: SignOutButtonProps) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
      className={className}
    >
      <Button type="submit" variant="ghost" className="w-full justify-start">
        Sign out
      </Button>
    </form>
  );
}

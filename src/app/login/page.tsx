import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

async function iniciarSesion(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await auth.api.signInEmail({ body: { email, password } });
  } catch {
    redirect("/login?error=1");
  }

  redirect("/");
}

interface PaginaLoginProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function PaginaLogin({ searchParams }: PaginaLoginProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-8">
        <h1 className="text-2xl font-semibold text-text">Iniciar sesión</h1>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            Correo o contraseña incorrectos.
          </p>
        )}

        <form action={iniciarSesion} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-text-muted">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-text-muted">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-[var(--radius-input)] bg-primary px-4 py-2 font-medium text-white hover:opacity-90"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}

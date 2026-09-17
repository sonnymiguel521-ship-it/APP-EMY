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
    <main className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-300 p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Iniciar sesión</h1>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            Correo o contraseña incorrectos.
          </p>
        )}

        <form action={iniciarSesion} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded border border-slate-400 px-3 py-2 text-slate-900"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded border border-slate-400 px-3 py-2 text-slate-900"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded bg-blue-700 px-3 py-2 font-medium text-white hover:bg-blue-800"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}

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

export default function PaginaLogin({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main style={{ maxWidth: 360, margin: "10vh auto", padding: 16 }}>
      <h1>Iniciar sesión</h1>
      {searchParams.error && <p role="alert">Correo o contraseña incorrectos.</p>}
      <form action={iniciarSesion}>
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}

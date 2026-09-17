import Link from "next/link";

const ENLACES = [
  { href: "/articulos", etiqueta: "Artículos" },
  { href: "/unidades", etiqueta: "Unidades" },
  { href: "/clientes", etiqueta: "Clientes" },
  { href: "/ventas", etiqueta: "Ventas" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1280px] items-center gap-8 px-4 py-3">
          <span className="text-lg font-semibold text-text">Inventario</span>
          <nav aria-label="Principal" className="flex gap-1">
            {ENLACES.map((enlace) => (
              <Link
                key={enlace.href}
                href={enlace.href}
                className="rounded-[var(--radius-input)] px-3 py-2 text-sm font-medium text-text-muted no-underline hover:bg-background hover:text-text"
              >
                {enlace.etiqueta}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1280px]">{children}</div>
    </>
  );
}

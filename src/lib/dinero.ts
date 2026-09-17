export function formatearDop(centavos: number): string {
  const negativo = centavos < 0;
  const absolutoCentavos = Math.abs(Math.trunc(centavos));
  const pesos = Math.trunc(absolutoCentavos / 100);
  const centavosRestantes = absolutoCentavos % 100;

  return `${negativo ? "-" : ""}${pesos}.${String(centavosRestantes).padStart(2, "0")}`;
}

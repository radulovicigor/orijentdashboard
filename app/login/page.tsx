export const metadata = { title: "Prijava · Orijent" };

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="login">
      <form method="POST" action="/api/login" className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Orijent parfimerija" className="login-logo" />
        <p className="muted">Izvještaj o marketingu i prodaji</p>
        <label htmlFor="password">Lozinka</label>
        <input id="password" name="password" type="password" autoFocus required autoComplete="current-password" />
        {e && <p className="error">Pogrešna lozinka. Pokušajte ponovo.</p>}
        <button type="submit">Otvori izvještaj</button>
      </form>
    </main>
  );
}

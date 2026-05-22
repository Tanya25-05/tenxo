// Marketing shell uses global Navbar/Footer provided by the app shell

export default function MarketingPageShell({
  children,
  eyebrow,
  onSignIn,
  subtitle,
  title,
}) {
  return (
    <div className="marketing-page">
      <section className="marketing-subhero">
        <div className="marketing-subhero-copy">
          <p className="marketing-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </section>
      <main className="marketing-main">{children}</main>
    </div>
  );
}

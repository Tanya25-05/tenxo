import Sidebar from "./Sidebar";

export default function AppShell({
  active,
  children,
  eyebrow,
  meta,
  onSelect,
  role,
  title,
}) {
  return (
    <div className="tenxo-app-shell">
      <Sidebar active={active} role={role} onSelect={onSelect} />
      <main className="tenxo-main">
        <header className="tenxo-topbar">
          <div>
            {eyebrow && <p className="tenxo-eyebrow">{eyebrow}</p>}
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {title}
            </h1>
          </div>
          {meta && <div className="tenxo-topbar-meta">{meta}</div>}
        </header>
        <div className="tenxo-content">{children}</div>
      </main>
    </div>
  );
}

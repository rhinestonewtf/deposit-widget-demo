export default function HealthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <style>{`html, body { height: auto !important; overflow: auto !important; }`}</style>
      {children}
    </div>
  );
}

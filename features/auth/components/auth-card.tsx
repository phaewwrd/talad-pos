export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border bg-card p-6 shadow-card sm:p-8">
      <h1 className="font-semibold text-2xl">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-muted-foreground text-sm">{subtitle}</p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}

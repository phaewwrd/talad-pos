import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { BackofficeBrand } from "@/features/backoffice/components/backoffice-brand";

export default function BackofficeAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-16 items-center justify-between bg-topbar px-4 md:px-6">
        <BackofficeBrand />
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

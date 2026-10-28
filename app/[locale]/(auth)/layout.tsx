import { LocaleSwitcher } from "@/components/shell/locale-switcher";

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <div className="mb-6 flex items-center gap-2">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary font-bold text-lg text-white">
          ต
        </span>
        <span className="font-semibold text-xl">Talad POS</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

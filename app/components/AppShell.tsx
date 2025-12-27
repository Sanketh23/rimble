import Navbar from "./Navbar";

type AppShellProps = {
  children: React.ReactNode;
  streak?: number | null;
};

export default function AppShell({ children, streak }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <Navbar streak={streak} />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}

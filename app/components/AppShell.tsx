"use client";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="h-14 border-b flex items-center justify-between px-6">
        {/* Logo */}
        <div className="font-bold text-lg tracking-tight">
          NBA Daily
        </div>

        {/* Center (optional later) */}
        <div className="text-sm text-gray-500">
          Question of the Day
        </div>

        {/* Right icons (future) */}
        <div className="text-sm">
          👤
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex justify-center">
        <div className="w-full max-w-xl px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

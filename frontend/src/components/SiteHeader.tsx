import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 pointer-events-none">
      <div className="flex items-center gap-6 pointer-events-auto">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <div className="h-8 w-8 rounded-lg bg-black border border-white/20 flex items-center justify-center">
            <span className="text-white font-bold font-mono text-xs">BDI</span>
          </div>
          <span className="font-semibold tracking-[0.2em] uppercase text-white/90 text-sm">INFRA-SCAN</span>
        </Link>
      </div>

      <nav className="hidden md:flex items-center gap-8 pointer-events-auto">
        <Link href="#features" className="text-xs font-semibold tracking-widest uppercase text-white/60 transition-colors hover:text-white">
          Features
        </Link>
        <Link href="#technology" className="text-xs font-semibold tracking-widest uppercase text-white/60 transition-colors hover:text-white">
          Technology
        </Link>
        <Link href="/dashboard" className="text-xs font-semibold tracking-widest uppercase text-white/60 transition-colors hover:text-white">
          Console
        </Link>
      </nav>

      <div className="pointer-events-auto">
        <Link 
          href="/dashboard"
          className="inline-flex h-9 items-center justify-center rounded-full bg-white/10 border border-white/10 px-5 text-[10px] font-bold tracking-widest uppercase text-white backdrop-blur-md transition-colors hover:bg-white hover:text-black"
        >
          Enter
        </Link>
      </div>
    </header>
  );
}

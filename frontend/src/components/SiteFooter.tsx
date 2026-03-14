import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.04] py-12 mt-20 relative z-10 w-full bg-transparent">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#050505] border border-white/10 flex items-center justify-center">
            <span className="text-white/40 font-bold font-mono text-xs">BDI</span>
          </div>
          <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">
            © {new Date().getFullYear()} BDI Infrastructure Scan
          </p>
        </div>

        <nav className="flex items-center gap-6">
          <Link href="#" className="text-xs text-white/40 transition-colors hover:text-white/80">
            Terms
          </Link>
          <Link href="#" className="text-xs text-white/40 transition-colors hover:text-white/80">
            Privacy
          </Link>
          <Link href="#" className="text-xs text-white/40 transition-colors hover:text-white/80">
            Documentation
          </Link>
        </nav>
      </div>
    </footer>
  );
}

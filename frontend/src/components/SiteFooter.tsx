import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.04] py-12 mt-20 relative z-10 w-full bg-transparent">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#050505] border border-white/10 flex items-center justify-center">
            <span className="text-white/40 font-bold font-mono text-xs">BDI</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono tracking-[0.3em] uppercase opacity-50">
            © {new Date().getFullYear()} BDI.
          </p>
        </div>

        <nav className="flex items-center gap-6">
            <Link href="#" className="text-[10px] uppercase tracking-widest text-white/30 transition-colors hover:text-white/60">
              Terms
            </Link>
            <Link href="#" className="text-[10px] uppercase tracking-widest text-white/30 transition-colors hover:text-white/60">
              Privacy
            </Link>
            <Link href="#" className="text-[10px] uppercase tracking-widest text-white/30 transition-colors hover:text-white/60">
              Docs
            </Link>
        </nav>
      </div>
    </footer>
  );
}

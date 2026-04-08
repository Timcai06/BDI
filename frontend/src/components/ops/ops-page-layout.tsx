"use client";

import type { ReactNode } from "react";

interface OpsPageLayoutProps {
  header?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  containerClassName?: string;
}

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function OpsPageLayout({
  header,
  children,
  contentClassName,
  containerClassName
}: OpsPageLayoutProps) {
  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-hidden bg-black/40">
      <div className={joinClasses("relative flex-1 overflow-y-auto p-6 lg:p-8 page-enter", contentClassName)}>
        <div className={joinClasses("mx-auto flex w-full max-w-7xl flex-col space-y-6", containerClassName)}>
          {header}
          {children}
        </div>
      </div>
    </div>
  );
}

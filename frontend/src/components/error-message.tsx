"use client";

import { useState } from "react";

export type ErrorType = 
  | "network" 
  | "timeout" 
  | "server" 
  | "validation" 
  | "file_size" 
  | "file_type" 
  | "unknown";

interface ErrorMessageProps {
  type: ErrorType;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryCount?: number;
  maxRetries?: number;
}

const errorConfig: Record<ErrorType, {
  icon: React.ReactNode;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  network: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    title: "网络连接异常",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30"
  },
  timeout: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "请求超时",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30"
  },
  server: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
    title: "服务器错误",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30"
  },
  validation: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "验证失败",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30"
  },
  file_size: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    title: "文件过大",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30"
  },
  file_type: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: "文件类型不支持",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30"
  },
  unknown: {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "发生错误",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30"
  }
};

export function ErrorMessage({ 
  type, 
  message, 
  onRetry, 
  onDismiss,
  retryCount = 0,
  maxRetries = 3
}: ErrorMessageProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const config = errorConfig[type];
  const canRetry = retryCount < maxRetries && onRetry && (type === "network" || type === "timeout" || type === "server");

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    setIsRetrying(true);
    await onRetry();
    setIsRetrying(false);
  };

  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4 animate-in fade-in slide-in-from-top-2 duration-300`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${config.color} mt-0.5`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${config.color} mb-1`}>
            {config.title}
          </h4>
          <p className="text-sm text-white/70 leading-relaxed">
            {message}
          </p>
          
          {/* Retry info */}
          {retryCount > 0 && (
            <p className="mt-2 text-xs text-white/40">
              已重试 {retryCount}/{maxRetries} 次
            </p>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex items-center gap-2">
            {canRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isRetrying 
                    ? "bg-white/5 text-white/40 cursor-not-allowed" 
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                {isRetrying ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    重试中...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    重试
                  </>
                )}
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all duration-200"
              >
                忽略
              </button>
            )}
          </div>
        </div>

        {/* Dismiss button */}
        {onDismiss && !canRetry && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Helper function to classify error type
export function classifyError(error: unknown): ErrorType {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const message = error.message.toLowerCase();
  
  // Network errors
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("connection") ||
    message.includes("offline") ||
    message.includes("failed to fetch") ||
    message.includes("cannot connect")
  ) {
    return "network";
  }

  // Timeout errors
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("etimedout")
  ) {
    return "timeout";
  }

  // Server errors
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("server error") ||
    message.includes("internal error")
  ) {
    return "server";
  }

  // Validation errors
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("400")
  ) {
    return "validation";
  }

  // File size errors
  if (
    message.includes("size") ||
    message.includes("large") ||
    message.includes("mb") ||
    message.includes("limit")
  ) {
    return "file_size";
  }

  // File type errors
  if (
    message.includes("type") ||
    message.includes("format") ||
    message.includes("jpg") ||
    message.includes("png") ||
    message.includes("jpeg") ||
    message.includes("unsupported")
  ) {
    return "file_type";
  }

  return "unknown";
}

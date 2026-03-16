"use client";

import { useState, useCallback } from "react";

export interface ValidationError {
  type: "size" | "type" | "count" | "duplicate";
  message: string;
  fileName?: string;
}

interface FileValidatorProps {
  maxSizeMB: number;
  acceptedTypes: string[];
  onValidationError?: (errors: ValidationError[]) => void;
  children: (props: {
    validationErrors: ValidationError[];
    clearErrors: () => void;
    validateFile: (file: File) => boolean;
  }) => React.ReactNode;
}

export function FileValidator({
  maxSizeMB,
  acceptedTypes,
  onValidationError,
  children
}: FileValidatorProps) {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const clearErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateFile = useCallback((file: File): boolean => {
    const errors: ValidationError[] = [];

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      errors.push({
        type: "size",
        message: `${file.name} (${formatFileSize(file.size)}) 超过 ${maxSizeMB}MB 限制`,
        fileName: file.name
      });
    }

    // Check file type
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const mimeType = file.type.toLowerCase();
    const isValidType = acceptedTypes.some(type => {
      const lowerType = type.toLowerCase().replace(".", "");
      return (
        mimeType.includes(lowerType) ||
        fileExtension === lowerType ||
        (lowerType === "jpg" && (fileExtension === "jpg" || fileExtension === "jpeg"))
      );
    });

    if (!isValidType) {
      errors.push({
        type: "type",
        message: `${file.name} 不是支持的格式 (${acceptedTypes.join(", ")})`,
        fileName: file.name
      });
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      onValidationError?.(errors);
      return false;
    }

    return true;
  }, [maxSizeMB, acceptedTypes, onValidationError]);

  return <>{children({ validationErrors, clearErrors, validateFile })}</>;
}

// Validation error display component
interface ValidationErrorListProps {
  errors: ValidationError[];
  onDismiss?: () => void;
}

export function ValidationErrorList({ errors, onDismiss }: ValidationErrorListProps) {
  if (errors.length === 0) return null;

  const getErrorIcon = (type: ValidationError["type"]) => {
    switch (type) {
      case "size":
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        );
      case "type":
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case "count":
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case "duplicate":
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getErrorColor = (type: ValidationError["type"]) => {
    switch (type) {
      case "size":
        return "text-violet-400 bg-violet-500/10 border-violet-500/30";
      case "type":
        return "text-pink-400 bg-pink-500/10 border-pink-500/30";
      case "count":
        return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      case "duplicate":
        return "text-sky-400 bg-sky-500/10 border-sky-500/30";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
    }
  };

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
      {errors.map((error, index) => (
        <div
          key={index}
          className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${getErrorColor(error.type)}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getErrorIcon(error.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{error.message}</p>
          </div>
        </div>
      ))}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          清除所有错误
        </button>
      )}
    </div>
  );
}

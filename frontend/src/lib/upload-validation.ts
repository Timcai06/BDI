const DEFAULT_MAX_UPLOAD_SIZE_MB = 30;
const configuredMaxUploadSizeMb = Number.parseInt(
  process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB ?? "",
  10
);

export const MAX_UPLOAD_SIZE_MB =
  Number.isFinite(configuredMaxUploadSizeMb) && configuredMaxUploadSizeMb > 0
    ? configuredMaxUploadSizeMb
    : DEFAULT_MAX_UPLOAD_SIZE_MB;

export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export function getUploadSizeError(file: Pick<File, "name" | "size">): string | null {
  if (file.size <= MAX_UPLOAD_SIZE_BYTES) {
    return null;
  }

  return `${file.name} 超过 ${MAX_UPLOAD_SIZE_MB}MB 限制，请压缩后重试。`;
}

import {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  getUploadSizeError
} from "@/lib/upload-validation";

describe("upload-validation", () => {
  it("allows a 25MB png within the default limit", () => {
    const file = {
      name: "bridge.png",
      size: 25 * 1024 * 1024
    };

    expect(MAX_UPLOAD_SIZE_MB).toBeGreaterThanOrEqual(25);
    expect(getUploadSizeError(file)).toBeNull();
  });

  it("rejects files that exceed the configured limit", () => {
    const file = {
      name: "bridge.png",
      size: MAX_UPLOAD_SIZE_BYTES + 1
    };

    expect(getUploadSizeError(file)).toBe(
      `bridge.png 超过 ${MAX_UPLOAD_SIZE_MB}MB 限制，请压缩后重试。`
    );
  });
});

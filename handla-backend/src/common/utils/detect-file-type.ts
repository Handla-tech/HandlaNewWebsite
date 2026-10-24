import { createRequire } from 'node:module';

/**
 * Detect file type from actual bytes using file-type v22.
 * Requires Node.js >= 22.12 with require(esm) support.
 */
export interface DetectedFileType {
  ext: string;
  mime: string;
}

type FileTypeModule = {
  fileTypeFromBuffer: (
    input: Uint8Array,
  ) => Promise<DetectedFileType | undefined>;
};

const nativeRequire = createRequire(__filename);

let cachedModule: FileTypeModule | undefined;

export async function detectFileType(
  buffer: Buffer,
): Promise<DetectedFileType | undefined> {
  cachedModule ??= nativeRequire('file-type') as FileTypeModule;

  return cachedModule.fileTypeFromBuffer(buffer);
}

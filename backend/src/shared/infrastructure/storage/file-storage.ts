export interface StoredFile {
  url: string;
  key: string;
}

/**
 * Port for binary uploads (product media, avatars). LocalFileStorage writes to
 * disk for Phase 1; a Supabase Storage adapter can replace it later.
 */
export abstract class FileStorage {
  abstract save(folder: string, originalName: string, data: Buffer, mimeType: string): Promise<StoredFile>;
  abstract remove(url: string): Promise<void>;
}

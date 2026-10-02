import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppConfig } from '../../../config/app-config.js';
import { FileStorage, StoredFile } from './file-storage.js';

const EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

@Injectable()
export class LocalFileStorage extends FileStorage {
  constructor(private readonly config: AppConfig) {
    super();
  }

  async save(folder: string, _originalName: string, data: Buffer, mimeType: string): Promise<StoredFile> {
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, '');
    const key = `${safeFolder}/${randomUUID()}${EXT[mimeType] ?? ''}`;
    const target = path.resolve(this.config.uploads.dir, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return { key, url: `${this.config.uploads.publicPath}/${key}` };
  }

  async remove(url: string): Promise<void> {
    const prefix = `${this.config.uploads.publicPath}/`;
    if (!url.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    if (key.includes('..')) return;
    await rm(path.resolve(this.config.uploads.dir, key), { force: true });
  }
}

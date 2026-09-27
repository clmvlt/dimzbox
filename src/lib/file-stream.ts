import { open, type FileHandle } from "node:fs/promises";

const READ_SIZE = 512 * 1024;

/**
 * Stream web d'une plage [start, end] (inclus) d'un fichier, en mode pull :
 * on ne lit le morceau suivant que quand le client a consommé le précédent.
 * Évite Readable.toWeb qui peut bufferiser un gros fichier en mémoire
 * face à un client lent.
 */
export function createFileStream(
  filePath: string,
  start: number,
  end: number
): ReadableStream<Uint8Array> {
  let handle: FileHandle | null = null;
  let position = start;

  const close = async () => {
    const h = handle;
    handle = null;
    await h?.close().catch(() => {});
  };

  return new ReadableStream<Uint8Array>({
    async start() {
      handle = await open(filePath, "r");
    },
    async pull(controller) {
      try {
        const remaining = end - position + 1;
        if (!handle || remaining <= 0) {
          await close();
          controller.close();
          return;
        }
        const length = Math.min(READ_SIZE, remaining);
        const buffer = Buffer.allocUnsafe(length);
        const { bytesRead } = await handle.read(buffer, 0, length, position);
        if (bytesRead === 0) {
          await close();
          controller.close();
          return;
        }
        position += bytesRead;
        controller.enqueue(buffer.subarray(0, bytesRead));
      } catch (error) {
        await close();
        controller.error(error);
      }
    },
    async cancel() {
      await close();
    },
  });
}

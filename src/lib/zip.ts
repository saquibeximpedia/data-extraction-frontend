import 'server-only';
import { Readable, pipeline } from 'stream';
import zlib from 'zlib';

export interface ZipEntry {
  /** Path inside the zip, e.g. "EU/2026/EU_2026-06_part1.csv" */
  name: string;
  /** Opens the file's bytes when its turn comes */
  open: () => Promise<AsyncIterable<Uint8Array>>;
}

/** Plain zip (no ZIP64), so each file and the whole archive must stay under 4 GB */
const ZIP_LIMIT = 0xffffffff;

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Writes a zip as a stream: each file is fetched, deflated (native zlib) and sent while the next
 * waits, so the download starts at once and memory stays flat whatever the total size. Sizes and
 * checksums follow each file (data descriptors), since they are only known once it is sent.
 */
export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  async function* generate(): AsyncGenerator<Buffer> {
    const central: Buffer[] = [];
    let offset = 0;
    const { time, date } = dosDateTime(new Date());
    // Bit 3: sizes in a data descriptor; bit 11: UTF-8 names
    const flags = 0x0808;

    for (const entry of entries) {
      const name = Buffer.from(entry.name, 'utf-8');
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(flags, 6);
      header.writeUInt16LE(8, 8); // deflate
      header.writeUInt16LE(time, 10);
      header.writeUInt16LE(date, 12);
      header.writeUInt16LE(name.length, 26);
      const start = offset;
      yield Buffer.concat([header, name]);
      offset += header.length + name.length;

      let crc = 0;
      let size = 0;
      let compressed = 0;
      const source = await entry.open();
      async function* counted() {
        for await (const chunk of source) {
          crc = zlib.crc32(chunk, crc);
          size += chunk.length;
          yield chunk;
        }
      }
      const deflate = zlib.createDeflateRaw({ level: 6 });
      // A failed download ends the deflater with its error, which ends the zip
      pipeline(Readable.from(counted()), deflate, () => {});
      for await (const out of deflate as AsyncIterable<Buffer>) {
        compressed += out.length;
        yield out;
      }
      offset += compressed;
      if (size > ZIP_LIMIT || offset > ZIP_LIMIT) throw new Error('The zip would pass 4 GB; download fewer files at once');

      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50, 0);
      descriptor.writeUInt32LE(crc >>> 0, 4);
      descriptor.writeUInt32LE(compressed, 8);
      descriptor.writeUInt32LE(size, 12);
      yield descriptor;
      offset += descriptor.length;

      const record = Buffer.alloc(46);
      record.writeUInt32LE(0x02014b50, 0);
      record.writeUInt16LE(20, 4);
      record.writeUInt16LE(20, 6);
      record.writeUInt16LE(flags, 8);
      record.writeUInt16LE(8, 10);
      record.writeUInt16LE(time, 12);
      record.writeUInt16LE(date, 14);
      record.writeUInt32LE(crc >>> 0, 16);
      record.writeUInt32LE(compressed, 20);
      record.writeUInt32LE(size, 24);
      record.writeUInt16LE(name.length, 28);
      record.writeUInt32LE(start, 42);
      central.push(record, name);
    }

    const directory = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    yield Buffer.concat([directory, end]);
  }

  return Readable.toWeb(Readable.from(generate())) as ReadableStream<Uint8Array>;
}

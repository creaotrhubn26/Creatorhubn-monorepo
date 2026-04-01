declare module "archiver" {
  import type { Writable } from "stream";

  type EntryData = {
    name: string;
  };

  type ArchiverInstance = {
    append(source: string | Buffer, data: EntryData): void;
    on(event: "error", listener: (error: Error) => void): ArchiverInstance;
    pipe(destination: Writable): Writable;
    finalize(): Promise<void>;
  };

  type ArchiverFactory = (
    format: string,
    options?: { zlib?: { level?: number } },
  ) => ArchiverInstance;

  const archiver: ArchiverFactory;
  export default archiver;
}

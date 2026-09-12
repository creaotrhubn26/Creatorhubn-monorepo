declare module "adm-zip" {
  interface AdmZipEntry {
    entryName: string;
    isDirectory: boolean;
    getData(): Buffer;
  }

  class AdmZip {
    constructor(input?: Buffer | string);
    addFile(entryName: string, content: Buffer, comment?: string, attr?: number): void;
    getEntries(): AdmZipEntry[];
    toBuffer(): Buffer;
  }

  export = AdmZip;
}

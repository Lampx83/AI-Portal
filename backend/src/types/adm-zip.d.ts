declare module "adm-zip" {
  class AdmZip {
    constructor(buffer?: Buffer)
    addFile(entryName: string, data: Buffer): void
    getEntry(entryName: string): { getData(): Buffer; isDirectory: boolean; entryName: string } | null
    getEntries(): { getData(): Buffer; isDirectory: boolean; entryName: string }[]
    toBuffer(): Buffer
  }
  export = AdmZip
}

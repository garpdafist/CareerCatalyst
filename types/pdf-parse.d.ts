declare module 'pdf-parse' {
  interface PDFParseOptions {
    max?: number;
    pagerender?: (pageData: any) => Promise<string>;
    version?: string;
  }

  interface PDFParseResult {
    text: string;
    numpages: number;
    info: any;
    metadata: any;
    version: string;
  }

  function PDFParse(dataBuffer: Buffer, options?: PDFParseOptions): Promise<PDFParseResult>;
  
  export = PDFParse;
}
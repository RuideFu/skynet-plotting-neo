declare module 'fitsjs' {
  namespace astro {
    namespace FITS {
      // DataUnit class declaration in TypeScript
      class DataUnit {
        // Properties
        buffer?: ArrayBuffer;
        blob?: Blob;

        // Static methods for endianness swapping
        static swapEndian: {
          B: (value: number) => number; // 8-bit (no-op)
          I: (value: number) => number; // 16-bit swap
          J: (value: number) => number; // 32-bit swap
          [key: number]: (value: number) => number; // Index signature for accessing by bit size
        };

        // Constructor
        constructor(header: any, data: ArrayBuffer | Blob);

        // Any additional methods if defined in the class can go here
      }

      // ImageUtils interface in TypeScript
      interface ImageUtils {
        // Methods for ImageUtils
        getExtent(arr: number[]): [number, number];
        getPixel(arr: number[], x: number, y: number): number;
      }

      // Image class declaration in TypeScript
      class Image extends DataUnit implements ImageUtils {
        // Properties
        allocationSize: number;
        bitpix: number;
        naxis: number[];
        width: number;
        height: number;
        depth: number;
        bzero: number;
        bscale: number;
        bytes: number;
        length: number;
        frame: number;
        frameOffsets: Array<{ begin: number, buffers?: ArrayBuffer[] }>;
        frameLength: number;
        nBuffers: number;
        buffer?: ArrayBuffer;
        blob?: Blob;

        // Constructor
        constructor(header: any, data: ArrayBuffer | Blob);

        // Methods
        _getFrame(
          buffer: ArrayBuffer,
          bitpix: number,
          bzero: number,
          bscale: number
        ): Float32Array | Uint32Array;

        _getFrameAsync(
          buffers: ArrayBuffer[],
          callback: (arr: Float32Array | Uint32Array) => void,
          opts?: any
        ): void;

        getFrame(
          frame: number,
          callback: (arr: Float32Array | Uint32Array, opts?: any) => void,
          opts?: any
        ): void;

        getFrames(
          frame: number,
          number: number,
          callback: (arr: Float32Array | Uint32Array, opts?: any) => void,
          opts?: any
        ): void;

        isDataCube(): boolean;

        // ImageUtils methods
        getExtent(arr: number[]): [number, number];
        getPixel(arr: number[], x: number, y: number): number;
      }

      // Header class declaration in TypeScript
      class Header {
        // Properties
        primary: boolean;
        extension: boolean;
        maxLines: number;
        arrayPattern: RegExp;
        cards: Record<string, any>;
        cardIndex: number;
        block: string;
        verifyCard: Record<string, Function>;

        // Constructor
        constructor(block: string);

        // Methods
        get(key: string): any;
        set(key: string, value: any, comment?: string): void;
        contains(key: string): boolean;
        readLine(line: string): void;
        validate(key: string, value: any): any;
        readBlock(block: string): void;
        hasDataUnit(): boolean;
        getDataLength(): number;
        getDataType(): string | null;
        isPrimary(): boolean;
        isExtension(): boolean;
      }
    }
  }
}

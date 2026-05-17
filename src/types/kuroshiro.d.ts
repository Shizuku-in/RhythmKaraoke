declare module "kuroshiro" {
  interface AnalyzerLike {
    init(): Promise<void>;
    parse(str?: string): Promise<unknown[]>;
  }

  interface ConvertOptions {
    to?: "hiragana" | "katakana" | "romaji";
    mode?: "normal" | "spaced" | "okurigana" | "furigana";
    romajiSystem?: "nippon" | "passport" | "hepburn";
    delimiter_start?: string;
    delimiter_end?: string;
  }

  export default class Kuroshiro {
    static Util: {
      kanaToHiragna(str: string): string;
      kanaToKatakana(str: string): string;
    };

    init(analyzer: AnalyzerLike): Promise<void>;
    convert(str: string, options?: ConvertOptions): Promise<string>;
  }
}

declare module "kuroshiro-analyzer-kuromoji" {
  export interface KuromojiToken {
    surface_form: string;
    reading?: string;
    pronunciation?: string;
  }

  export default class KuromojiAnalyzer {
    constructor(options?: { dictPath?: string });
    init(): Promise<void>;
    parse(str?: string): Promise<KuromojiToken[]>;
  }
}

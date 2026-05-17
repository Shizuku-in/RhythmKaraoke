import KuroshiroModule from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import type { RubyToken } from "../domain/rhythmProject";

type KuroshiroConstructor = new () => {
  init(analyzer: KuromojiAnalyzer): Promise<void>;
};

let analyzerPromise: Promise<KuromojiAnalyzer> | null = null;

async function getAnalyzer(): Promise<KuromojiAnalyzer> {
  if (!analyzerPromise) {
    analyzerPromise = (async () => {
      const analyzer = new KuromojiAnalyzer({
        dictPath: "/vendor/kuromoji/dict/",
      });
      const Kuroshiro =
        ((KuroshiroModule as unknown as { default?: KuroshiroConstructor }).default ??
          KuroshiroModule) as KuroshiroConstructor;
      const kuroshiro = new Kuroshiro();

      await kuroshiro.init(analyzer);
      return analyzer;
    })();
  }

  return analyzerPromise;
}

export async function tokenizeRubyLines(lines: string[]): Promise<RubyToken[][]> {
  const analyzer = await getAnalyzer();
  return Promise.all(lines.map((line) => analyzer.parse(line)));
}

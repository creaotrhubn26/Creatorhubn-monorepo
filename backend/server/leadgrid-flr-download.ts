/**
 * Nedlasting av store svar over HTTP/2, med et flytkontrollvindu som holder.
 *
 * Node sin innebygde fetch (undici) laster ned dette svaret i 2,5 MB/s.
 * curl gjør det samme i 48 MB/s. Forskjellen er flytkontrollvinduet:
 * standardvinduet er lite, og hver 64 KB krever en WINDOW_UPDATE tur-retur.
 * På 23,5 MB blir det mange nok til å avgjøre saken.
 *
 * Og saken er avgjort på tid: NHNs gateway bruker ~13,5 sekunder på å
 * generere svaret og kutter forbindelsen etter 15. Det etterlater under
 * halvannet sekund til å flytte 23,5 MB. Målt 2026-09-24:
 *
 *   undici fetch                  2,5 MB/s  →  rakk 4,4 MB, døde
 *   http2 m/ standardvindu        —         →  rakk 162 KB, døde
 *   http2 m/ 64 MB vindu         35,3 MB/s  →  ferdig på 14,3 s
 *   curl                         48,7 MB/s  →  ferdig på 12,5 s
 *
 * Derfor denne modulen. Den gjør én ting: henter en URL over HTTP/2 med et
 * vindu stort nok til at overføringen ikke blir flaskehalsen.
 */
import http2 from "node:http2";

/** 64 MB. Rommer hele svaret uten en eneste WINDOW_UPDATE-runde. */
const WINDOW_BYTES = 64 * 1024 * 1024;

export interface Http2Response {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

export class Http2DownloadError extends Error {
  constructor(
    message: string,
    /** Bytes mottatt før det røk. Skiller «ingenting» fra «avkortet». */
    readonly receivedBytes: number,
  ) {
    super(message);
    this.name = "Http2DownloadError";
  }
}

/**
 * Henter en URL over HTTP/2.
 *
 * Kaster Http2DownloadError ved transportfeil. Returnerer svaret som det er
 * ved HTTP-feilkoder — det er kallerens jobb å avgjøre om 504 skal prøves
 * på nytt.
 */
export async function downloadOverHttp2(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<Http2Response> {
  const parsed = new URL(url);
  const origin = `${parsed.protocol}//${parsed.host}`;

  const client = http2.connect(origin, {
    settings: { initialWindowSize: 16 * 1024 * 1024, enablePush: false },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const påFeil = (error: Error) => reject(new Http2DownloadError(error.message, 0));
      client.once("connect", () => {
        client.removeListener("error", påFeil);
        resolve();
      });
      client.once("error", påFeil);
    });

    // Må settes etter at sesjonen står, ellers rekker ikke WINDOW_UPDATE
    // ut før serveren begynner å sende. Målt: uten dette kom bare 162 KB.
    client.setLocalWindowSize(WINDOW_BYTES);

    const request = client.request({
      ...options.headers,
      [http2.constants.HTTP2_HEADER_PATH]: `${parsed.pathname}${parsed.search}`,
      [http2.constants.HTTP2_HEADER_METHOD]: "GET",
    });

    return await new Promise<Http2Response>((resolve, reject) => {
      const biter: Buffer[] = [];
      let mottatt = 0;
      let status = 0;
      let headers: Record<string, string> = {};

      const avbryt = () => {
        request.close(http2.constants.NGHTTP2_CANCEL);
        reject(new Http2DownloadError("aborted", mottatt));
      };
      options.signal?.addEventListener("abort", avbryt, { once: true });

      const timer = setTimeout(() => {
        request.close(http2.constants.NGHTTP2_CANCEL);
        reject(new Http2DownloadError("timeout", mottatt));
      }, options.timeoutMs);

      const rydd = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", avbryt);
      };

      request.on("response", (hodene) => {
        status = Number(hodene[http2.constants.HTTP2_HEADER_STATUS] ?? 0);
        headers = Object.fromEntries(
          Object.entries(hodene)
            .filter(([nøkkel]) => !nøkkel.startsWith(":"))
            .map(([nøkkel, verdi]) => [nøkkel, String(verdi)]),
        );
      });
      request.on("data", (bit: Buffer) => {
        mottatt += bit.length;
        biter.push(bit);
      });
      request.on("end", () => {
        rydd();
        resolve({ status, headers, body: Buffer.concat(biter) });
      });
      request.on("error", (error: Error) => {
        rydd();
        reject(new Http2DownloadError(error.message, mottatt));
      });

      request.end();
    });
  } finally {
    client.close();
  }
}

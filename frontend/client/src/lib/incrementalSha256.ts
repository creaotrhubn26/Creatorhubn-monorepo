const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

/** Incremental SHA-256 keeps multi-gigabyte browser uploads out of memory. */
export class IncrementalSha256 {
  private state = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  private pending = new Uint8Array(64);
  private pendingLength = 0;
  private byteLength = 0;

  update(input: Uint8Array): void {
    this.byteLength += input.length;
    let offset = 0;
    while (offset < input.length) {
      const take = Math.min(64 - this.pendingLength, input.length - offset);
      this.pending.set(input.subarray(offset, offset + take), this.pendingLength);
      this.pendingLength += take; offset += take;
      if (this.pendingLength === 64) { this.compress(this.pending); this.pendingLength = 0; }
    }
  }

  digestHex(): string {
    const bitLow = (this.byteLength * 8) >>> 0;
    const bitHigh = Math.floor(this.byteLength / 0x20000000) >>> 0;
    this.pending[this.pendingLength++] = 0x80;
    if (this.pendingLength > 56) {
      this.pending.fill(0, this.pendingLength); this.compress(this.pending); this.pendingLength = 0;
    }
    this.pending.fill(0, this.pendingLength, 56);
    const view = new DataView(this.pending.buffer);
    view.setUint32(56, bitHigh); view.setUint32(60, bitLow);
    this.compress(this.pending);
    return Array.from(this.state).map((word) => word.toString(16).padStart(8, '0')).join('');
  }

  private compress(block: Uint8Array): void {
    const words = new Uint32Array(64); const view = new DataView(block.buffer, block.byteOffset, 64);
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(index * 4);
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15], b = words[index - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = this.state;
    for (let index = 0; index < 64; index += 1) {
      const upper = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const choose = (e & f) ^ (~e & g);
      const first = (h + upper + choose + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const lower = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const second = (lower + majority) >>> 0;
      h=g; g=f; f=e; e=(d+first)>>>0; d=c; c=b; b=a; a=(first+second)>>>0;
    }
    this.state[0]=(this.state[0]+a)>>>0; this.state[1]=(this.state[1]+b)>>>0;
    this.state[2]=(this.state[2]+c)>>>0; this.state[3]=(this.state[3]+d)>>>0;
    this.state[4]=(this.state[4]+e)>>>0; this.state[5]=(this.state[5]+f)>>>0;
    this.state[6]=(this.state[6]+g)>>>0; this.state[7]=(this.state[7]+h)>>>0;
  }
}

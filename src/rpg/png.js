// Minimal PNG decoder for the generated atlas (8-bit RGBA, non-interlaced; all filter types).
// `inflate(bytes) -> Promise<Uint8Array>` is injected: DecompressionStream in the browser, zlib in Node tests.
export async function decodePNG(bytes, inflate) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0) !== 0x89504e47) throw new Error('Not a PNG');
  let pos = 8, width = 0, height = 0;
  const idat = [];
  while (pos < u8.length) {
    const len = dv.getUint32(pos), type = String.fromCharCode(...u8.subarray(pos + 4, pos + 8));
    const data = u8.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = dv.getUint32(pos + 8); height = dv.getUint32(pos + 12);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('Unsupported PNG format');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const total = idat.reduce((n, d) => n + d.length, 0), z = new Uint8Array(total);
  let o = 0; for (const d of idat) { z.set(d, o); o += d.length; }
  const raw = await inflate(z);
  const stride = width * 4, out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[dst + x - 4] : 0, b = y ? out[dst - stride + x] : 0, c = x >= 4 && y ? out[dst - stride + x - 4] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return {width, height, data: out};
}

export async function browserInflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

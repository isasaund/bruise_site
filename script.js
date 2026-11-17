/*
  Random bruise generator.
  Reference photos in bruises/ are training only. Clicks place new isolated
  marks from bruises/isolated, never the original photos.
*/
(() => {
  "use strict";

  const BRUISE_FILES = [
    "bruises/isolated/isolated_hip_maroon.png",
    "bruises/isolated/isolated_cloud_purple.png",
    "bruises/isolated/isolated_small_plum.png",
    "bruises/isolated/isolated_fresh_pink.png",
    "bruises/isolated/isolated_healing_yellow.png",
    "bruises/isolated/isolated_fresh_red.png",
    "bruises/isolated/isolated_spatter.png",
    "bruises/isolated/isolated_small_blot.png",
    "bruises/isolated/isolated_tall_purple.png",
    "bruises/isolated/isolated_spatter_dots.png"
  ];

  const randomBetween = (min, max) => Math.random() * (max - min) + min;

  function knockOutPaper(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      const mn = Math.min(r, g, b);
      const mx = Math.max(r, g, b);
      const sat = mx - mn;
      if (a < 8 || mx < 12 || (mn > 236 && sat < 18)) {
        d[i + 3] = 0;
        continue;
      }
      if (mn > 210 && sat < 28) d[i + 3] = a * Math.max(0, (238 - mn) / 28);
    }
  }

  function cropOpaque(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const w = canvas.width;
    const h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3] < 18) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX) return null;
    const pad = 4;
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = cw + pad * 2;
    out.height = ch + pad * 2;
    out.getContext("2d").drawImage(canvas, minX, minY, cw, ch, pad, pad, cw, ch);
    return out;
  }

  function featherRim(canvas) {
    const w = canvas.width;
    const h = canvas.height;
    const radius = Math.max(12, Math.min(26, Math.round(Math.min(w, h) * 0.09)));
    const pad = Math.ceil(radius * 2.8);
    const out = document.createElement("canvas");
    out.width = w + pad * 2;
    out.height = h + pad * 2;
    const ctx = out.getContext("2d");
    ctx.filter = `blur(${(radius * 1.5).toFixed(1)}px)`;
    ctx.globalAlpha = 0.58;
    ctx.drawImage(canvas, pad, pad);
    ctx.filter = `blur(${(radius * 0.32).toFixed(1)}px)`;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(canvas, pad, pad);

    const halo = document.createElement("canvas");
    halo.width = out.width;
    halo.height = out.height;
    const hctx = halo.getContext("2d");
    hctx.filter = `blur(${Math.max(10, radius * 1.05).toFixed(1)}px)`;
    hctx.drawImage(out, 0, 0);
    const image = ctx.getImageData(0, 0, out.width, out.height);
    const fade = hctx.getImageData(0, 0, out.width, out.height).data;
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const t = fade[i + 3] / 255;
      const edge = t > 0.78 ? 1 : Math.pow(t / 0.78, 1.6);
      d[i + 3] = Math.round(d[i + 3] * edge * 0.88);
    }
    ctx.putImageData(image, 0, 0);
    return out;
  }

  function prepareSource(img) {
    const maxEdge = 640;
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    knockOutPaper(imageData);
    ctx.putImageData(imageData, 0, 0);
    const cropped = cropOpaque(canvas);
    if (!cropped) return null;
    const feathered = featherRim(cropped);
    const id = decodeURI(img.src).split("/").pop().replace(/\.png$/i, "");
    return { canvas: feathered, w: feathered.width, h: feathered.height, id };
  }

  const PALETTES = [
    { hue: -0.04, sat: 1.12, light: 0.9, name: "maroon" },
    { hue: 0.06, sat: 1.05, light: 1.04, name: "yellow" },
    { hue: -0.1, sat: 1.18, light: 0.88, name: "plum" },
    { hue: 0.02, sat: 0.95, light: 1.08, name: "pink" },
    { hue: -0.02, sat: 1.22, light: 0.86, name: "fresh" },
    { hue: 0.08, sat: 0.88, light: 1.1, name: "olive" },
    { hue: -0.07, sat: 1.08, light: 0.94, name: "violet" }
  ];

  const recentIds = [];
  let sourceBag = [];

  function nextUnused(sources, avoid) {
    if (!sourceBag.length) sourceBag = sources.slice().sort(() => Math.random() - 0.5);
    let pick = sourceBag.pop();
    if (avoid && sources.length > 1 && pick === avoid) {
      sourceBag.unshift(pick);
      pick = sourceBag.pop() || pick;
    }
    return pick;
  }

  function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    const delta = max - min;
    if (delta) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h /= 6;
      if (h < 0) h += 1;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2 = (t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    return [
      Math.round(hue2(h + 1 / 3) * 255),
      Math.round(hue2(h) * 255),
      Math.round(hue2(h - 1 / 3) * 255)
    ];
  }

  function shiftTone(canvas, palette) {
    const hue = palette.hue + randomBetween(-0.03, 0.03);
    const sat = palette.sat * randomBetween(0.9, 1.1);
    const light = palette.light * randomBetween(0.92, 1.08);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) continue;
      const [h, s, l] = rgbToHsl(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
      const rgb = hslToRgb(
        (h + hue + 1) % 1,
        Math.max(0, Math.min(1, s * sat)),
        Math.max(0.05, Math.min(0.88, l * light))
      );
      d[i] = rgb[0];
      d[i + 1] = rgb[1];
      d[i + 2] = rgb[2];
    }
    ctx.putImageData(image, 0, 0);
  }

  function warpedCopy(source) {
    const w = source.w;
    const h = source.h;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    ctx.drawImage(source.canvas, 0, 0);
    return out;
  }

  function fillIrregularBlob(ctx, cx, cy, rx, ry) {
    const p2 = randomBetween(0, Math.PI * 2);
    const p3 = randomBetween(0, Math.PI * 2);
    const p4 = randomBetween(0, Math.PI * 2);
    const a2 = randomBetween(0.14, 0.32);
    const a3 = randomBetween(0.1, 0.26);
    const a4 = randomBetween(0.05, 0.16);
    const indentAngle = randomBetween(0, Math.PI * 2);
    const indent = Math.random() < 0.75 ? randomBetween(0.14, 0.38) : 0;
    const bulgeAngle = indentAngle + randomBetween(1.6, 4.4);
    const bulge = randomBetween(0.08, 0.22);
    const steps = 96;
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * Math.PI * 2;
      let wobble = 1
        + a2 * Math.sin(t * 2 + p2)
        + a3 * Math.sin(t * 3 + p3)
        + a4 * Math.sin(t * 4.7 + p4);
      const wrap = (angle) => {
        let d = (t - angle) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        return d;
      };
      wobble -= indent * Math.exp(-(wrap(indentAngle) ** 2) / 0.28);
      wobble += bulge * Math.exp(-(wrap(bulgeAngle) ** 2) / 0.22);
      wobble = Math.max(0.32, wobble);
      const x = cx + Math.cos(t) * rx * wobble;
      const y = cy + Math.sin(t) * ry * wobble;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function uniqueMask(size) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    const cx = size / 2 + randomBetween(-size * 0.08, size * 0.08);
    const cy = size / 2 + randomBetween(-size * 0.08, size * 0.08);
    fillIrregularBlob(
      ctx,
      cx,
      cy,
      size * randomBetween(0.3, 0.48),
      size * randomBetween(0.2, 0.4)
    );
    if (Math.random() < 0.7) {
      fillIrregularBlob(
        ctx,
        cx + randomBetween(-size * 0.18, size * 0.18),
        cy + randomBetween(-size * 0.16, size * 0.16),
        size * randomBetween(0.14, 0.28),
        size * randomBetween(0.1, 0.22)
      );
    }
    if (Math.random() < 0.4) {
      fillIrregularBlob(
        ctx,
        cx + randomBetween(-size * 0.22, size * 0.22),
        cy + randomBetween(-size * 0.2, size * 0.2),
        size * randomBetween(0.08, 0.16),
        size * randomBetween(0.07, 0.14)
      );
    }
    ctx.filter = `blur(${Math.max(10, size * 0.07).toFixed(1)}px)`;
    ctx.drawImage(canvas, 0, 0);
    return canvas;
  }

  function stampSource(ctx, source, size, strength) {
    const patch = warpedCopy(source);
    const long = Math.max(patch.width, patch.height);
    const scaleX = (size * randomBetween(0.68, 1.06)) / long;
    const scaleY = scaleX * randomBetween(0.58, 1.42);
    ctx.save();
    ctx.translate(
      size / 2 + randomBetween(-size * 0.16, size * 0.16),
      size / 2 + randomBetween(-size * 0.16, size * 0.16)
    );
    ctx.rotate(randomBetween(-Math.PI, Math.PI));
    ctx.transform(1, randomBetween(-0.22, 0.22), randomBetween(-0.32, 0.32), 1, 0, 0);
    ctx.scale(Math.random() < 0.5 ? -scaleX : scaleX, Math.random() < 0.5 ? -scaleY : scaleY);
    ctx.globalAlpha = strength;
    ctx.drawImage(patch, -patch.width / 2, -patch.height / 2);
    ctx.restore();
  }

  function fingerprint(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { width: w, height: h } = canvas;
    const data = ctx.getImageData(0, 0, w, h).data;
    let ink = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 32) {
      if (data[i + 3] < 20) continue;
      ink += data[i + 3];
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
    return [w, h, n, Math.round(ink / 50), n ? Math.round(r / n) : 0, n ? Math.round(g / n) : 0, n ? Math.round(b / n) : 0].join(":");
  }

  function tooSimilar(id) {
    const parts = id.split(":").map(Number);
    return recentIds.some((prev) => {
      const p = prev.split(":").map(Number);
      const dw = Math.abs(parts[0] - p[0]);
      const dh = Math.abs(parts[1] - p[1]);
      const dr = Math.abs(parts[4] - p[4]);
      const dg = Math.abs(parts[5] - p[5]);
      const db = Math.abs(parts[6] - p[6]);
      return dw < 28 && dh < 28 && dr < 14 && dg < 12 && db < 12;
    });
  }

  function generateBruise(sources) {
    let canvas = null;
    let id = "";
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const primary = nextUnused(sources);
      const extraCount = Math.random() < 0.35 ? 2 : 1;
      const size = Math.round(randomBetween(90, 430));
      canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      stampSource(ctx, primary, size, 1);
      for (let i = 1; i < extraCount; i += 1) {
        stampSource(ctx, nextUnused(sources, primary), size, randomBetween(0.22, 0.7));
      }
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(uniqueMask(size), 0, 0);
      ctx.globalCompositeOperation = "source-over";
      const palette = PALETTES[(attempt + Math.floor(Math.random() * PALETTES.length)) % PALETTES.length];
      shiftTone(canvas, palette);
      const cropped = cropOpaque(canvas);
      canvas = featherRim(cropped || canvas);
      id = fingerprint(canvas);
      if (!tooSimilar(id)) break;
    }
    recentIds.push(id);
    if (recentIds.length > 14) recentIds.shift();
    return canvas;
  }

  function buildHealMaps(src) {
    const len = src.length;
    const pix = len / 4;
    const green = new Uint8ClampedArray(len);
    const yellow = new Uint8ClampedArray(len);
    const delay = new Float32Array(pix);
    const ochre = randomBetween(-14, 18);
    for (let i = 0, p = 0; i < len; i += 4, p += 1) {
      const a = src[i + 3];
      if (!a) {
        delay[p] = 1;
        continue;
      }
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const darkness = 1 - lum / 255;
      const cover = a / 255;
      const edge = Math.pow(Math.max(0, 1 - cover * (0.32 + darkness * 0.68)), 1.15);
      const mottle = Math.abs(Math.sin(p * 12.9898) * 43758.5453) % 1;
      delay[p] = 0.12 + (1 - edge) * 0.58 + mottle * 0.12;

      const gMix = 0.3 + edge * 0.42;
      green[i] = r * (1 - gMix) + (138 + ochre) * gMix;
      green[i + 1] = g * (1 - gMix) + 158 * gMix;
      green[i + 2] = b * (1 - gMix) * 0.62 + 58 * gMix;
      green[i + 3] = Math.round(a * 0.9);

      const yMix = 0.4 + edge * 0.5 + mottle * 0.08;
      const goldR = 232 + ochre;
      const goldG = 188 - ochre * 0.12;
      const goldB = 72;
      yellow[i] = r * (1 - yMix) * 0.82 + goldR * yMix;
      yellow[i + 1] = g * (1 - yMix) * 0.68 + goldG * yMix;
      yellow[i + 2] = b * (1 - yMix) * 0.28 + goldB * yMix;
      yellow[i + 3] = Math.round(a * (0.68 + edge * 0.12));
    }
    return { green, yellow, delay };
  }

  function startYellowFade(canvas, ctx, mature) {
    const src = mature.data;
    const { green, yellow, delay } = buildHealMaps(src);
    const frame = ctx.createImageData(canvas.width, canvas.height);
    const out = frame.data;
    const duration = randomBetween(82000, 128000);
    const start = performance.now();
    const baseOp = parseFloat(canvas.style.getPropertyValue("--bruise-opacity")) || 0.78;
    let last = 0;
    let raf = 0;

    const tick = (now) => {
      if (now - last < 80) {
        raf = requestAnimationFrame(tick);
        canvas._healRaf = raf;
        return;
      }
      last = now;
      const t = Math.min(1, (now - start) / duration);
      for (let i = 0, p = 0; i < src.length; i += 4, p += 1) {
        const a = src[i + 3];
        if (!a) {
          out[i] = 0;
          out[i + 1] = 0;
          out[i + 2] = 0;
          out[i + 3] = 0;
          continue;
        }
        const wait = delay[p];
        const span = Math.max(0.32, 1 - wait * 0.42);
        let local = (t - wait) / span;
        if (local < 0) local = 0;
        else if (local > 1) local = 1;
        const s = local * local * (3 - 2 * local);
        if (s === 0) {
          out[i] = src[i];
          out[i + 1] = src[i + 1];
          out[i + 2] = src[i + 2];
          out[i + 3] = a;
          continue;
        }
        let fromR;
        let fromG;
        let fromB;
        let fromA;
        let toR;
        let toG;
        let toB;
        let toA;
        let u;
        if (s < 0.28) {
          u = s / 0.28;
          fromR = src[i];
          fromG = src[i + 1];
          fromB = src[i + 2];
          fromA = a;
          toR = green[i];
          toG = green[i + 1];
          toB = green[i + 2];
          toA = green[i + 3];
        } else {
          u = (s - 0.28) / 0.72;
          fromR = green[i];
          fromG = green[i + 1];
          fromB = green[i + 2];
          fromA = green[i + 3];
          toR = yellow[i];
          toG = yellow[i + 1];
          toB = yellow[i + 2];
          toA = yellow[i + 3];
        }
        const ease = u * u * (3 - 2 * u);
        out[i] = fromR + (toR - fromR) * ease;
        out[i + 1] = fromG + (toG - fromG) * ease;
        out[i + 2] = fromB + (toB - fromB) * ease;
        out[i + 3] = fromA + (toA - fromA) * ease;
      }
      ctx.putImageData(frame, 0, 0);
      const fadeT = Math.max(0, (t - 0.16) / 0.84);
      canvas.style.setProperty("--bruise-opacity", (baseOp * (1 - 0.1 * fadeT)).toFixed(3));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
        canvas._healRaf = raf;
      } else {
        canvas._healRaf = 0;
      }
    };

    raf = requestAnimationFrame(tick);
    canvas._healRaf = raf;
  }

  function startDevelopment(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let final;
    try {
      final = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (err) {
      canvas._stopDevelop = () => {};
      return;
    }
    const src = final.data;
    const frame = ctx.createImageData(canvas.width, canvas.height);
    const out = frame.data;
    const duration = randomBetween(4200, 6400);
    const start = performance.now();
    const yellowWait = randomBetween(72000, 88000);
    let raf = 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const stopAll = () => {
      if (raf) cancelAnimationFrame(raf);
      if (canvas._healRaf) cancelAnimationFrame(canvas._healRaf);
      if (canvas._healTimer) clearTimeout(canvas._healTimer);
      raf = 0;
      canvas._healRaf = 0;
      canvas._healTimer = 0;
    };

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      for (let i = 0; i < src.length; i += 4) {
        const a = src[i + 3];
        if (!a) {
          out[i] = 0;
          out[i + 1] = 0;
          out[i + 2] = 0;
          out[i + 3] = 0;
          continue;
        }
        const r = src[i];
        const g = src[i + 1];
        const b = src[i + 2];
        const lum = (r * 0.32 + g * 0.5 + b * 0.18) / 255;
        const darkness = 1 - lum;
        const delay = 0.08 + darkness * 0.58;
        const span = Math.max(0.28, 1 - delay * 0.5);
        let local = (t - delay) / span;
        if (local < 0) local = 0;
        else if (local > 1) local = 1;
        const p = local * local * (3 - 2 * local);
        const earlyR = r * 0.42 + 228 * 0.58;
        const earlyG = g * 0.38 + 188 * 0.62;
        const earlyB = b * 0.28 + 152 * 0.72;
        const deepen = 1 - darkness * 0.34 * p * p;
        out[i] = Math.max(0, Math.min(255, (earlyR + (r - earlyR) * p) * deepen));
        out[i + 1] = Math.max(0, Math.min(255, (earlyG + (g - earlyG) * p) * deepen));
        out[i + 2] = Math.max(0, Math.min(255, (earlyB + (b - earlyB) * p) * deepen));
        out[i + 3] = Math.round(a * (0.05 + 0.95 * p));
      }
      ctx.putImageData(frame, 0, 0);
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        const remain = Math.max(400, yellowWait - (performance.now() - start));
        canvas._healTimer = setTimeout(() => {
          canvas._healTimer = 0;
          startYellowFade(canvas, ctx, final);
        }, remain);
      }
    };

    raf = requestAnimationFrame(tick);
    canvas._stopDevelop = stopAll;
  }

  function placeBruise(layer, bruise, x, y) {
    const rotation = randomBetween(-18, 18);
    const wrap = document.createElement("div");
    wrap.className = "bruise-wrap";
    wrap.style.setProperty("--bruise-rot", `${rotation}deg`);
    wrap.style.setProperty("--bruise-opacity", randomBetween(0.7, 0.86).toFixed(2));
    wrap.style.setProperty("--bruise-in", `${randomBetween(4.4, 6.2).toFixed(2)}s`);
    Object.assign(wrap.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${bruise.width}px`,
      height: `${bruise.height}px`
    });
    bruise.className = "bruise placed-bruise";
    bruise.style.setProperty("--bruise-opacity", wrap.style.getPropertyValue("--bruise-opacity"));
    bruise.style.setProperty("--bruise-in", wrap.style.getPropertyValue("--bruise-in"));
    wrap.appendChild(bruise);
    layer.appendChild(wrap);
    startDevelopment(bruise);
  }

  function loadSources() {
    const tasks = BRUISE_FILES.map((path) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth ? prepareSource(img) : null);
      img.onerror = () => resolve(null);
      img.src = encodeURI(path);
    }));
    return Promise.all(tasks).then((list) => {
      const sources = list.filter(Boolean);
      console.info(sources.length
        ? `Random bruise generator ready: ${sources.length} isolated marks.`
        : "No isolated bruise marks loaded.");
      return sources;
    });
  }

  function start() {
    const world = document.querySelector("#skin-world");
    const layer = document.querySelector("#bruise-layer");
    const clearButton = document.querySelector("#clear-bruises");
    if (!world || !layer) return;
    if (world.dataset.bruiseClickReady === "true") return;
    world.dataset.bruiseClickReady = "true";
    layer.style.pointerEvents = "none";
    const sourcesReady = loadSources();

    world.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, textarea, select")) return;
      const worldRect = world.getBoundingClientRect();
      const x = event.clientX - worldRect.left + world.scrollLeft;
      const y = event.clientY - worldRect.top + world.scrollTop;
      sourcesReady.then((sources) => {
        if (!sources.length) return;
        placeBruise(layer, generateBruise(sources), x, y);
      });
    });

    if (clearButton) {
      clearButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        layer.querySelectorAll("canvas").forEach((mark) => {
          if (mark._stopDevelop) mark._stopDevelop();
        });
        layer.replaceChildren();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

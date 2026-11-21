(function (global) {
  'use strict';

  const ns = (global.GravityWatch = global.GravityWatch || {});

  const WATCH_THEMES = {
    tennis: {
      id: 'tennis',
      name: '网球',
      subtitle: 'Rubber Granule Court',
      accentColor: '#D6F52E',
      isLuxury: false,
      liteCount: 8,
      cinematicCount: 13,
      promptCount: 28
    },
    diamond: {
      id: 'diamond',
      name: '钻石',
      subtitle: 'Velvet Cushion',
      accentColor: '#A8EEFF',
      isLuxury: true,
      liteCount: 9,
      cinematicCount: 13,
      promptCount: 24
    },
    basketball: {
      id: 'basketball',
      name: '篮球',
      subtitle: 'Hardwood Court',
      accentColor: '#FF8529',
      isLuxury: false,
      liteCount: 8,
      cinematicCount: 12,
      promptCount: 26
    },
    goldBar: {
      id: 'goldBar',
      name: '金条',
      subtitle: 'Bullion Vault',
      accentColor: '#FFD65A',
      isLuxury: true,
      liteCount: 8,
      cinematicCount: 11,
      promptCount: 20
    },
    soccer: {
      id: 'soccer',
      name: '足球',
      subtitle: 'Grass Pitch',
      accentColor: '#98F568',
      isLuxury: false,
      liteCount: 8,
      cinematicCount: 13,
      promptCount: 28
    }
  };

  const THEME_ORDER = ['tennis', 'diamond', 'basketball', 'goldBar', 'soccer'];

  const VELVET_PRESETS = {
    obsidian: {
      id: 'obsidian',
      label: '玄黑天鹅绒 (Obsidian Black)',
      core: [0.0012, 0.0014, 0.0024],
      mid: [0.0075, 0.0085, 0.0135],
      sheen: [0.095, 0.105, 0.14],
      rim: [0.14, 0.155, 0.2]
    },
    burgundy: {
      id: 'burgundy',
      label: '高定酒红丝绒 (Velour Burgundy)',
      core: [0.006, 0.0003, 0.001],
      mid: [0.042, 0.0022, 0.0065],
      sheen: [0.24, 0.022, 0.052],
      rim: [0.34, 0.045, 0.088]
    },
    sapphire: {
      id: 'sapphire',
      label: '皇家午夜蓝丝绒 (Royal Sapphire)',
      core: [0.0008, 0.0022, 0.0085],
      mid: [0.0055, 0.016, 0.055],
      sheen: [0.045, 0.11, 0.28],
      rim: [0.085, 0.18, 0.4]
    },
    emerald: {
      id: 'emerald',
      label: '帝王祖母绿丝绒 (Emerald Velvet)',
      core: [0.0006, 0.0045, 0.0022],
      mid: [0.004, 0.032, 0.016],
      sheen: [0.035, 0.16, 0.088],
      rim: [0.075, 0.25, 0.14]
    }
  };

  let currentVelvetPresetId = 'obsidian';

  const HDRI_FILES = {
    studio09: 'assets/hdr/studio_small_09_1k.hdr',
    studio08: 'assets/hdr/studio_small_08_1k.hdr'
  };

  const photoAssets = {};
  let photoReady = false;
  let photoLoadingPromise = null;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function toSRGBTexture(canvas, wrapRepeatX, wrapRepeatY) {
    const tex = new THREE.CanvasTexture(canvas);
    if ('SRGBColorSpace' in THREE) {
      tex.colorSpace = THREE.SRGBColorSpace;
    } else {
      tex.encoding = THREE.sRGBEncoding;
    }
    tex.anisotropy = 4;
    if (wrapRepeatX || wrapRepeatY) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      if (wrapRepeatX && wrapRepeatY) tex.repeat.set(wrapRepeatX, wrapRepeatY);
    }
    tex.needsUpdate = true;
    return tex;
  }

  function toDataTexture(canvas, wrapRepeatX, wrapRepeatY) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    if (wrapRepeatX || wrapRepeatY) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      if (wrapRepeatX && wrapRepeatY) tex.repeat.set(wrapRepeatX, wrapRepeatY);
    }
    tex.needsUpdate = true;
    return tex;
  }

  function loadImageSafe(url) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = url;
    });
  }

  function drawTiledImage(ctx, img, w, h, rx, ry) {
    const tileW = w / rx;
    const tileH = h / ry;
    const cols = Math.ceil(rx);
    const rows = Math.ceil(ry);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        ctx.drawImage(img, x * tileW, y * tileH, tileW + 0.5, tileH + 0.5);
      }
    }
  }

  function sampleTiledImageData(img, w, h, rx, ry) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    drawTiledImage(ctx, img, w, h, rx, ry);
    return ctx.getImageData(0, 0, w, h);
  }

  function blendNormalTexturesData(baseData, detailData, strength, w, h, wrapX) {
    const out = new Uint8Array(w * h * 4);
    const b = baseData.data;
    const d = detailData ? detailData.data : null;

    for (let i = 0; i < w * h; i += 1) {
      const idx = i * 4;
      let nx = (b[idx] / 255) * 2 - 1;
      let ny = (b[idx + 1] / 255) * 2 - 1;
      let nz = Math.max(0.05, (b[idx + 2] / 255) * 2 - 1);

      if (d) {
        const dx = ((d[idx] / 255) * 2 - 1) * strength;
        const dy = ((d[idx + 1] / 255) * 2 - 1) * strength;
        const dz = Math.max(0.2, (d[idx + 2] / 255) * 2 - 1);
        nx += dx;
        ny += dy;
        nz *= dz;
      }

      const invLen = 1.0 / (Math.hypot(nx, ny, nz) || 1);
      out[idx] = Math.round((nx * invLen * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }

    const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
    tex.wrapS = wrapX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  function buildNormalDataFromHeight(height, w, h, strength, wrapX) {
    const data = new Uint8ClampedArray(w * h * 4);

    function sample(x, y) {
      const sx = wrapX ? ((x % w) + w) % w : Math.max(0, Math.min(w - 1, x));
      const sy = Math.max(0, Math.min(h - 1, y));
      return height[sy * w + sx];
    }

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const tl = sample(x - 1, y - 1);
        const tc = sample(x, y - 1);
        const tr = sample(x + 1, y - 1);
        const ml = sample(x - 1, y);
        const mr = sample(x + 1, y);
        const bl = sample(x - 1, y + 1);
        const bc = sample(x, y + 1);
        const br = sample(x + 1, y + 1);

        const dX = tr + 2 * mr + br - (tl + 2 * ml + bl);
        const dY = bl + 2 * bc + br - (tl + 2 * tc + tr);

        let nx = -dX * strength;
        let ny = -dY * strength;
        let nz = 1.0;
        const invLen = 1.0 / Math.hypot(nx, ny, nz);
        nx *= invLen;
        ny *= invLen;
        nz *= invLen;

        const idx = (y * w + x) * 4;
        data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }
    return { data: data };
  }

  function buildNormalTextureFromHeight(height, w, h, strength, wrapX, detailImgData, detailStrength) {
    const baseData = buildNormalDataFromHeight(height, w, h, strength, wrapX);
    return blendNormalTexturesData(baseData, detailImgData, detailStrength || 0.45, w, h, wrapX);
  }

  function buildRoughnessTextureFromArray(rough, w, h, wrapX, detailImgData, weight, blueChannelArray) {
    const data = new Uint8Array(w * h * 4);
    const d = detailImgData ? detailImgData.data : null;
    const wgt = weight || 0.3;

    for (let i = 0; i < w * h; i += 1) {
      let rv = rough[i];
      if (d) {
        const dr = d[i * 4] / 255;
        rv = rv * (1.0 - wgt) + dr * wgt;
      }
      const val = Math.max(0, Math.min(255, Math.round(rv * 255)));
      const bVal = blueChannelArray
        ? Math.max(0, Math.min(255, Math.round(blueChannelArray[i] * 255)))
        : val;
      const idx = i * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = bVal;
      data[idx + 3] = 255;
    }

    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.wrapS = wrapX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  /* =========================================================
     1. Floating-Point Procedural Studio HDRI + CC0 RGBELoader
     ========================================================= */
  function createStudioEnvMap(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const w = 512;
    const h = 256;
    const hdr = new Float32Array(w * h * 4);

    // Photographer strip-box softboxes + razor rim ribbons separated by dark negative-fill bands
    // so brushed titanium, 999.9 bullion, sapphire bevels & BVH diamond facets catch crisp studio panels
    const panels = [
      { lon: -0.42, lat: 0.96, rx: 0.54, ry: 0.12, r: 8.4, g: 8.0, b: 7.1 },
      { lon: -1.78, lat: 0.34, rx: 0.13, ry: 0.74, r: 7.8, g: 6.4, b: 4.5 },
      { lon: 1.72, lat: 0.18, rx: 0.12, ry: 0.70, r: 4.8, g: 6.1, b: 8.2 },
      { lon: 0.42, lat: -0.82, rx: 0.48, ry: 0.12, r: 2.3, g: 1.9, b: 1.3 },
      { lon: 0.78, lat: 0.64, rx: 0.07, ry: 0.07, r: 17.5, g: 17.2, b: 16.5 },
      { lon: -1.08, lat: 0.58, rx: 0.065, ry: 0.065, r: 15.5, g: 14.2, b: 12.6 },
      { lon: 2.42, lat: 0.48, rx: 0.08, ry: 0.08, r: 12.5, g: 13.8, b: 16.2 }
    ];

    for (let y = 0; y < h; y += 1) {
      const lat = (0.5 - y / h) * Math.PI;
      for (let x = 0; x < w; x += 1) {
        const lon = (x / w - 0.5) * Math.PI * 2;
        const grad = Math.max(0, lat / (Math.PI * 0.5));
        let r = 0.012 + grad * 0.024;
        let g = 0.014 + grad * 0.028;
        let b = 0.018 + grad * 0.036;

        for (let p = 0; p < panels.length; p += 1) {
          const panel = panels[p];
          let dLon = lon - panel.lon;
          if (dLon > Math.PI) dLon -= Math.PI * 2;
          if (dLon < -Math.PI) dLon += Math.PI * 2;
          const dLat = lat - panel.lat;
          const normDist = Math.hypot(dLon / panel.rx, dLat / panel.ry);
          if (normDist < 1.0) {
            const falloff = Math.pow(1.0 - normDist * normDist, 2.2);
            r += panel.r * falloff;
            g += panel.g * falloff;
            b += panel.b * falloff;
          }
        }

        const idx = (y * w + x) * 4;
        hdr[idx] = r;
        hdr[idx + 1] = g;
        hdr[idx + 2] = b;
        hdr[idx + 3] = 1.0;
      }
    }

    const canFloatLinear =
      Boolean(renderer.extensions.get('OES_texture_float_linear')) ||
      renderer.capabilities.isWebGL2;

    const equirect = new THREE.DataTexture(hdr, w, h, THREE.RGBAFormat, THREE.FloatType);
    equirect.mapping = THREE.EquirectangularReflectionMapping;
    equirect.wrapS = THREE.RepeatWrapping;
    equirect.wrapT = THREE.ClampToEdgeWrapping;
    equirect.minFilter = canFloatLinear ? THREE.LinearFilter : THREE.NearestFilter;
    equirect.magFilter = canFloatLinear ? THREE.LinearFilter : THREE.NearestFilter;
    equirect.needsUpdate = true;

    const rt = pmrem.fromEquirectangular(equirect);
    rt.texture.userData = rt.texture.userData || {};
    rt.texture.userData.equirectTex = equirect;
    pmrem.dispose();
    return rt.texture;
  }

  /* =========================================================
     2. Photorealistic Court & Vault Floors (Web CC0 + Procedural)
     ========================================================= */
  function buildClayCourtMaps() {
    // 1024x1248 Cushioned Acrylic / EPDM Rubber-Granule Tennis Court (zero loose dust, tactile rubber pebble relief)
    const w = 1024;
    const h = 1248;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');

    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 180, w * 0.5, h * 0.5, w * 0.92);
    bgGrad.addColorStop(0, '#14331C');
    bgGrad.addColorStop(1, '#050F08');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Recalibrated for 1.5x extended parallax floor (6.00 x 7.32)
    const padX = w * 0.225;
    const padY = h * 0.185;
    const cw = w - padX * 2;
    const ch = h - padY * 2;

    const courtGrad = ctx.createLinearGradient(0, padY, 0, padY + ch);
    courtGrad.addColorStop(0, '#8E3824');
    courtGrad.addColorStop(0.5, '#7B2E1D');
    courtGrad.addColorStop(1, '#662416');
    ctx.fillStyle = courtGrad;
    ctx.fillRect(padX, padY, cw, ch);

    // Subtle real rubber surface photographic macro-variation across whole cushioned mat
    if (photoAssets.rubberDiff) {
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.globalCompositeOperation = 'soft-light';
      drawTiledImage(ctx, photoAssets.rubberDiff, w, h, 8, 9.6);
      ctx.restore();
    }

    // Faint squeegee acrylic cushion-coat application bands (authentic multi-coat sports surface)
    ctx.save();
    for (let y = 0; y < h; y += 16) {
      ctx.fillStyle = y % 32 === 0 ? 'rgba(255, 236, 226, 0.012)' : 'rgba(6, 4, 4, 0.014)';
      ctx.fillRect(0, y, w, 8);
    }
    ctx.restore();

    // Refined fine-grain EPDM rubber & silica micro-granule speckles (delicate tournament court finish, baked once)
    for (let i = 0; i < 22000; i += 1) {
      const gx = Math.random() * w;
      const gy = Math.random() * h;
      const inCourt = gx >= padX && gx <= padX + cw && gy >= padY && gy <= padY + ch;
      const sz = i % 6 === 0 ? 1.5 : 1.05;
      const kind = i % 6;
      if (inCourt) {
        if (kind === 0) ctx.fillStyle = 'rgba(34, 14, 10, 0.10)';
        else if (kind === 1) ctx.fillStyle = 'rgba(218, 140, 114, 0.08)';
        else if (kind === 2) ctx.fillStyle = 'rgba(72, 24, 14, 0.09)';
        else ctx.fillStyle = 'rgba(170, 78, 52, 0.07)';
      } else {
        if (kind === 0) ctx.fillStyle = 'rgba(4, 12, 6, 0.11)';
        else if (kind === 1) ctx.fillStyle = 'rgba(64, 128, 76, 0.07)';
        else ctx.fillStyle = 'rgba(16, 48, 24, 0.09)';
      }
      ctx.fillRect(gx, gy, sz, sz);
    }

    // Crisp acrylic painted court lines conforming tightly over the rubber-granule substrate
    ctx.strokeStyle = 'rgba(226, 228, 222, 0.86)';
    ctx.lineWidth = 4.2;
    ctx.strokeRect(padX, padY, cw, ch);

    const singlesInset = cw * 0.135;
    ctx.beginPath();
    ctx.moveTo(padX + singlesInset, padY);
    ctx.lineTo(padX + singlesInset, padY + ch);
    ctx.moveTo(padX + cw - singlesInset, padY);
    ctx.lineTo(padX + cw - singlesInset, padY + ch);

    const topServiceY = padY + ch * 0.235;
    const botServiceY = padY + ch * 0.765;
    ctx.moveTo(padX + singlesInset, topServiceY);
    ctx.lineTo(padX + cw - singlesInset, topServiceY);
    ctx.moveTo(padX + singlesInset, botServiceY);
    ctx.lineTo(padX + cw - singlesInset, botServiceY);
    ctx.moveTo(w * 0.5, topServiceY);
    ctx.lineTo(w * 0.5, botServiceY);
    ctx.moveTo(w * 0.5, padY);
    ctx.lineTo(w * 0.5, padY + 12);
    ctx.moveTo(w * 0.5, padY + ch - 12);
    ctx.lineTo(w * 0.5, padY + ch);
    ctx.stroke();

    // Subtle net shadow & white net tape across court center
    ctx.strokeStyle = 'rgba(10, 6, 4, 0.34)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(padX - 14, h * 0.5 + 4);
    ctx.lineTo(padX + cw + 14, h * 0.5 + 4);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(228, 228, 222, 0.50)';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(padX - 14, h * 0.5);
    ctx.lineTo(padX + cw + 14, h * 0.5);
    ctx.stroke();

    // Build refined fine-grained cushioned EPDM rubber height, normal & matte-satin roughness maps
    const nw = 512;
    const nh = 624;
    const height = new Float32Array(nw * nh);
    const rough = new Float32Array(nw * nh);

    // Scatter fine rounded micro-pellets tightly sealed under smooth pigmented acrylic coat (baked once -> 0 runtime Voronoi cost)
    height.fill(0.42);
    const pelletCount = 20000;
    for (let i = 0; i < pelletCount; i += 1) {
      const cx = Math.random() * nw;
      const cy = Math.random() * nh;
      const rad = i % 4 === 0 ? 1.3 : 0.92;
      const peak = 0.18 + Math.random() * 0.20;
      const rInt = Math.ceil(rad);
      const x0 = Math.max(0, Math.floor(cx - rInt));
      const x1 = Math.min(nw - 1, Math.ceil(cx + rInt));
      const y0 = Math.max(0, Math.floor(cy - rInt));
      const y1 = Math.min(nh - 1, Math.ceil(cy + rInt));
      const invR2 = 1.0 / (rad * rad);
      for (let py = y0; py <= y1; py += 1) {
        const dy = py - cy;
        const dy2 = dy * dy;
        const rowOff = py * nw;
        for (let px = x0; px <= x1; px += 1) {
          const dx = px - cx;
          const d2 = (dx * dx + dy2) * invR2;
          if (d2 < 1.0) {
            const dome = 0.42 + Math.sqrt(1.0 - d2) * peak;
            const pIdx = rowOff + px;
            if (dome > height[pIdx]) height[pIdx] = dome;
          }
        }
      }
    }

    // Subtle fine silica texture + refined velvety-matte cushion roughness [0.70 crown .. 0.92 valley]
    for (let y = 0; y < nh; y += 1) {
      const ny = y / nh;
      const nearBaseTop = Math.exp(-Math.pow((ny - 0.22) * 7.5, 2));
      const nearBaseBot = Math.exp(-Math.pow((ny - 0.78) * 7.5, 2));
      const wearPol = (nearBaseTop + nearBaseBot) * 0.06;
      const rowOff = y * nw;
      for (let x = 0; x < nw; x += 1) {
        const pIdx = rowOff + x;
        const grit = (Math.random() - 0.5) * 0.065;
        const hVal = Math.max(0, Math.min(1, height[pIdx] + grit));
        height[pIdx] = hVal;
        rough[pIdx] = Math.max(0.70, Math.min(0.92, 0.88 - (hVal - 0.42) * 0.28 - wearPol));
      }
    }

    const rubberNor = photoAssets.rubberNor ? sampleTiledImageData(photoAssets.rubberNor, nw, nh, 12, 14) : null;
    const rubberRough = photoAssets.rubberRough ? sampleTiledImageData(photoAssets.rubberRough, nw, nh, 12, 14) : null;

    return {
      map: toSRGBTexture(c),
      normalMap: buildNormalTextureFromHeight(height, nw, nh, 1.85, false, rubberNor, 0.34),
      roughnessMap: buildRoughnessTextureFromArray(rough, nw, nh, false, rubberRough, 0.18)
    };
  }

  function buildHardwoodCourtMaps() {
    const w = 1024;
    const h = 1248;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');

    const roughC = makeCanvas(w, h);
    const rCtx = roughC.getContext('2d');

    const mapleD = photoAssets.mapleDiff || photoAssets.woodDiff;
    const mapleR = photoAssets.mapleRough || photoAssets.woodRough;
    const mapleN = photoAssets.mapleNor || photoAssets.woodNor;

    if (mapleD && mapleR) {
      drawTiledImage(ctx, mapleD, w, h, 2, 2.4);
      // Warm translucent honey polyurethane varnish glaze preserving real WoodFloor051 maple planks
      ctx.fillStyle = 'rgba(225, 152, 58, 0.11)';
      ctx.fillRect(0, 0, w, h);

      drawTiledImage(rCtx, mapleR, w, h, 2, 2.4);
      rCtx.fillStyle = 'rgba(72, 72, 72, 0.52)';
      rCtx.fillRect(0, 0, w, h);
    } else {
      const plankW = 24;
      for (let x = 0; x < w; x += plankW) {
        const shade = 22 + Math.floor(Math.random() * 18);
        ctx.fillStyle = 'rgb(' + (shade + 32) + ',' + (shade + 12) + ',' + shade + ')';
        ctx.fillRect(x, 0, plankW - 1, h);

        for (let s = 0; s < 10; s += 1) {
          const sx = x + 2 + Math.random() * (plankW - 5);
          ctx.fillStyle = s % 2 === 0 ? 'rgba(92, 48, 18, 0.26)' : 'rgba(12, 5, 2, 0.24)';
          ctx.fillRect(sx, 0, 1.5, h);
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(x + plankW - 1, 0, 1.5, h);

        let y = (x * 7) % 140;
        while (y < h) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
          ctx.fillRect(x, y, plankW, 1.8);
          y += 140 + ((x * 13) % 70);
        }

        const pRough = 46 + ((x * 11) % 24);
        rCtx.fillStyle = 'rgb(' + pRough + ',' + pRough + ',' + pRough + ')';
        rCtx.fillRect(x, 0, plankW - 1, h);
        rCtx.fillStyle = 'rgb(170, 170, 170)';
        rCtx.fillRect(x + plankW - 1, 0, 1.5, h);
      }
    }

    const floorSpot = ctx.createRadialGradient(w * 0.5, h * 0.54, 60, w * 0.5, h * 0.54, w * 0.78);
    floorSpot.addColorStop(0, 'rgba(145, 78, 22, 0.10)');
    floorSpot.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
    ctx.fillStyle = floorSpot;
    ctx.fillRect(0, 0, w, h);

    // Crisp white basketball half-court lines framed for 1.5x parallax floor
    const drawLines = function (targetCtx) {
      const courtPadX = w * 0.2;
      const baseLineY = h * 0.81;
      const hoopY = baseLineY - 40;
      const topLineY = h * 0.19;

      targetCtx.strokeRect(courtPadX, topLineY, w - courtPadX * 2, baseLineY - topLineY);

      const keyW = w * 0.19;
      const keyH = h * 0.22;
      const keyX = (w - keyW) * 0.5;
      const keyTopY = baseLineY - keyH;
      targetCtx.strokeRect(keyX, keyTopY, keyW, keyH);

      targetCtx.beginPath();
      targetCtx.arc(w * 0.5, keyTopY, keyW * 0.5, Math.PI, Math.PI * 2);
      targetCtx.stroke();

      targetCtx.save();
      targetCtx.setLineDash([10, 10]);
      targetCtx.beginPath();
      targetCtx.arc(w * 0.5, keyTopY, keyW * 0.5, 0, Math.PI);
      targetCtx.stroke();
      targetCtx.restore();

      const threeRadius = w * 0.25;
      const cornerXLeft = w * 0.5 - threeRadius;
      const cornerXRight = w * 0.5 + threeRadius;
      const cornerStraightTopY = hoopY - 44;

      targetCtx.beginPath();
      targetCtx.moveTo(cornerXLeft, baseLineY);
      targetCtx.lineTo(cornerXLeft, cornerStraightTopY);
      targetCtx.arc(w * 0.5, hoopY, threeRadius, Math.PI, Math.PI * 2);
      targetCtx.lineTo(cornerXRight, baseLineY);
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.arc(w * 0.5, hoopY, 38, Math.PI, Math.PI * 2);
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.moveTo(w * 0.5 - 28, baseLineY - 24);
      targetCtx.lineTo(w * 0.5 + 28, baseLineY - 24);
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.arc(w * 0.5, hoopY, 10, 0, Math.PI * 2);
      targetCtx.stroke();
    };

    ctx.strokeStyle = 'rgba(242, 242, 238, 0.90)';
    ctx.lineWidth = 3.8;
    drawLines(ctx);

    // Matte court paint lines in roughness map vs glossy maple planks
    rCtx.strokeStyle = 'rgb(156, 156, 156)';
    rCtx.lineWidth = 4.2;
    drawLines(rCtx);

    let normalMap;
    if (mapleN) {
      const norC = makeCanvas(w, h);
      drawTiledImage(norC.getContext('2d'), mapleN, w, h, 2, 2.4);
      normalMap = toDataTexture(norC);
    } else {
      const nw = 512;
      const nh = 624;
      const height = new Float32Array(nw * nh);
      for (let y = 0; y < nh; y += 1) {
        for (let x = 0; x < nw; x += 1) {
          const seam = x % 16 === 0 ? -0.35 : 0;
          const grain = Math.sin(x * 1.4 + y * 0.04) * 0.04;
          height[y * nw + x] = 0.5 + seam + grain;
        }
      }
      normalMap = buildNormalTextureFromHeight(height, nw, nh, 1.25, false);
    }

    return {
      map: toSRGBTexture(c),
      normalMap: normalMap,
      roughnessMap: toDataTexture(roughC)
    };
  }

  function buildSoccerPitchMaps() {
    // Rich dark stadium loam soil + short rootbed thatch beneath 16,200 real 3D instanced grass blades,
    // plus a crisp dedicated chalk lineMask sampled by each 3D grass blade for painted white chalk tips.
    const w = 1024;
    const h = 1248;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const roughC = makeCanvas(w, h);
    const rCtx = roughC.getContext('2d');
    const lineMaskC = makeCanvas(w, h);
    const lmCtx = lineMaskC.getContext('2d');

    if (photoAssets.grassDiff) {
      drawTiledImage(ctx, photoAssets.grassDiff, w, h, 4, 4.8);
      ctx.fillStyle = 'rgba(14, 34, 8, 0.62)';
      ctx.fillRect(0, 0, w, h);

      const stripeCount = 14;
      const stripeH = h / stripeCount;
      for (let i = 0; i < stripeCount; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(64, 126, 28, 0.16)' : 'rgba(6, 16, 3, 0.28)';
        ctx.fillRect(0, i * stripeH, w, stripeH);
      }
    } else {
      const stripeCount = 14;
      const stripeH = h / stripeCount;
      for (let i = 0; i < stripeCount; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? '#1E3A0F' : '#152A0A';
        ctx.fillRect(0, i * stripeH, w, stripeH);
      }
    }

    // Organic dark topsoil loam crumbs & root thatch exposed whenever 3D grass blades part under a ball
    for (let i = 0; i < 10000; i += 1) {
      const gx = Math.random() * w;
      const gy = Math.random() * h;
      const kind = i % 5;
      if (kind === 0) ctx.fillStyle = 'rgba(42, 31, 18, 0.32)';
      else if (kind === 1) ctx.fillStyle = 'rgba(16, 12, 6, 0.38)';
      else if (kind === 2) ctx.fillStyle = 'rgba(72, 114, 32, 0.16)';
      else ctx.fillStyle = 'rgba(24, 42, 10, 0.24)';
      ctx.fillRect(gx, gy, 2.5, 2.5);
    }

    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, 160, w * 0.5, h * 0.5, w * 0.92);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Draw stadium pitch markings onto BOTH soil base and dedicated chalk lineMask for 3D grass blades
    lmCtx.fillStyle = '#000000';
    lmCtx.fillRect(0, 0, w, h);

    const drawPitchMarkings = function (targetCtx, strokeCol, fillCol, lineW) {
      targetCtx.strokeStyle = strokeCol;
      targetCtx.fillStyle = fillCol;
      targetCtx.lineWidth = lineW;

      const padX = w * 0.2;
      const topY = h * 0.2;
      const botY = h * 0.82;
      const pw = w - padX * 2;
      targetCtx.strokeRect(padX, topY, pw, botY - topY);

      targetCtx.beginPath();
      targetCtx.arc(w * 0.5, topY, w * 0.11, 0, Math.PI);
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.arc(w * 0.5, topY, 6, 0, Math.PI * 2);
      targetCtx.fill();

      const boxW = pw * 0.62;
      const boxH = h * 0.17;
      const boxX = (w - boxW) * 0.5;
      targetCtx.strokeRect(boxX, botY - boxH, boxW, boxH);

      const goalW = pw * 0.28;
      const goalH = h * 0.06;
      targetCtx.strokeRect((w - goalW) * 0.5, botY - goalH, goalW, goalH);

      const penSpotY = botY - h * 0.115;
      targetCtx.beginPath();
      targetCtx.arc(w * 0.5, penSpotY, 5.5, 0, Math.PI * 2);
      targetCtx.fill();

      targetCtx.beginPath();
      targetCtx.arc(w * 0.5, penSpotY, w * 0.1, Math.PI * 1.18, Math.PI * 1.82);
      targetCtx.stroke();
    };

    drawPitchMarkings(ctx, 'rgba(232, 238, 228, 0.84)', 'rgba(232, 238, 228, 0.84)', 4.2);
    // Slightly wider chalk spray on 3D blade mask so chalk-painted blades read crisply across gaps
    drawPitchMarkings(lmCtx, '#FFFFFF', '#FFFFFF', 6.4);

    let normalMap;
    let roughnessMap;
    if (photoAssets.grassNor && photoAssets.grassRough) {
      const norC = makeCanvas(w, h);
      drawTiledImage(norC.getContext('2d'), photoAssets.grassNor, w, h, 4, 4.8);
      normalMap = toDataTexture(norC);

      drawTiledImage(rCtx, photoAssets.grassRough, w, h, 4, 4.8);
      const stripeCount = 14;
      const stripeH = h / stripeCount;
      for (let i = 0; i < stripeCount; i += 1) {
        rCtx.fillStyle = i % 2 === 0 ? 'rgba(200, 200, 200, 0.18)' : 'rgba(248, 248, 248, 0.28)';
        rCtx.fillRect(0, i * stripeH, w, stripeH);
      }
      roughnessMap = toDataTexture(roughC);
    } else {
      const nw = 512;
      const nh = 624;
      const height = new Float32Array(nw * nh);
      const rough = new Float32Array(nw * nh);
      const stripeCount = 14;
      for (let y = 0; y < nh; y += 1) {
        const stripeIdx = Math.floor((y / nh) * stripeCount);
        const stripeR = stripeIdx % 2 === 0 ? 0.84 : 0.94;
        for (let x = 0; x < nw; x += 1) {
          const i = y * nw + x;
          height[i] = 0.5 + (Math.random() - 0.5) * 0.36;
          rough[i] = Math.min(1.0, stripeR + Math.random() * 0.08);
        }
      }
      normalMap = buildNormalTextureFromHeight(height, nw, nh, 1.6, false);
      roughnessMap = buildRoughnessTextureFromArray(rough, nw, nh, false);
    }

    return {
      map: toSRGBTexture(c),
      normalMap: normalMap,
      roughnessMap: roughnessMap,
      lineMask: toDataTexture(lineMaskC)
    };
  }

  function buildObsidianVaultMaps() {
    // 1024x1248 Honed Nero Marquina Black Marble & Vault Stone Floor for 04 金条
    const w = 1024;
    const h = 1248;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rC = makeCanvas(w, h);
    const rCtx = rC.getContext('2d');

    const mDiff = photoAssets.marbleDiff || photoAssets.metalDiff;
    const mRough = photoAssets.marbleRough || photoAssets.metalRough;
    const mNor = photoAssets.marbleNor || photoAssets.metalNor;

    ctx.fillStyle = '#06080D';
    ctx.fillRect(0, 0, w, h);

    if (mDiff) {
      ctx.save();
      if ('filter' in ctx) {
        ctx.filter = 'grayscale(0.88) contrast(1.18)';
      }
      ctx.globalAlpha = 0.34;
      drawTiledImage(ctx, mDiff, w, h, 2, 2.4);
      ctx.filter = 'none';
      ctx.restore();
    } else {
      for (let i = 0; i < 3600; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(210, 224, 248, 0.028)' : 'rgba(2, 4, 8, 0.045)';
        ctx.fillRect(Math.random() * w * 0.35, Math.random() * h, w * 0.65, 1.2);
      }
    }

    const edgeVig = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.28, w * 0.5, h * 0.5, w * 0.88);
    edgeVig.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
    edgeVig.addColorStop(1, 'rgba(0, 0, 0, 0.50)');
    ctx.fillStyle = edgeVig;
    ctx.fillRect(0, 0, w, h);

    // Subtle architectural vault framing bevel & CNC chamfer groove around interior perimeter
    const insetX = w * 0.21;
    const insetY = h * 0.17;
    const frameW = w - insetX * 2;
    const frameH = h - insetY * 2;

    ctx.strokeStyle = 'rgba(4, 5, 8, 0.78)';
    ctx.lineWidth = 7;
    ctx.strokeRect(insetX, insetY, frameW, frameH);
    ctx.strokeStyle = 'rgba(130, 146, 178, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(insetX + 6, insetY + 6, frameW - 12, frameH - 12);

    // Honed stone marble roughness [0.32..0.54]: crisp stone micro-variation, never chrome mirror
    rCtx.fillStyle = 'rgb(88, 88, 88)';
    rCtx.fillRect(0, 0, w, h);
    if (mRough) {
      rCtx.save();
      rCtx.globalAlpha = 0.34;
      drawTiledImage(rCtx, mRough, w, h, 2, 2.4);
      rCtx.restore();
    }
    rCtx.strokeStyle = 'rgb(64, 64, 64)';
    rCtx.lineWidth = 4;
    rCtx.strokeRect(insetX + 6, insetY + 6, frameW - 12, frameH - 12);

    let normalMap;
    if (mNor) {
      const norC = makeCanvas(w, h);
      const nCtx = norC.getContext('2d');
      nCtx.fillStyle = 'rgb(128, 128, 255)';
      nCtx.fillRect(0, 0, w, h);
      nCtx.globalAlpha = 0.62;
      drawTiledImage(nCtx, mNor, w, h, 2, 2.4);
      nCtx.globalAlpha = 1.0;
      nCtx.strokeStyle = 'rgb(112, 112, 245)';
      nCtx.lineWidth = 5;
      nCtx.strokeRect(insetX, insetY, frameW, frameH);
      normalMap = toDataTexture(norC);
    } else {
      const nw = 512;
      const nh = 624;
      const height = new Float32Array(nw * nh);
      for (let y = 0; y < nh; y += 1) {
        const lathe = Math.sin(y * 0.55) * 0.03 + (Math.random() - 0.5) * 0.04;
        for (let x = 0; x < nw; x += 1) {
          height[y * nw + x] = 0.5 + lathe + (Math.random() - 0.5) * 0.025;
        }
      }
      normalMap = buildNormalTextureFromHeight(height, nw, nh, 0.9, false);
    }

    return {
      map: toSRGBTexture(c),
      normalMap: normalMap,
      roughnessMap: toDataTexture(rC)
    };
  }

  function evaluateVelvetDrape(u, v) {
    // Organic curved pinch-crease cloth drape: broad rounded velvet pillows + narrow deep fold creases
    const warpA = 0.095 * Math.sin(u * 4.2 - v * 3.1 + 0.55) + 0.045 * Math.cos(u * 7.8 + v * 4.9 - 0.8);
    const warpB = 0.08 * Math.cos(u * 3.6 + v * 4.4 - 0.4);
    const phase1 = (u * 1.05 - v * 0.86 + warpA) * Math.PI * 2.15 + 0.35;
    const phase2 = (u * 0.62 + v * 0.95 - warpB) * Math.PI * 1.65 + 1.05;

    // Power-shaped abs(sin) yields plush rounded velvet cushions separated by narrow dark pinch-creases
    const pillow1 = Math.pow(0.035 + 0.965 * Math.abs(Math.sin(phase1)), 0.52);
    const pillow2 = Math.pow(0.05 + 0.95 * Math.abs(Math.sin(phase2)), 0.58);
    const rCushion = Math.hypot((u - 0.5) * 1.55, (v - 0.5) * 1.55);
    const centerCrown = 0.14 * Math.cos(Math.min(Math.PI, rCushion * 1.45));
    const h = Math.max(0.0, Math.min(1.0, pillow1 * 0.62 + pillow2 * 0.28 + centerCrown));

    // Multi-scale crushed-velvet nap brush swirls
    const napAngle =
      1.9 * Math.sin(u * 4.8 + v * 3.4 + 0.5) +
      1.1 * Math.cos(u * 11.2 - v * 9.3 - 0.4);
    const napCloud = 0.5 + 0.32 * Math.sin(napAngle * 1.4) + 0.18 * Math.cos(u * 16.5 + v * 14.2);

    return {
      height: h,
      foldAO: 0.18 + 0.82 * h,
      napX: Math.cos(napAngle),
      napY: Math.sin(napAngle),
      napCloud: Math.max(0.12, Math.min(1.0, napCloud))
    };
  }

  function buildDiamondVelvetMaps(presetId) {
    const preset = VELVET_PRESETS[presetId] || VELVET_PRESETS.obsidian;

    // 1. Crisp diffuse/refraction map (512x624 -> 4x faster generation; procedural fiber detail added in shader)
    const dw = 512;
    const dh = 624;
    const diffC = makeCanvas(dw, dh);
    const dCtx = diffC.getContext('2d');
    const diffImg = dCtx.createImageData(dw, dh);
    const velvetDiffDiff = photoAssets.velvetDiff
      ? sampleTiledImageData(photoAssets.velvetDiff, dw, dh, 2.6, 3.1).data
      : null;

    for (let y = 0; y < dh; y += 1) {
      const vGl = 1.0 - y / (dh - 1);
      for (let x = 0; x < dw; x += 1) {
        const uGl = x / (dw - 1);
        const drape = evaluateVelvetDrape(uGl, vGl);
        const pIdx = y * dw + x;
        const idx = pIdx * 4;

        let patchTone = drape.napCloud;
        if (velvetDiffDiff) {
          const rawR = velvetDiffDiff[idx] / 255;
          const dev = Math.max(-0.32, Math.min(0.32, (rawR - 0.44) * 3.6));
          patchTone = Math.max(0.14, Math.min(1.0, drape.napCloud * 0.72 + 0.28 + dev));
        }

        // Grazing sheen accent along curved cushion shoulders for clear diamond internal refraction
        const shoulderBand = Math.pow(Math.max(0, 1.0 - Math.abs(drape.height - 0.66) * 2.8), 1.8);
        const sheenMix = shoulderBand * (0.22 + 0.55 * patchTone);
        const vigR = Math.hypot((uGl - 0.5) * 1.42, (vGl - 0.5) * 1.42);
        const vig = Math.max(0.18, 1.0 - vigR * 0.55);

        const bodyW = drape.foldAO * (0.45 + 0.78 * patchTone);
        let rLin =
          preset.core[0] + (preset.mid[0] - preset.core[0]) * bodyW + preset.sheen[0] * sheenMix * 0.36;
        let gLin =
          preset.core[1] + (preset.mid[1] - preset.core[1]) * bodyW + preset.sheen[1] * sheenMix * 0.36;
        let bLin =
          preset.core[2] + (preset.mid[2] - preset.core[2]) * bodyW + preset.sheen[2] * sheenMix * 0.36;

        rLin = Math.max(0, Math.min(1, rLin * vig));
        gLin = Math.max(0, Math.min(1, gLin * vig));
        bLin = Math.max(0, Math.min(1, bLin * vig));

        diffImg.data[idx] = Math.round(Math.pow(rLin, 1 / 2.2) * 255);
        diffImg.data[idx + 1] = Math.round(Math.pow(gLin, 1 / 2.2) * 255);
        diffImg.data[idx + 2] = Math.round(Math.pow(bLin, 1 / 2.2) * 255);
        diffImg.data[idx + 3] = 255;
      }
    }
    dCtx.putImageData(diffImg, 0, 0);

    // 2. Shader data & normal maps (512 x 624 DataTextures, vGl = y / (nh - 1))
    const nw = 512;
    const nh = 624;
    const heightArr = new Float32Array(nw * nh);
    const dataBuf = new Uint8Array(nw * nh * 4);
    const velvetDiffTile = photoAssets.velvetDiff
      ? sampleTiledImageData(photoAssets.velvetDiff, nw, nh, 2.6, 3.1).data
      : null;
    const velvetRoughTile = photoAssets.velvetRough
      ? sampleTiledImageData(photoAssets.velvetRough, nw, nh, 12.0, 14.4).data
      : null;
    const velvetNorRaw = photoAssets.velvetNor
      ? sampleTiledImageData(photoAssets.velvetNor, nw, nh, 12.0, 14.4).data
      : null;

    // Flip Canvas ImageData rows so DataTexture row y aligns identically with WebGL uv.y = y / (nh - 1)
    let flippedVelvetNorData = null;
    if (velvetNorRaw) {
      const flipped = new Uint8ClampedArray(nw * nh * 4);
      for (let y = 0; y < nh; y += 1) {
        const srcRow = (nh - 1 - y) * nw * 4;
        const dstRow = y * nw * 4;
        for (let x = 0; x < nw * 4; x += 1) {
          flipped[dstRow + x] = velvetNorRaw[srcRow + x];
        }
      }
      flippedVelvetNorData = { data: flipped };
    }

    for (let y = 0; y < nh; y += 1) {
      const vGl = y / (nh - 1);
      const srcY = nh - 1 - y;
      for (let x = 0; x < nw; x += 1) {
        const uGl = x / (nw - 1);
        const drape = evaluateVelvetDrape(uGl, vGl);
        const pIdx = y * nw + x;
        const idx = pIdx * 4;
        const srcIdx = (srcY * nw + x) * 4;

        const patchDev = velvetDiffTile
          ? Math.max(-0.32, Math.min(0.32, (velvetDiffTile[srcIdx] / 255 - 0.44) * 3.6))
          : 0.0;
        const microGrain = velvetRoughTile
          ? velvetRoughTile[srcIdx] / 255
          : 0.65 + Math.sin(uGl * 460 + vGl * 210) * Math.cos(uGl * 210 - vGl * 490) * 0.30;

        const combinedHeight = Math.max(
          0,
          Math.min(1, drape.height * 0.90 + patchDev * 0.06 + (microGrain - 0.5) * 0.04)
        );
        heightArr[pIdx] = combinedHeight;

        const fuzzIntensity = Math.max(
          0.10,
          Math.min(1.0, (drape.napCloud * 0.72 + 0.28 + patchDev) * (0.55 + 0.60 * microGrain))
        );

        dataBuf[idx] = Math.round(combinedHeight * 255);
        dataBuf[idx + 1] = Math.round((drape.napX * 0.5 + 0.5) * 255);
        dataBuf[idx + 2] = Math.round((drape.napY * 0.5 + 0.5) * 255);
        dataBuf[idx + 3] = Math.round(fuzzIntensity * 255);
      }
    }

    const normalMap = buildNormalTextureFromHeight(
      heightArr,
      nw,
      nh,
      2.45,
      false,
      flippedVelvetNorData,
      1.15
    );

    const dataTex = new THREE.DataTexture(dataBuf, nw, nh, THREE.RGBAFormat);
    dataTex.wrapS = THREE.ClampToEdgeWrapping;
    dataTex.wrapT = THREE.ClampToEdgeWrapping;
    dataTex.magFilter = THREE.LinearFilter;
    dataTex.minFilter = THREE.LinearMipmapLinearFilter;
    dataTex.generateMipmaps = true;
    dataTex.anisotropy = 4;
    dataTex.needsUpdate = true;

    return {
      map: toSRGBTexture(diffC),
      normalMap: normalMap,
      dataMap: dataTex,
      preset: preset
    };
  }

  /* =========================================================
     3. Photorealistic 3D Object PBR Maps (Web CC0 + Procedural)
     ========================================================= */
  function buildTennisBallMaps() {
    const w = 1024;
    const h = 512;
    const diffC = makeCanvas(w, h);
    const dCtx = diffC.getContext('2d');
    const dImg = dCtx.createImageData(w, h);

    const fDiffSrc = photoAssets.feltDiff;
    const fNorSrc = photoAssets.feltNor;
    const fRoughSrc = photoAssets.feltRough;
    const feltDiff = fDiffSrc ? sampleTiledImageData(fDiffSrc, w, h, 6, 3).data : null;
    const feltNor = fNorSrc ? sampleTiledImageData(fNorSrc, w, h, 6, 3) : null;
    const feltRough = fRoughSrc ? sampleTiledImageData(fRoughSrc, w, h, 6, 3) : null;

    let feltMean = 128;
    if (feltDiff) {
      let sum = 0;
      const totalPx = w * h;
      for (let i = 0; i < totalPx; i += 1) {
        const kIdx = i * 4;
        sum += feltDiff[kIdx] * 0.5 + feltDiff[kIdx + 1] * 0.5;
      }
      feltMean = sum / totalPx;
    }

    const height = new Float32Array(w * h);
    const rough = new Float32Array(w * h);
    const seamMask = new Float32Array(w * h);

    // Precompute closed tennis seam curve in flat Float32Arrays for 2-stage coarse-to-fine search
    const seamSamples = 200;
    const seamX = new Float32Array(seamSamples);
    const seamY = new Float32Array(seamSamples);
    const seamZ = new Float32Array(seamSamples);
    const k = 0.36;
    const norm = 1 + k;
    const cZ = 2 * Math.sqrt(k);
    for (let s = 0; s < seamSamples; s += 1) {
      const t = (s / seamSamples) * Math.PI * 2;
      seamX[s] = (Math.cos(t) + k * Math.cos(3 * t)) / norm;
      seamY[s] = (Math.sin(t) - k * Math.sin(3 * t)) / norm;
      seamZ[s] = (cZ * Math.sin(2 * t)) / norm;
    }

    const data = dImg.data;
    const coarseStep = 10;

    for (let y = 0; y < h; y += 1) {
      const lat = (0.5 - y / h) * Math.PI;
      const cosLat = Math.cos(lat);
      const ny = Math.sin(lat);
      const rowOff = y * w;

      for (let x = 0; x < w; x += 1) {
        const lon = (x / w - 0.5) * Math.PI * 2;
        const nx = cosLat * Math.cos(lon);
        const nz = cosLat * Math.sin(lon);

        // Coarse pass (20 samples) skips >80% of off-seam pixels in O(1)
        let minD2 = 99;
        let bestS = 0;
        for (let s = 0; s < seamSamples; s += coarseStep) {
          const dx = nx - seamX[s];
          const dy = ny - seamY[s];
          const dz = nz - seamZ[s];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < minD2) {
            minD2 = d2;
            bestS = s;
          }
        }
        if (minD2 < 0.085) {
          for (let off = -coarseStep; off <= coarseStep; off += 1) {
            let s = bestS + off;
            if (s < 0) s += seamSamples;
            else if (s >= seamSamples) s -= seamSamples;
            const dx = nx - seamX[s];
            const dy = ny - seamY[s];
            const dz = nz - seamZ[s];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < minD2) minD2 = d2;
          }
        }

        const pIdx = rowOff + x;
        const idx = pIdx * 4;

        const photoLuma = feltDiff ? (feltDiff[idx] * 0.5 + feltDiff[idx + 1] * 0.5 - feltMean) * 0.48 : 0;
        const microFuzz = (Math.random() - 0.5) * 0.36;

        if (minD2 < 0.0019) {
          const rubberNoise = (Math.random() - 0.5) * 4;
          data[idx] = 236 + rubberNoise;
          data[idx + 1] = 236 + rubberNoise;
          data[idx + 2] = 232 + rubberNoise;
          data[idx + 3] = 255;
          height[pIdx] = 0.09 + microFuzz * 0.05;
          rough[pIdx] = 0.68;
          seamMask[pIdx] = 0.0;
        } else if (minD2 < 0.0044) {
          const lip = (minD2 - 0.0019) / 0.0025;
          data[idx] = Math.round(126 + lip * 64);
          data[idx + 1] = Math.round(154 + lip * 70);
          data[idx + 2] = Math.round(22 + lip * 14);
          data[idx + 3] = 255;
          height[pIdx] = 0.16 + lip * 0.46;
          rough[pIdx] = 0.90;
          seamMask[pIdx] = Math.max(0.0, Math.min(1.0, (minD2 - 0.0022) / 0.0030));
        } else {
          const tuft = Math.sin(nx * 168 + ny * 112) * Math.cos(nz * 162 - ny * 88) * 0.28;
          const clump = Math.sin(nx * 54 - ny * 60) * Math.cos(nz * 56 + nx * 42) * 0.20;
          const fiberStrand = Math.sin((nx * 240 - nz * 190) + tuft * 3.0) * 0.14;
          const weave = feltDiff
            ? photoLuma + (tuft + clump + fiberStrand) * 14 + microFuzz * 12
            : (tuft + clump + fiberStrand + microFuzz) * 18;
          data[idx] = Math.min(255, Math.max(0, Math.round(192 + weave * 0.85)));
          data[idx + 1] = Math.min(255, Math.max(0, Math.round(226 + weave)));
          data[idx + 2] = Math.min(255, Math.max(0, Math.round(36 + weave * 0.22)));
          data[idx + 3] = 255;
          height[pIdx] = 0.62 + microFuzz * 0.44 + tuft * 0.28 + clump * 0.12 + fiberStrand * 0.12;
          rough[pIdx] = Math.min(1.0, 0.90 + Math.abs(microFuzz) * 0.08);
          seamMask[pIdx] = minD2 < 0.0052 ? (minD2 - 0.0022) / 0.0030 : 1.0;
        }
      }
    }

    dCtx.putImageData(dImg, 0, 0);
    return {
      map: toSRGBTexture(diffC),
      normalMap: buildNormalTextureFromHeight(height, w, h, 3.4, true, feltNor, 0.58),
      roughnessMap: buildRoughnessTextureFromArray(rough, w, h, true, feltRough, 0.18, seamMask)
    };
  }

  function buildBasketballMaps() {
    const w = 1024;
    const h = 512;
    const diffC = makeCanvas(w, h);
    const dCtx = diffC.getContext('2d');
    const dImg = dCtx.createImageData(w, h);

    const bDiffSrc = photoAssets.bballLeatherDiff || photoAssets.leatherBrownDiff;
    const bNorSrc = photoAssets.bballLeatherNor || photoAssets.leatherBrownNor;
    const bRoughSrc = photoAssets.bballLeatherRough || photoAssets.leatherBrownRough;
    const leatherDiff = bDiffSrc ? sampleTiledImageData(bDiffSrc, w, h, 4, 2).data : null;
    const leatherNor = bNorSrc ? sampleTiledImageData(bNorSrc, w, h, 4, 2) : null;
    const leatherRough = bRoughSrc ? sampleTiledImageData(bRoughSrc, w, h, 4, 2) : null;

    let leatherMean = 81;
    if (leatherDiff) {
      let sum = 0;
      const totalPx = w * h;
      for (let i = 0; i < totalPx; i += 1) {
        sum += leatherDiff[i * 4];
      }
      leatherMean = sum / totalPx;
    }

    const height = new Float32Array(w * h);
    const rough = new Float32Array(w * h);
    const seamMask = new Float32Array(w * h);
    const data = dImg.data;

    for (let y = 0; y < h; y += 1) {
      const lat = (0.5 - y / h) * Math.PI;
      const cosLat = Math.max(0.18, Math.cos(lat));
      const ny = Math.sin(lat);
      const rowOff = y * w;

      for (let x = 0; x < w; x += 1) {
        const lon = (x / w - 0.5) * Math.PI * 2;
        const nx = Math.cos(lat) * Math.cos(lon);
        const nz = Math.cos(lat) * Math.sin(lon);

        const dEq = Math.abs(ny);
        const dMer = Math.abs(nz);
        const dSide = Math.abs(ny) < 0.9 ? Math.abs(Math.abs(nx) - (0.58 - 0.25 * ny * ny)) : 99;
        const channelDist = Math.min(dEq, dMer, dSide);

        const pIdx = rowOff + x;
        const idx = pIdx * 4;

        // Staggered hexagonal-packed 86-cell NBA full-grain pebbled leather dimples
        const latCell = lat * 86;
        const rowParity = Math.floor(latCell) & 1;
        const cellLon = ((lon * cosLat * 86 + rowParity * 0.5) % 1 + 1) % 1 - 0.5;
        const cellLat = ((latCell) % 1 + 1) % 1 - 0.5;
        const pebbleR = Math.hypot(cellLon, cellLat);
        const pebbleDome = pebbleR < 0.44 ? Math.sqrt(Math.max(0, 1 - (pebbleR / 0.44) * (pebbleR / 0.44))) : 0;

        if (channelDist < 0.025) {
          const chGrain = Math.round((Math.random() - 0.5) * 3);
          data[idx] = Math.max(0, 18 + chGrain);
          data[idx + 1] = Math.max(0, 18 + chGrain);
          data[idx + 2] = Math.max(0, 20 + chGrain);
          data[idx + 3] = 255;
          height[pIdx] = 0.03;
          rough[pIdx] = 0.82;
        } else if (channelDist < 0.043) {
          const bevel = (channelDist - 0.025) / 0.018;
          const shoulder = Math.sin(bevel * Math.PI) * 0.08;
          data[idx] = Math.round(116 + bevel * 98);
          data[idx + 1] = Math.round(48 + bevel * 48);
          data[idx + 2] = Math.round(16 + bevel * 14);
          data[idx + 3] = 255;
          height[pIdx] = 0.24 + bevel * 0.22 + shoulder + pebbleDome * 0.14;
          rough[pIdx] = 0.72 - bevel * 0.12;
        } else {
          const photoShift = leatherDiff ? (leatherDiff[idx] - leatherMean) * 0.28 : 0;
          const grain = (Math.random() - 0.5) * 4;
          // Pristine official NBA full-grain burnt-orange leather with clean subtle pebble micro-relief
          const pebbleAO = 0.82 + 0.18 * Math.pow(pebbleDome, 0.72);
          const baseR = 224 * pebbleAO + photoShift * 0.95 + grain;
          const baseG = 102 * pebbleAO + photoShift * 0.44 + grain * 0.45;
          const baseB = 34 * pebbleAO + photoShift * 0.18 + grain * 0.2;
          data[idx] = Math.min(255, Math.max(0, Math.round(baseR)));
          data[idx + 1] = Math.min(255, Math.max(0, Math.round(baseG)));
          data[idx + 2] = Math.min(255, Math.max(0, Math.round(baseB)));
          data[idx + 3] = 255;
          height[pIdx] = 0.34 + pebbleDome * 0.66;
          // Lustrous satin full-grain leather pebble crowns (0.38) vs soft matte valleys (0.68)
          rough[pIdx] = 0.68 - pebbleDome * 0.30;
        }
      }
    }

    dCtx.putImageData(dImg, 0, 0);
    return {
      map: toSRGBTexture(diffC),
      normalMap: buildNormalTextureFromHeight(height, w, h, 3.4, true, leatherNor, 0.48),
      roughnessMap: buildRoughnessTextureFromArray(rough, w, h, true, leatherRough, 0.24)
    };
  }

  function buildSoccerBallMaps() {
    const w = 1024;
    const h = 512;
    const diffC = makeCanvas(w, h);
    const dCtx = diffC.getContext('2d');
    const dImg = dCtx.createImageData(w, h);

    const leatherDiff = photoAssets.leatherWhiteDiff ? sampleTiledImageData(photoAssets.leatherWhiteDiff, w, h, 4, 2).data : null;
    const leatherNor = photoAssets.leatherWhiteNor ? sampleTiledImageData(photoAssets.leatherWhiteNor, w, h, 4, 2) : null;
    const leatherRough = photoAssets.leatherWhiteRough ? sampleTiledImageData(photoAssets.leatherWhiteRough, w, h, 4, 2) : null;

    let leatherWhiteMean = 150;
    if (leatherDiff) {
      let sum = 0;
      const totalPx = w * h;
      for (let i = 0; i < totalPx; i += 1) {
        sum += leatherDiff[i * 4];
      }
      leatherWhiteMean = sum / totalPx;
    }

    const height = new Float32Array(w * h);
    const rough = new Float32Array(w * h);
    const seamMask = new Float32Array(w * h);
    const data = dImg.data;

    const phi = (1 + Math.sqrt(5)) * 0.5;
    const rawV = [
      [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
      [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
      [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
    ];
    const vx = new Float32Array(12);
    const vy = new Float32Array(12);
    const vz = new Float32Array(12);
    for (let i = 0; i < 12; i += 1) {
      const len = Math.hypot(rawV[i][0], rawV[i][1], rawV[i][2]);
      vx[i] = rawV[i][0] / len;
      vy[i] = rawV[i][1] / len;
      vz[i] = rawV[i][2] / len;
    }

    const fxArr = [];
    const fyArr = [];
    const fzArr = [];
    for (let i = 0; i < 12; i += 1) {
      for (let j = i + 1; j < 12; j += 1) {
        const dotIJ = vx[i] * vx[j] + vy[i] * vy[j] + vz[i] * vz[j];
        if (dotIJ < 0.35) continue;
        for (let k = j + 1; k < 12; k += 1) {
          const dotIK = vx[i] * vx[k] + vy[i] * vy[k] + vz[i] * vz[k];
          const dotJK = vx[j] * vx[k] + vy[j] * vy[k] + vz[j] * vz[k];
          if (dotIK > 0.35 && dotJK > 0.35) {
            const sx = vx[i] + vx[j] + vx[k];
            const sy = vy[i] + vy[j] + vy[k];
            const sz = vz[i] + vz[j] + vz[k];
            const fl = Math.hypot(sx, sy, sz);
            fxArr.push(sx / fl);
            fyArr.push(sy / fl);
            fzArr.push(sz / fl);
          }
        }
      }
    }
    const faceCount = fxArr.length;
    const fx = Float32Array.from(fxArr);
    const fy = Float32Array.from(fyArr);
    const fz = Float32Array.from(fzArr);

    for (let y = 0; y < h; y += 1) {
      const lat = (0.5 - y / h) * Math.PI;
      const cosLat = Math.max(0.08, Math.cos(lat));
      const ny = Math.sin(lat);
      const rowOff = y * w;

      for (let x = 0; x < w; x += 1) {
        const lon = (x / w - 0.5) * Math.PI * 2;
        const nx = cosLat * Math.cos(lon);
        const nz = cosLat * Math.sin(lon);

        let bestV = -1;
        for (let i = 0; i < 12; i += 1) {
          const d = nx * vx[i] + ny * vy[i] + nz * vz[i];
          if (d > bestV) bestV = d;
        }

        let bestF = -1;
        let secondF = -1;
        for (let i = 0; i < faceCount; i += 1) {
          const d = nx * fx[i] + ny * fy[i] + nz * fz[i];
          if (d > bestF) {
            secondF = bestF;
            bestF = d;
          } else if (d > secondF) {
            secondF = d;
          }
        }

        const pentGap = 1.0166 * bestV - bestF;
        const hexEdgeGap = bestF - secondF;
        const isPentagon = pentGap > 0;
        const edgeDist = isPentagon ? Math.abs(pentGap) : Math.min(Math.abs(pentGap), hexEdgeGap);
        const isSeam = edgeDist < 0.011;

        const pIdx = rowOff + x;
        const idx = pIdx * 4;
        const rawShift = leatherDiff ? (leatherDiff[idx] - leatherWhiteMean) * 0.14 : 0;
        const photoShift = Math.max(-10, Math.min(10, rawShift));
        const cushion = Math.min(1.0, edgeDist / 0.068);
        const pillow = Math.pow(cushion, 0.50);
        const microGrain = (Math.random() - 0.5) * 4;

        // Delicate recessed precision panel seam contour
        const puckerMask = edgeDist < 0.044 ? (1.0 - edgeDist / 0.044) : 0.0;
        const pucker = puckerMask > 0 ? Math.sin((nx * 165 - ny * 145 + nz * 155)) * 0.022 * puckerMask : 0.0;

        // Pro match-ball micro-dimple surface cell
        const dimpLon = ((lon * cosLat * 84) % 1 + 1) % 1 - 0.5;
        const dimpLat = ((lat * 84) % 1 + 1) % 1 - 0.5;
        const dimpD = Math.hypot(dimpLon, dimpLat);
        const dimple = dimpD < 0.34 ? -0.045 * (1 - dimpD / 0.34) : 0.012;

        if (isSeam) {
          const stitch = Math.sin((nx + ny + nz) * 230) > 0.28;
          data[idx] = stitch ? 104 : 16;
          data[idx + 1] = stitch ? 108 : 18;
          data[idx + 2] = stitch ? 114 : 22;
          data[idx + 3] = 255;
          height[pIdx] = stitch ? 0.24 : 0.05;
          rough[pIdx] = 0.78;
        } else if (isPentagon) {
          const pentAO = 0.78 + 0.22 * pillow;
          const base = Math.max(16, Math.round((24 + photoShift * 0.2 + dimple * 10 + microGrain * 0.5) * pentAO));
          data[idx] = base;
          data[idx + 1] = base + 2;
          data[idx + 2] = base + 8;
          data[idx + 3] = 255;
          height[pIdx] = 0.24 + pillow * 0.72 + dimple + pucker;
          rough[pIdx] = Math.min(0.85, 0.30 + (1.0 - pillow) * 0.18 - dimple * 0.5);
        } else {
          const hexAO = 0.80 + 0.20 * pillow;
          const rawTone = (244 + photoShift + dimple * 16 + microGrain * 0.5) * hexAO;
          const base = Math.min(250, Math.max(188, Math.round(rawTone)));
          data[idx] = base;
          data[idx + 1] = Math.min(252, base + 1);
          data[idx + 2] = Math.min(255, base + 3);
          data[idx + 3] = 255;
          height[pIdx] = 0.24 + pillow * 0.72 + dimple + pucker;
          rough[pIdx] = Math.min(0.85, 0.26 + (1.0 - pillow) * 0.18 - dimple * 0.5);
        }
      }
    }

    dCtx.putImageData(dImg, 0, 0);
    return {
      map: toSRGBTexture(diffC),
      normalMap: buildNormalTextureFromHeight(height, w, h, 3.4, true, leatherNor, 0.30),
      roughnessMap: buildRoughnessTextureFromArray(rough, w, h, true, leatherRough, 0.18)
    };
  }

  function buildGoldIngotMaps() {
    const w = 1024;
    const h = 512;
    const diffC = makeCanvas(w, h);
    const dCtx = diffC.getContext('2d');

    const gNor = photoAssets.metalNor;
    const gRough = photoAssets.metalRough;
    const metalNor = gNor ? sampleTiledImageData(gNor, w, h, 2, 1) : null;
    const metalRough = gRough ? sampleTiledImageData(gRough, w, h, 2, 1) : null;

    const stampC = makeCanvas(w, h);
    const sCtx = stampC.getContext('2d');

    const grad = dCtx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FFF2B8');
    grad.addColorStop(0.45, '#FFE27E');
    grad.addColorStop(1, '#F4C550');
    dCtx.fillStyle = grad;
    dCtx.fillRect(0, 0, w, h);

    for (let i = 0; i < 1800; i += 1) {
      dCtx.fillStyle = i % 2 === 0 ? 'rgba(255, 253, 238, 0.055)' : 'rgba(218, 162, 46, 0.045)';
      dCtx.fillRect(Math.random() * w * 0.35, Math.random() * h, w * 0.65, 1);
    }

    sCtx.fillStyle = '#FFFFFF';
    sCtx.fillRect(0, 0, w, h);

    sCtx.strokeStyle = '#121212';
    sCtx.lineWidth = 14;
    sCtx.strokeRect(72, 52, w - 144, h - 104);

    sCtx.lineWidth = 6;
    sCtx.strokeRect(96, 76, w - 192, h - 152);

    // Small assay hallmark box
    sCtx.lineWidth = 5;
    sCtx.strokeRect(132, 108, 128, 72);

    sCtx.fillStyle = '#0A0A0A';
    sCtx.textAlign = 'center';
    sCtx.font = 'bold 28px Georgia, serif';
    sCtx.fillText('ASSAY', 196, 152);
    sCtx.font = 'bold 46px Georgia, serif';
    sCtx.fillText('SUISSE · 100g', w * 0.52, h * 0.31);
    sCtx.font = 'bold 72px Georgia, serif';
    sCtx.fillText('FINE GOLD', w * 0.5, h * 0.53);
    sCtx.font = 'bold 94px Georgia, serif';
    sCtx.fillText('999.9', w * 0.5, h * 0.74);
    sCtx.font = 'bold 26px "Barlow Condensed", sans-serif';
    sCtx.fillText('A 048291 · MELTER', w * 0.5, h * 0.855);

    dCtx.save();
    dCtx.globalAlpha = 0.50;
    dCtx.strokeStyle = 'rgba(148, 96, 20, 1)';
    dCtx.lineWidth = 14;
    dCtx.strokeRect(72, 52, w - 144, h - 104);
    dCtx.lineWidth = 6;
    dCtx.strokeRect(96, 76, w - 192, h - 152);
    dCtx.lineWidth = 5;
    dCtx.strokeRect(132, 108, 128, 72);

    // Subtle specular bevel catchline on upper-left rim of inner stamped frame
    dCtx.strokeStyle = 'rgba(255, 252, 230, 0.78)';
    dCtx.lineWidth = 2.5;
    dCtx.beginPath();
    dCtx.moveTo(98, h - 78);
    dCtx.lineTo(98, 78);
    dCtx.lineTo(w - 98, 78);
    dCtx.stroke();

    dCtx.fillStyle = 'rgba(148, 96, 20, 1)';
    dCtx.textAlign = 'center';
    dCtx.font = 'bold 28px Georgia, serif';
    dCtx.fillText('ASSAY', 196, 152);
    dCtx.font = 'bold 46px Georgia, serif';
    dCtx.fillText('SUISSE · 100g', w * 0.52, h * 0.31);
    dCtx.font = 'bold 72px Georgia, serif';
    dCtx.fillText('FINE GOLD', w * 0.5, h * 0.53);
    dCtx.font = 'bold 94px Georgia, serif';
    dCtx.fillText('999.9', w * 0.5, h * 0.74);
    dCtx.font = 'bold 26px "Barlow Condensed", sans-serif';
    dCtx.fillText('A 048291 · MELTER', w * 0.5, h * 0.855);
    dCtx.restore();

    const sData = sCtx.getImageData(0, 0, w, h).data;
    const height = new Float32Array(w * h);
    const rough = new Float32Array(w * h);
    const seamMask = new Float32Array(w * h);

    // 3x3 smooth die-struck chamfer kernel prevents jagged 1px normal aliasing on engraved lettering
    for (let y = 0; y < h; y += 1) {
      const yPrev = y > 0 ? y - 1 : 0;
      const yNext = y < h - 1 ? y + 1 : h - 1;
      const brushLine = (Math.random() - 0.5) * 0.022 + Math.sin(y * 0.42) * 0.011;
      const v = y / h;
      const dv = (v - 0.5) * 2.0;
      const inYBorder = v < 0.095 || v > 0.905;
      const rowOff = y * w;

      for (let x = 0; x < w; x += 1) {
        const xPrev = x > 0 ? x - 1 : 0;
        const xNext = x < w - 1 ? x + 1 : w - 1;
        const u = x / w;
        const du = (u - 0.5) * 2.0;
        const inBorder = inYBorder || u < 0.068 || u > 0.932;
        const pIdx = rowOff + x;

        const c0 = sData[pIdx * 4];
        const stampSmooth =
          (c0 * 4 +
            sData[(rowOff + xPrev) * 4] +
            sData[(rowOff + xNext) * 4] +
            sData[(yPrev * w + x) * 4] +
            sData[(yNext * w + x) * 4] +
            (sData[(yPrev * w + xPrev) * 4] +
              sData[(yPrev * w + xNext) * 4] +
              sData[(yNext * w + xPrev) * 4] +
              sData[(yNext * w + xNext) * 4]) *
              0.5) /
          2550;

        // Subtle molten cast-gold cooling flow ripples near face perimeter
        const rEllip = Math.hypot(du * 0.92, dv * 1.15);
        const pourWave = Math.sin(rEllip * 22.0 + Math.sin(du * 5.0) * 0.8) * 0.014 * Math.min(1.0, rEllip);

        height[pIdx] = 0.26 + stampSmooth * 0.58 + brushLine + pourWave;
        if (inBorder) {
          // Pristine mirror-chamfered 24K Swiss bullion bevels
          rough[pIdx] = 0.08 + Math.abs(brushLine) * 0.45;
        } else if (stampSmooth < 0.72) {
          // Crisp frosted gold die-struck engraving crevices [0.32..0.42]
          rough[pIdx] = 0.42 - stampSmooth * 0.10;
        } else {
          // Silky brushed mint 24K bullion face [0.14..0.19]
          rough[pIdx] = 0.14 + Math.abs(brushLine) * 0.75 + Math.abs(pourWave) * 0.5;
        }
      }
    }

    return {
      map: toSRGBTexture(diffC),
      normalMap: buildNormalTextureFromHeight(height, w, h, 2.1, false, metalNor, 0.28),
      roughnessMap: buildRoughnessTextureFromArray(rough, w, h, false, metalRough, 0.16),
      anisotropyMap: buildBrushedAnisotropyMap(w, h, sData, 0.94, 0.06)
    };
  }

  function buildBrushedAnisotropyMap(w, h, stampData, baseStrength, angleJitter) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const baseStr = baseStrength || 0.9;
    const jitter = angleJitter || 0.08;

    for (let y = 0; y < h; y += 1) {
      const rowPhase = Math.sin(y * 0.87) * 0.45 + Math.cos(y * 2.13) * 0.55;
      const rowAng = rowPhase * jitter;
      for (let x = 0; x < w; x += 1) {
        const pIdx = y * w + x;
        const fineGrain = Math.sin(x * 0.09 + y * 1.41) * 0.5 + Math.cos(x * 0.21 - y * 0.73) * 0.5;
        const theta = rowAng + fineGrain * (jitter * 0.6);
        const dx = Math.cos(theta);
        const dy = Math.sin(theta);

        let strength = baseStr - Math.abs(fineGrain) * 0.12;
        if (stampData) {
          const stampVal = stampData[pIdx * 4] / 255;
          if (stampVal < 0.7) {
            strength *= 0.42;
          }
        }
        strength = Math.max(0.15, Math.min(1.0, strength));

        const idx = pIdx * 4;
        data[idx] = Math.round((dx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.round((dy * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.round(strength * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    return toDataTexture(c, stampData ? 0 : 3, stampData ? 0 : 1.5);
  }

  /* =========================================================
     4. Apple Watch Hardware Brushed Metal & Elastomer PBR Maps
     ========================================================= */
  function buildWatchHardwareMaps() {
    let metalNormalMap;
    let metalRoughnessMap;
    let rubberNormalMap;
    let rubberRoughnessMap;

    if (photoAssets.metalNor && photoAssets.metalRough) {
      metalNormalMap = toDataTexture(photoAssets.metalNor, 3, 1.5);
      metalRoughnessMap = toDataTexture(photoAssets.metalRough, 3, 1.5);
    } else {
      const mw = 512;
      const mh = 256;
      const mH = new Float32Array(mw * mh);
      const mR = new Float32Array(mw * mh);
      for (let y = 0; y < mh; y += 1) {
        const brush = (Math.random() - 0.5) * 0.07 + Math.sin(y * 0.68) * 0.025;
        for (let x = 0; x < mw; x += 1) {
          mH[y * mw + x] = 0.5 + brush + (Math.random() - 0.5) * 0.015;
          mR[y * mw + x] = 0.21 + Math.abs(brush) * 1.4;
        }
      }
      metalNormalMap = buildNormalTextureFromHeight(mH, mw, mh, 1.35, true);
      metalRoughnessMap = buildRoughnessTextureFromArray(mR, mw, mh, true);
    }

    if (photoAssets.rubberNor && photoAssets.rubberRough) {
      rubberNormalMap = toDataTexture(photoAssets.rubberNor, 3, 3);
      rubberRoughnessMap = toDataTexture(photoAssets.rubberRough, 3, 3);
    } else {
      const rw = 256;
      const rh = 256;
      const rH = new Float32Array(rw * rh);
      const rR = new Float32Array(rw * rh);
      for (let i = 0; i < rw * rh; i += 1) {
        rH[i] = 0.5 + (Math.random() - 0.5) * 0.16;
        rR[i] = 0.78 + Math.random() * 0.14;
      }
      rubberNormalMap = buildNormalTextureFromHeight(rH, rw, rh, 1.2, true);
      rubberRoughnessMap = buildRoughnessTextureFromArray(rR, rw, rh, true);
    }

    const metalAnisotropyMap = buildBrushedAnisotropyMap(512, 256, null, 0.96, 0.065);

    return {
      metalNormalMap: metalNormalMap,
      metalRoughnessMap: metalRoughnessMap,
      metalAnisotropyMap: metalAnisotropyMap,
      rubberNormalMap: rubberNormalMap,
      rubberRoughnessMap: rubberRoughnessMap
    };
  }

  /* =========================================================
     5. Soft Radial Contact AO Shadow Decal Texture
     ========================================================= */
  function buildContactShadowTexture() {
    const size = 256;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);

    for (let y = 0; y < size; y += 1) {
      const dy = (y / size - 0.5) * 2;
      for (let x = 0; x < size; x += 1) {
        const dx = (x / size - 0.5) * 2;
        const r2 = dx * dx + dy * dy;
        let alpha = 0.0;
        if (r2 < 1.0) {
          // Two-zone physical shadow: dense contact umbra + broad soft AO penumbra
          const umbra = Math.exp(-r2 * 11.5) * 0.52;
          const penumbra = Math.exp(-r2 * 3.2) * (1.0 - r2) * 0.58;
          alpha = Math.min(1.0, umbra + penumbra);
        }
        const idx = (y * size + x) * 4;
        img.data[idx] = 0;
        img.data[idx + 1] = 0;
        img.data[idx + 2] = 0;
        img.data[idx + 3] = Math.round(alpha * 205);
      }
    }
    ctx.putImageData(img, 0, 0);
    return toSRGBTexture(c);
  }

  function buildDiamondCausticTexture() {
    const size = 256;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const cx = size * 0.5;
    const cy = size * 0.5;

    // Tight dark girdle contact AO beneath gem resting seat
    const outerAO = ctx.createRadialGradient(cx, cy, size * 0.14, cx, cy, size * 0.46);
    outerAO.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
    outerAO.addColorStop(0.5, 'rgba(0, 0, 0, 0.48)');
    outerAO.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = outerAO;
    ctx.fillRect(0, 0, size, size);

    // Focused icy-cyan, warm amber, and pale violet spectral caustic spokes onto velvet
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const centerGlow = ctx.createRadialGradient(cx + 4, cy - 4, 2, cx, cy, size * 0.17);
    centerGlow.addColorStop(0, 'rgba(240, 248, 255, 0.54)');
    centerGlow.addColorStop(0.55, 'rgba(136, 212, 255, 0.18)');
    centerGlow.addColorStop(1, 'rgba(80, 160, 255, 0.0)');
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
    ctx.fill();

    const colors = [
      'rgba(245, 250, 255, 0.42)',
      'rgba(162, 224, 255, 0.30)',
      'rgba(255, 224, 168, 0.24)',
      'rgba(205, 190, 255, 0.26)'
    ];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + 0.18;
      const sx = cx + Math.cos(a) * size * 0.155;
      const sy = cy + Math.sin(a) * size * 0.155;
      const spoke = ctx.createRadialGradient(sx, sy, 1, sx, sy, size * 0.07);
      spoke.addColorStop(0, colors[i % colors.length]);
      spoke.addColorStop(1, 'rgba(120, 190, 255, 0.0)');
      ctx.fillStyle = spoke;
      ctx.beginPath();
      ctx.arc(sx, sy, size * 0.075, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return toSRGBTexture(c);
  }

  /* =========================================================
     6. Preview Icons & Procedural Web Audio Foley
     ========================================================= */
  function buildPreviewIcons() {
    const icons = {};
    const size = 96;

    THEME_ORDER.forEach(function (id) {
      const c = makeCanvas(size, size);
      const ctx = c.getContext('2d');
      const cx = size * 0.5;
      const cy = size * 0.5;
      const r = size * 0.42;

      if (id === 'tennis') {
        const g = ctx.createRadialGradient(cx - 10, cy - 10, 2, cx, cy, r);
        g.addColorStop(0, '#EAFF54');
        g.addColorStop(1, '#79A204');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#F6F8F2';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.6, cy - r * 0.78);
        ctx.quadraticCurveTo(cx, cy, cx - r * 0.6, cy + r * 0.78);
        ctx.moveTo(cx + r * 0.6, cy - r * 0.78);
        ctx.quadraticCurveTo(cx, cy, cx + r * 0.6, cy + r * 0.78);
        ctx.stroke();
      } else if (id === 'diamond') {
        const g = ctx.createLinearGradient(20, 20, 76, 84);
        g.addColorStop(0, '#FFFFFF');
        g.addColorStop(0.5, '#9CEBFF');
        g.addColorStop(1, '#1A73A8');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(30, 22);
        ctx.lineTo(66, 22);
        ctx.lineTo(84, 44);
        ctx.lineTo(48, 86);
        ctx.lineTo(12, 44);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (id === 'basketball') {
        const g = ctx.createRadialGradient(cx - 10, cy - 10, 2, cx, cy, r);
        g.addColorStop(0, '#FF9333');
        g.addColorStop(1, '#8D2A02');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#240E04';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy + r);
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.stroke();
      } else if (id === 'goldBar') {
        const g = ctx.createLinearGradient(14, 28, 82, 68);
        g.addColorStop(0, '#FFF4B0');
        g.addColorStop(0.5, '#F5BD2E');
        g.addColorStop(1, '#9E620A');
        ctx.fillStyle = g;
        ctx.fillRect(14, 28, 68, 40);
        ctx.strokeStyle = '#FFF6C8';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(20, 34, 56, 28);
      } else {
        const g = ctx.createRadialGradient(cx - 10, cy - 10, 2, cx, cy, r);
        g.addColorStop(0, '#FFFFFF');
        g.addColorStop(1, '#AEB4BD');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#181A1F';
        ctx.beginPath();
        for (let i = 0; i < 5; i += 1) {
          const ang = (i * Math.PI * 2) / 5 - Math.PI * 0.5;
          const px = cx + Math.cos(ang) * 14;
          const py = cy + Math.sin(ang) * 14;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }

      icons[id] = c.toDataURL('image/png');
    });

    return icons;
  }

  const SoundFX = (function () {
    let audioCtx = null;
    let enabled = false;
    let lastTickMs = 0;

    function ensureContext() {
      if (!audioCtx && (global.AudioContext || global.webkitAudioContext)) {
        const AudioCtor = global.AudioContext || global.webkitAudioContext;
        audioCtx = new AudioCtor();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function () {});
      }
      return audioCtx;
    }

    function setEnabled(next) {
      enabled = Boolean(next);
      if (enabled) {
        ensureContext();
        playClick();
      }
    }

    function isEnabled() {
      return enabled;
    }

    function playClick() {
      if (!enabled) return;
      const ctx = ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.045);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
    }

    function playShake() {
      if (!enabled) return;
      const ctx = ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.19);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    }

    function playCollision(impactSpeed, themeId) {
      if (!enabled) return;
      const nowMs = performance.now();
      if (nowMs - lastTickMs < 28 || impactSpeed < 1.2) return;
      lastTickMs = nowMs;

      const ctx = ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      let baseFreq = 260;
      if (themeId === 'diamond') baseFreq = 1320;
      else if (themeId === 'goldBar') baseFreq = 640;
      else if (themeId === 'basketball') baseFreq = 155;
      else if (themeId === 'soccer') baseFreq = 195;

      const volume = Math.min(0.055, (impactSpeed - 1.2) * 0.011);
      osc.type = themeId === 'diamond' || themeId === 'goldBar' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq + Math.random() * 55, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.62, now + 0.045);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
    }

    return {
      setEnabled: setEnabled,
      isEnabled: isEnabled,
      playClick: playClick,
      playShake: playShake,
      playCollision: playCollision
    };
  })();

  const hdriCache = {};
  let contactShadowCache = null;
  let diamondCausticCache = null;
  let hardwareMapsCache = null;
  let floorCache = {};
  let objectCache = {};
  let photoModelsPromise = null;

  ns.WATCH_THEMES = WATCH_THEMES;
  ns.THEME_ORDER = THEME_ORDER;
  ns.VELVET_PRESETS = VELVET_PRESETS;
  ns.SoundFX = SoundFX;
  ns.PreviewIcons = buildPreviewIcons();
  ns.photoModels = {};

  ns.getVelvetPreset = function () {
    return currentVelvetPresetId;
  };

  ns.getVelvetPresetData = function (presetId) {
    return VELVET_PRESETS[presetId || currentVelvetPresetId] || VELVET_PRESETS.obsidian;
  };

  ns.setVelvetPreset = function (presetId) {
    if (!VELVET_PRESETS[presetId]) return;
    currentVelvetPresetId = presetId;
  };

  ns.isPhotoPBRReady = function () {
    return photoReady;
  };

  ns.getStudioEnvMap = function (renderer) {
    if (!hdriCache.procedural) {
      hdriCache.procedural = createStudioEnvMap(renderer);
    }
    return hdriCache.procedural;
  };

  ns.getStudioEquirectMap = function (presetId) {
    const cached = hdriCache[presetId];
    if (cached && cached.userData && cached.userData.equirectTex) {
      return cached.userData.equirectTex;
    }
    const proc = hdriCache.procedural;
    if (proc && proc.userData && proc.userData.equirectTex) {
      return proc.userData.equirectTex;
    }
    return null;
  };

  ns.loadStudioHDRI = function (renderer, presetId, onReady) {
    const id = HDRI_FILES[presetId] ? presetId : 'procedural';
    if (hdriCache[id]) {
      if (onReady) onReady(hdriCache[id]);
      return;
    }

    const LoaderClass = THREE.HDRLoader || THREE.RGBELoader;
    if (id === 'procedural' || !LoaderClass || global.location.protocol === 'file:') {
      const tex = ns.getStudioEnvMap(renderer);
      if (onReady) onReady(tex);
      return;
    }

    const loader = new LoaderClass();
    loader.setDataType(THREE.HalfFloatType);
    loader.load(
      HDRI_FILES[id],
      function (hdrTex) {
        try {
          hdrTex.wrapS = THREE.RepeatWrapping;
          hdrTex.wrapT = THREE.ClampToEdgeWrapping;
          hdrTex.minFilter = THREE.LinearFilter;
          hdrTex.magFilter = THREE.LinearFilter;
          hdrTex.needsUpdate = true;

          const pmrem = new THREE.PMREMGenerator(renderer);
          pmrem.compileEquirectangularShader();
          const rt = pmrem.fromEquirectangular(hdrTex);
          pmrem.dispose();
          rt.texture.userData = rt.texture.userData || {};
          rt.texture.userData.equirectTex = hdrTex;
          hdriCache[id] = rt.texture;
          if (onReady) onReady(rt.texture);
        } catch (_err) {
          if (onReady) onReady(ns.getStudioEnvMap(renderer));
        }
      },
      undefined,
      function () {
        if (onReady) onReady(ns.getStudioEnvMap(renderer));
      }
    );
  };

  ns.loadPhotogrammetryModels = function (onReady) {
    if (ns.photoModels.soccer) {
      if (onReady) onReady(ns.photoModels);
      return Promise.resolve(ns.photoModels);
    }
    if (photoModelsPromise) {
      return photoModelsPromise.then(function (models) {
        if (onReady) onReady(models);
        return models;
      });
    }
    const GLTFLoaderClass = global.THREE_ADDONS && global.THREE_ADDONS.GLTFLoader;
    if (!GLTFLoaderClass || global.location.protocol === 'file:') {
      return Promise.resolve(ns.photoModels);
    }

    photoModelsPromise = new Promise(function (resolve) {
      const loader = new GLTFLoaderClass();
      loader.load(
        'assets/models/football/football_1k.gltf',
        function (gltf) {
          try {
            let targetMesh = null;
            gltf.scene.traverse(function (obj) {
              if (!obj.isMesh) return;
              if (obj.name === 'Football_01_inflated' || (obj.parent && obj.parent.name === 'football_inflated')) {
                targetMesh = obj;
              }
            });
            if (!targetMesh) {
              const allMeshes = [];
              gltf.scene.traverse(function (obj) {
                if (obj.isMesh) allMeshes.push(obj);
              });
              targetMesh = allMeshes[1] || allMeshes[0] || null;
            }
            if (targetMesh && targetMesh.geometry) {
              const geom = targetMesh.geometry.clone();
              geom.computeBoundingBox();
              geom.computeBoundingSphere();
              if (geom.boundingBox) {
                const center = new THREE.Vector3();
                geom.boundingBox.getCenter(center);
                geom.translate(-center.x, -center.y, -center.z);
              }
              geom.computeBoundingSphere();
              const radius = (geom.boundingSphere && geom.boundingSphere.radius) || 0.11;
              const scale = radius > 0.0001 ? 1.0 / radius : 9.0;
              geom.scale(scale, scale, scale);
              geom.computeBoundingBox();
              geom.computeBoundingSphere();

              const srcMat = targetMesh.material;
              const mat = srcMat && typeof srcMat.clone === 'function'
                ? srcMat.clone()
                : new THREE.MeshStandardMaterial();
              mat.roughness = 1.0;
              mat.metalness = 0.0;
              mat.envMapIntensity = 0.42;
              if (mat.normalScale && typeof mat.normalScale.set === 'function') {
                mat.normalScale.set(1.25, 1.25);
              }
              if (mat.map) mat.map.anisotropy = 4;
              if (mat.normalMap) mat.normalMap.anisotropy = 4;
              if (mat.roughnessMap) {
                mat.roughnessMap.anisotropy = 4;
                mat.aoMap = mat.roughnessMap;
                mat.aoMapIntensity = 0.85;
                if ('channel' in mat.aoMap) {
                  mat.aoMap.channel = 0;
                }
              }
              mat.needsUpdate = true;

              ns.photoModels.soccer = {
                geometry: geom,
                material: mat
              };
            }
          } catch (err) {
            console.warn('[textures3d] Failed preparing CC0 football glTF:', err);
          }
          if (onReady) onReady(ns.photoModels);
          resolve(ns.photoModels);
        },
        undefined,
        function (err) {
          console.warn('[textures3d] Failed loading CC0 football glTF:', err);
          resolve(ns.photoModels);
        }
      );
    });
    return photoModelsPromise;
  };

  ns.loadPhotographicMaps = function (onUpdated) {
    if (photoReady) {
      if (onUpdated) onUpdated();
      return Promise.resolve(true);
    }
    if (photoLoadingPromise) {
      return photoLoadingPromise.then(function () {
        if (onUpdated) onUpdated();
        return photoReady;
      });
    }
    if (global.location.protocol === 'file:') {
      return Promise.resolve(false);
    }

    const manifest = {
      clayDiff: 'assets/textures/clay_plaster/diff.jpg',
      clayNor: 'assets/textures/clay_plaster/nor_gl.jpg',
      clayRough: 'assets/textures/clay_plaster/rough.jpg',
      trackNor: 'assets/textures/clay_plaster/track_nor_gl.jpg',
      woodDiff: 'assets/textures/dark_wood/diff.jpg',
      woodNor: 'assets/textures/dark_wood/nor_gl.jpg',
      woodRough: 'assets/textures/dark_wood/rough.jpg',
      grassDiff: 'assets/textures/leafy_grass/diff.jpg',
      grassNor: 'assets/textures/leafy_grass/nor_gl.jpg',
      grassRough: 'assets/textures/leafy_grass/rough.jpg',
      velvetDiff: 'assets/textures/velvet/diff.jpg',
      velvetNor: 'assets/textures/velvet/nor_gl.jpg',
      velvetRough: 'assets/textures/velvet/rough.jpg',
      feltDiff: 'assets/textures/felt/diff.jpg',
      feltNor: 'assets/textures/felt/nor_gl.jpg',
      feltRough: 'assets/textures/felt/rough.jpg',
      leatherBrownDiff: 'assets/textures/leather_brown/diff.jpg',
      leatherBrownNor: 'assets/textures/leather_brown/nor_gl.jpg',
      leatherBrownRough: 'assets/textures/leather_brown/rough.jpg',
      leatherWhiteDiff: 'assets/textures/leather_white/diff.jpg',
      leatherWhiteNor: 'assets/textures/leather_white/nor_gl.jpg',
      leatherWhiteRough: 'assets/textures/leather_white/rough.jpg',
      metalDiff: 'assets/textures/metal_clean/diff.jpg',
      metalNor: 'assets/textures/metal_clean/nor_gl.jpg',
      metalRough: 'assets/textures/metal_clean/rough.jpg',
      rubberDiff: 'assets/textures/rubber/diff.jpg',
      rubberNor: 'assets/textures/rubber/nor_gl.jpg',
      rubberRough: 'assets/textures/rubber/rough.jpg',
      marbleDiff: 'assets/textures/black_marble/diff.jpg',
      marbleNor: 'assets/textures/black_marble/nor_gl.jpg',
      marbleRough: 'assets/textures/black_marble/rough.jpg',
      mapleDiff: 'assets/textures/maple_court/diff.jpg',
      mapleNor: 'assets/textures/maple_court/nor_gl.jpg',
      mapleRough: 'assets/textures/maple_court/rough.jpg',
      bballLeatherDiff: 'assets/textures/basketball_leather/diff.jpg',
      bballLeatherNor: 'assets/textures/basketball_leather/nor_gl.jpg',
      bballLeatherRough: 'assets/textures/basketball_leather/rough.jpg'
    };

    const keys = Object.keys(manifest);
    photoLoadingPromise = Promise.all(
      keys.map(function (key) {
        return loadImageSafe(manifest[key]).then(function (img) {
          if (img) photoAssets[key] = img;
        });
      })
    ).then(function () {
      photoReady = Boolean(photoAssets.woodDiff && photoAssets.metalNor && photoAssets.feltNor);
      floorCache = {};
      objectCache = {};
      hardwareMapsCache = null;
      if (onUpdated) onUpdated();
      return photoReady;
    });

    return photoLoadingPromise;
  };

  ns.getContactShadowTexture = function () {
    if (!contactShadowCache) {
      contactShadowCache = buildContactShadowTexture();
    }
    return contactShadowCache;
  };

  ns.getDiamondCausticTexture = function () {
    if (!diamondCausticCache) {
      diamondCausticCache = buildDiamondCausticTexture();
    }
    return diamondCausticCache;
  };

  ns.getWatchHardwareMaps = function () {
    if (!hardwareMapsCache) {
      hardwareMapsCache = buildWatchHardwareMaps();
    }
    return hardwareMapsCache;
  };

  ns.getFloorMaps = function (themeId) {
    if (themeId === 'diamond') {
      const dKey = 'diamond_' + currentVelvetPresetId;
      if (!floorCache[dKey]) {
        floorCache[dKey] = buildDiamondVelvetMaps(currentVelvetPresetId);
      }
      return floorCache[dKey];
    }

    const key = themeId === 'goldBar' ? 'vault' : themeId;
    if (floorCache[key]) return floorCache[key];

    if (key === 'tennis') floorCache[key] = buildClayCourtMaps();
    else if (key === 'basketball') floorCache[key] = buildHardwoodCourtMaps();
    else if (key === 'soccer') floorCache[key] = buildSoccerPitchMaps();
    else floorCache[key] = buildObsidianVaultMaps();

    return floorCache[key];
  };

  ns.getObjectMaps = function (themeId) {
    if (objectCache[themeId]) return objectCache[themeId];
    if (themeId === 'tennis') objectCache[themeId] = buildTennisBallMaps();
    else if (themeId === 'basketball') objectCache[themeId] = buildBasketballMaps();
    else if (themeId === 'soccer') objectCache[themeId] = buildSoccerBallMaps();
    else if (themeId === 'goldBar') objectCache[themeId] = buildGoldIngotMaps();
    else objectCache[themeId] = null;
    return objectCache[themeId];
  };

  ns.prewarmThemeAssets = function (themeId) {
    if (!WATCH_THEMES[themeId]) return;
    ns.getFloorMaps(themeId);
    ns.getObjectMaps(themeId);
  };
})(window);

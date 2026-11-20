(function (global) {
  'use strict';

  const ns = (global.GravityWatch = global.GravityWatch || {});

  const WATCH_THEMES = {
    tennis: {
      id: 'tennis',
      name: '网球',
      subtitle: 'Clay Court',
      accentColor: '#D6F52E',
      isLuxury: false,
      cinematicCount: 17,
      promptCount: 40
    },
    diamond: {
      id: 'diamond',
      name: '钻石',
      subtitle: 'Velvet Cushion',
      accentColor: '#A8EEFF',
      isLuxury: true,
      cinematicCount: 19,
      promptCount: 36
    },
    basketball: {
      id: 'basketball',
      name: '篮球',
      subtitle: 'Hardwood Court',
      accentColor: '#FF8529',
      isLuxury: false,
      cinematicCount: 16,
      promptCount: 40
    },
    goldBar: {
      id: 'goldBar',
      name: '金条',
      subtitle: 'Bullion Vault',
      accentColor: '#FFD65A',
      isLuxury: true,
      cinematicCount: 15,
      promptCount: 28
    },
    soccer: {
      id: 'soccer',
      name: '足球',
      subtitle: 'Grass Pitch',
      accentColor: '#98F568',
      isLuxury: false,
      cinematicCount: 17,
      promptCount: 40
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
    tex.anisotropy = 8;
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
    tex.anisotropy = 8;
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
    tex.anisotropy = 8;
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

  function buildRoughnessTextureFromArray(rough, w, h, wrapX, detailImgData, weight) {
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
      const idx = i * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }

    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.wrapS = wrapX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
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

    // Photographer strip-box softboxes separated by crisp dark negative-fill bands
    // so brushed titanium, 999.9 bullion & sapphire edges catch razor specular ribbons
    const panels = [
      { lon: -0.42, lat: 0.96, rx: 0.56, ry: 0.14, r: 7.4, g: 7.0, b: 6.2 },
      { lon: -1.78, lat: 0.34, rx: 0.16, ry: 0.72, r: 6.8, g: 5.7, b: 4.1 },
      { lon: 1.72, lat: 0.18, rx: 0.15, ry: 0.68, r: 4.2, g: 5.4, b: 7.0 },
      { lon: 0.42, lat: -0.82, rx: 0.52, ry: 0.14, r: 2.2, g: 1.8, b: 1.2 },
      { lon: 0.78, lat: 0.64, rx: 0.09, ry: 0.09, r: 15.0, g: 14.8, b: 14.2 },
      { lon: -1.08, lat: 0.58, rx: 0.08, ry: 0.08, r: 13.5, g: 12.6, b: 11.2 },
      { lon: 2.42, lat: 0.48, rx: 0.10, ry: 0.10, r: 10.5, g: 11.8, b: 13.8 }
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
    equirect.minFilter = canFloatLinear ? THREE.LinearFilter : THREE.NearestFilter;
    equirect.magFilter = canFloatLinear ? THREE.LinearFilter : THREE.NearestFilter;
    equirect.needsUpdate = true;

    const rt = pmrem.fromEquirectangular(equirect);
    equirect.dispose();
    pmrem.dispose();
    return rt.texture;
  }

  /* =========================================================
     2. Photorealistic Court & Vault Floors (Web CC0 + Procedural)
     ========================================================= */
  function buildClayCourtMaps() {
    const w = 1024;
    const h = 1248;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');

    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 180, w * 0.5, h * 0.5, w * 0.92);
    bgGrad.addColorStop(0, '#132D18');
    bgGrad.addColorStop(1, '#040D06');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle granular turf/apron stipple outside the clay perimeter
    for (let i = 0; i < 4800; i += 1) {
      const gx = Math.random() * w;
      const gy = Math.random() * h;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(64, 130, 68, 0.08)' : 'rgba(2, 10, 4, 0.14)';
      ctx.fillRect(gx, gy, 2, 2);
    }

    // Recalibrated for 1.5x extended parallax floor (6.00 x 7.32)
    const padX = w * 0.225;
    const padY = h * 0.185;
    const cw = w - padX * 2;
    const ch = h - padY * 2;

    const clayGrad = ctx.createLinearGradient(0, padY, 0, padY + ch);
    clayGrad.addColorStop(0, '#8C341B');
    clayGrad.addColorStop(0.5, '#772A15');
    clayGrad.addColorStop(1, '#5E200E');
    ctx.fillStyle = clayGrad;
    ctx.fillRect(padX, padY, cw, ch);

    if (photoAssets.clayDiff) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(padX, padY, cw, ch);
      ctx.clip();
      ctx.globalAlpha = 0.58;
      ctx.globalCompositeOperation = 'soft-light';
      drawTiledImage(ctx, photoAssets.clayDiff, w, h, 3, 3.6);
      ctx.restore();
    } else {
      for (let i = 0; i < 11000; i += 1) {
        const rx = padX + Math.random() * cw;
        const ry = padY + Math.random() * ch;
        ctx.fillStyle =
          i % 3 === 0
            ? 'rgba(255, 198, 166, 0.09)'
            : i % 3 === 1
            ? 'rgba(48, 14, 6, 0.11)'
            : 'rgba(184, 72, 40, 0.12)';
        ctx.fillRect(rx, ry, 2.4, 2.4);
      }
    }

    // Roland-Garros drag-mat horizontal sweeping lines & baseline wear patches
    ctx.save();
    ctx.beginPath();
    ctx.rect(padX, padY, cw, ch);
    ctx.clip();
    for (let y = padY; y < padY + ch; y += 6) {
      ctx.fillStyle = (y % 12 === 0) ? 'rgba(255, 206, 178, 0.03)' : 'rgba(38, 10, 4, 0.03)';
      ctx.fillRect(padX, y, cw, 2);
    }
    const baseWearTop = ctx.createRadialGradient(w * 0.5, padY + 14, 6, w * 0.5, padY + 14, cw * 0.36);
    baseWearTop.addColorStop(0, 'rgba(64, 20, 8, 0.22)');
    baseWearTop.addColorStop(1, 'rgba(64, 20, 8, 0.0)');
    ctx.fillStyle = baseWearTop;
    ctx.fillRect(padX, padY, cw, ch * 0.25);

    const baseWearBot = ctx.createRadialGradient(w * 0.5, padY + ch - 16, 6, w * 0.5, padY + ch - 16, cw * 0.38);
    baseWearBot.addColorStop(0, 'rgba(58, 18, 8, 0.24)');
    baseWearBot.addColorStop(1, 'rgba(58, 18, 8, 0.0)');
    ctx.fillStyle = baseWearBot;
    ctx.fillRect(padX, padY + ch * 0.72, cw, ch * 0.28);
    ctx.restore();

    ctx.strokeStyle = 'rgba(222, 224, 218, 0.82)';
    ctx.lineWidth = 4.0;
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

    // Soft clay dust speckles dusted lightly over chalk lines
    ctx.save();
    for (let i = 0; i < 650; i += 1) {
      ctx.fillStyle = 'rgba(176, 72, 42, 0.22)';
      ctx.fillRect(padX + Math.random() * cw, padY + Math.random() * ch, 2, 2);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(12, 6, 4, 0.35)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(padX - 14, h * 0.5 + 4);
    ctx.lineTo(padX + cw + 14, h * 0.5 + 4);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(226, 226, 220, 0.46)';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(padX - 14, h * 0.5);
    ctx.lineTo(padX + cw + 14, h * 0.5);
    ctx.stroke();

    let normalMap;
    let roughnessMap;
    if (photoAssets.clayNor && photoAssets.trackNor && photoAssets.clayRough) {
      const nw = 1024;
      const nh = 1248;
      const baseN = sampleTiledImageData(photoAssets.clayNor, nw, nh, 3, 3.6);
      const trackN = sampleTiledImageData(photoAssets.trackNor, nw, nh, 4.5, 5.4);
      normalMap = blendNormalTexturesData(baseN, trackN, 0.45, nw, nh, false);

      const roughC = makeCanvas(nw, nh);
      const rCtx = roughC.getContext('2d');
      drawTiledImage(rCtx, photoAssets.clayRough, nw, nh, 3, 3.6);
      roughnessMap = toDataTexture(roughC);
    } else {
      const nw = 512;
      const nh = 624;
      const height = new Float32Array(nw * nh);
      const rough = new Float32Array(nw * nh);
      for (let i = 0; i < nw * nh; i += 1) {
        height[i] = 0.5 + (Math.random() - 0.5) * 0.28;
        rough[i] = 0.86 + Math.random() * 0.11;
      }
      normalMap = buildNormalTextureFromHeight(height, nw, nh, 1.5, false);
      roughnessMap = buildRoughnessTextureFromArray(rough, nw, nh, false);
    }

    return {
      map: toSRGBTexture(c),
      normalMap: normalMap,
      roughnessMap: roughnessMap
    };
  }

  function buildHardwoodCourtMaps() {
    const w = 1024;
    const h = 1248;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');

    const roughC = makeCanvas(w, h);
    const rCtx = roughC.getContext('2d');

    if (photoAssets.woodDiff && photoAssets.woodRough) {
      drawTiledImage(ctx, photoAssets.woodDiff, w, h, 3, 3.6);
      // Warm translucent walnut-maple varnish glaze (keeps rich wood grain visible)
      ctx.fillStyle = 'rgba(18, 7, 2, 0.36)';
      ctx.fillRect(0, 0, w, h);

      drawTiledImage(rCtx, photoAssets.woodRough, w, h, 3, 3.6);
      rCtx.fillStyle = 'rgba(42, 42, 42, 0.58)';
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
    floorSpot.addColorStop(0, 'rgba(130, 68, 26, 0.18)');
    floorSpot.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
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

    ctx.strokeStyle = 'rgba(224, 222, 214, 0.82)';
    ctx.lineWidth = 3.8;
    drawLines(ctx);

    // Matte court paint lines in roughness map vs glossy maple planks
    rCtx.strokeStyle = 'rgb(112, 112, 112)';
    rCtx.lineWidth = 4.2;
    drawLines(rCtx);

    let normalMap;
    if (photoAssets.woodNor) {
      const norC = makeCanvas(w, h);
      drawTiledImage(norC.getContext('2d'), photoAssets.woodNor, w, h, 3, 3.6);
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
    const w = 1024;
    const h = 1248;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const roughC = makeCanvas(w, h);
    const rCtx = roughC.getContext('2d');

    if (photoAssets.grassDiff) {
      drawTiledImage(ctx, photoAssets.grassDiff, w, h, 4, 4.8);
      ctx.fillStyle = 'rgba(10, 28, 4, 0.56)';
      ctx.fillRect(0, 0, w, h);

      const stripeCount = 14;
      const stripeH = h / stripeCount;
      for (let i = 0; i < stripeCount; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(74, 134, 34, 0.16)' : 'rgba(4, 16, 2, 0.30)';
        ctx.fillRect(0, i * stripeH, w, stripeH);
      }
    } else {
      const stripeCount = 14;
      const stripeH = h / stripeCount;
      for (let i = 0; i < stripeCount; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? '#1F4010' : '#142B09';
        ctx.fillRect(0, i * stripeH, w, stripeH);
      }
      for (let i = 0; i < 14000; i += 1) {
        const gx = Math.random() * w;
        const gy = Math.random() * h;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(136, 206, 72, 0.11)' : 'rgba(8, 22, 4, 0.16)';
        ctx.fillRect(gx, gy, 2, 4.5);
      }
    }

    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, 160, w * 0.5, h * 0.5, w * 0.92);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.44)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(222, 228, 218, 0.80)';
    ctx.lineWidth = 3.8;

    const padX = w * 0.2;
    const topY = h * 0.2;
    const botY = h * 0.82;
    const pw = w - padX * 2;
    ctx.strokeRect(padX, topY, pw, botY - topY);

    ctx.beginPath();
    ctx.arc(w * 0.5, topY, w * 0.11, 0, Math.PI);
    ctx.stroke();

    ctx.fillStyle = 'rgba(222, 228, 218, 0.80)';
    ctx.beginPath();
    ctx.arc(w * 0.5, topY, 5, 0, Math.PI * 2);
    ctx.fill();

    const boxW = pw * 0.62;
    const boxH = h * 0.17;
    const boxX = (w - boxW) * 0.5;
    ctx.strokeRect(boxX, botY - boxH, boxW, boxH);

    const goalW = pw * 0.28;
    const goalH = h * 0.06;
    ctx.strokeRect((w - goalW) * 0.5, botY - goalH, goalW, goalH);

    const penSpotY = botY - h * 0.115;
    // Slight dark soil wear halo around penalty spot
    const spotWear = ctx.createRadialGradient(w * 0.5, penSpotY, 2, w * 0.5, penSpotY, 26);
    spotWear.addColorStop(0, 'rgba(32, 24, 12, 0.36)');
    spotWear.addColorStop(1, 'rgba(32, 24, 12, 0.0)');
    ctx.fillStyle = spotWear;
    ctx.fillRect(w * 0.5 - 30, penSpotY - 30, 60, 60);

    ctx.fillStyle = 'rgba(222, 228, 218, 0.80)';
    ctx.beginPath();
    ctx.arc(w * 0.5, penSpotY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(w * 0.5, penSpotY, w * 0.1, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();

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
        rCtx.fillStyle = i % 2 === 0 ? 'rgba(180, 180, 180, 0.16)' : 'rgba(245, 245, 245, 0.24)';
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
        const stripeR = stripeIdx % 2 === 0 ? 0.80 : 0.92;
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
      roughnessMap: roughnessMap
    };
  }

  function buildObsidianVaultMaps() {
    // 1024x1248 Honed Dark Obsidian & CNC-Machined Gunmetal Bank-Vault Floor for 04 金条
    const w = 1024;
    const h = 1248;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const rC = makeCanvas(w, h);
    const rCtx = rC.getContext('2d');

    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 48, w * 0.5, h * 0.5, w * 0.88);
    bgGrad.addColorStop(0, '#1C2029');
    bgGrad.addColorStop(0.6, '#0E1117');
    bgGrad.addColorStop(1, '#040507');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    if (photoAssets.metalDiff) {
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.globalCompositeOperation = 'soft-light';
      drawTiledImage(ctx, photoAssets.metalDiff, w, h, 3, 3.6);
      ctx.restore();
    } else {
      for (let i = 0; i < 3600; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(210, 224, 248, 0.028)' : 'rgba(2, 4, 8, 0.045)';
        ctx.fillRect(Math.random() * w * 0.35, Math.random() * h, w * 0.65, 1.2);
      }
    }

    // Subtle architectural vault framing bevel & CNC chamfer groove around interior perimeter
    const insetX = w * 0.21;
    const insetY = h * 0.17;
    const frameW = w - insetX * 2;
    const frameH = h - insetY * 2;

    ctx.strokeStyle = 'rgba(4, 5, 8, 0.78)';
    ctx.lineWidth = 7;
    ctx.strokeRect(insetX, insetY, frameW, frameH);
    ctx.strokeStyle = 'rgba(130, 146, 178, 0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(insetX + 6, insetY + 6, frameW - 12, frameH - 12);

    // Honed obsidian roughness [0.28..0.46]: crisp specular reflections without chrome glare
    rCtx.fillStyle = 'rgb(88, 88, 88)';
    rCtx.fillRect(0, 0, w, h);
    if (photoAssets.metalRough) {
      rCtx.save();
      rCtx.globalAlpha = 0.38;
      drawTiledImage(rCtx, photoAssets.metalRough, w, h, 3, 3.6);
      rCtx.restore();
    }
    rCtx.strokeStyle = 'rgb(54, 54, 54)';
    rCtx.lineWidth = 4;
    rCtx.strokeRect(insetX + 6, insetY + 6, frameW - 12, frameH - 12);

    let normalMap;
    if (photoAssets.metalNor) {
      const norC = makeCanvas(w, h);
      const nCtx = norC.getContext('2d');
      nCtx.fillStyle = 'rgb(128, 128, 255)';
      nCtx.fillRect(0, 0, w, h);
      nCtx.globalAlpha = 0.55;
      drawTiledImage(nCtx, photoAssets.metalNor, w, h, 3, 3.6);
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

    // 1. High-resolution diffuse/refraction map (CanvasTexture, flipY = true)
    const dw = 1024;
    const dh = 1248;
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
    dataTex.anisotropy = 8;
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
    const w = 512;
    const h = 256;
    const diffC = makeCanvas(w, h);
    const dCtx = diffC.getContext('2d');
    const dImg = dCtx.createImageData(w, h);

    const feltDiff = photoAssets.feltDiff ? sampleTiledImageData(photoAssets.feltDiff, w, h, 3, 2).data : null;
    const feltNor = photoAssets.feltNor ? sampleTiledImageData(photoAssets.feltNor, w, h, 3, 2) : null;
    const feltRough = photoAssets.feltRough ? sampleTiledImageData(photoAssets.feltRough, w, h, 3, 2) : null;

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

    const seamSamples = 200;
    const seamPts = [];
    const k = 0.36;
    const norm = 1 + k;
    const cZ = 2 * Math.sqrt(k);
    for (let s = 0; s < seamSamples; s += 1) {
      const t = (s / seamSamples) * Math.PI * 2;
      seamPts.push([
        (Math.cos(t) + k * Math.cos(3 * t)) / norm,
        (Math.sin(t) - k * Math.sin(3 * t)) / norm,
        (cZ * Math.sin(2 * t)) / norm
      ]);
    }

    for (let y = 0; y < h; y += 1) {
      const lat = (0.5 - y / h) * Math.PI;
      const cosLat = Math.cos(lat);
      const ny = Math.sin(lat);

      for (let x = 0; x < w; x += 1) {
        const lon = (x / w - 0.5) * Math.PI * 2;
        const nx = cosLat * Math.cos(lon);
        const nz = cosLat * Math.sin(lon);

        let minD2 = 99;
        for (let s = 0; s < seamSamples; s += 1) {
          const sp = seamPts[s];
          const dx = nx - sp[0];
          const dy = ny - sp[1];
          const dz = nz - sp[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < minD2) minD2 = d2;
        }

        const pIdx = y * w + x;
        const idx = pIdx * 4;

        const photoLuma = feltDiff ? (feltDiff[idx] * 0.5 + feltDiff[idx + 1] * 0.5 - feltMean) * 1.45 : 0;
        const microFuzz = (Math.random() - 0.5) * 0.34;

        if (minD2 < 0.0020) {
          const rubberNoise = (Math.random() - 0.5) * 8;
          dImg.data[idx] = 186 + rubberNoise;
          dImg.data[idx + 1] = 184 + rubberNoise;
          dImg.data[idx + 2] = 174 + rubberNoise;
          dImg.data[idx + 3] = 255;
          height[pIdx] = 0.10 + microFuzz * 0.06;
          rough[pIdx] = 0.74;
        } else if (minD2 < 0.0044) {
          const lip = (minD2 - 0.0020) / 0.0024;
          dImg.data[idx] = Math.round(36 + lip * 76);
          dImg.data[idx + 1] = Math.round(46 + lip * 92);
          dImg.data[idx + 2] = Math.round(5 + lip * 7);
          dImg.data[idx + 3] = 255;
          height[pIdx] = 0.18 + lip * 0.44;
          rough[pIdx] = 0.98;
        } else {
          const tuft = Math.sin(nx * 145 + ny * 98) * Math.cos(nz * 138 - ny * 76) * 0.26;
          const clump = Math.sin(nx * 46 - ny * 52) * Math.cos(nz * 48 + nx * 36) * 0.18;
          const weave = feltDiff
            ? photoLuma + (tuft + clump) * 26 + microFuzz * 22
            : (tuft + clump + microFuzz) * 34;
          dImg.data[idx] = Math.min(255, Math.max(0, Math.round(112 + weave * 0.85)));
          dImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round(138 + weave)));
          dImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round(12 + weave * 0.22)));
          dImg.data[idx + 3] = 255;
          height[pIdx] = 0.62 + microFuzz * 0.58 + tuft * 0.34 + clump * 0.16;
          rough[pIdx] = Math.min(1.0, 0.96 + Math.abs(microFuzz) * 0.12);
        }
      }
    }

    dCtx.putImageData(dImg, 0, 0);
    return {
      map: toSRGBTexture(diffC),
      normalMap: buildNormalTextureFromHeight(height, w, h, 4.4, true, feltNor, 0.78),
      roughnessMap: buildRoughnessTextureFromArray(rough, w, h, true, feltRough, 0.12)
    };
  }

  function buildBasketballMaps() {
    const w = 768;
    const h = 384;
    const diffC = makeCanvas(w, h);
    const dCtx = diffC.getContext('2d');
    const dImg = dCtx.createImageData(w, h);

    const leatherDiff = photoAssets.leatherBrownDiff ? sampleTiledImageData(photoAssets.leatherBrownDiff, w, h, 3, 2).data : null;
    const leatherNor = photoAssets.leatherBrownNor ? sampleTiledImageData(photoAssets.leatherBrownNor, w, h, 3, 2) : null;
    const leatherRough = photoAssets.leatherBrownRough ? sampleTiledImageData(photoAssets.leatherBrownRough, w, h, 3, 2) : null;

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

    for (let y = 0; y < h; y += 1) {
      const lat = (0.5 - y / h) * Math.PI;
      const cosLat = Math.max(0.18, Math.cos(lat));
      const ny = Math.sin(lat);

      for (let x = 0; x < w; x += 1) {
        const lon = (x / w - 0.5) * Math.PI * 2;
        const nx = Math.cos(lat) * Math.cos(lon);
        const nz = Math.cos(lat) * Math.sin(lon);

        const dEq = Math.abs(ny);
        const dMer = Math.abs(nz);
        const dSide = Math.abs(ny) < 0.9 ? Math.abs(Math.abs(nx) - (0.58 - 0.25 * ny * ny)) : 99;
        const channelDist = Math.min(dEq, dMer, dSide);

        const pIdx = y * w + x;
        const idx = pIdx * 4;

        const cellLon = ((lon * cosLat * 56) % 1 + 1) % 1 - 0.5;
        const cellLat = ((lat * 56) % 1 + 1) % 1 - 0.5;
        const pebbleR = Math.hypot(cellLon, cellLat);
        const pebbleDome = pebbleR < 0.43 ? Math.sqrt(Math.max(0, 1 - (pebbleR / 0.43) * (pebbleR / 0.43))) : 0;

        if (channelDist < 0.036) {
          const chGrain = Math.round((Math.random() - 0.5) * 4);
          dImg.data[idx] = Math.max(0, 14 + chGrain);
          dImg.data[idx + 1] = Math.max(0, 13 + chGrain);
          dImg.data[idx + 2] = Math.max(0, 13 + chGrain);
          dImg.data[idx + 3] = 255;
          height[pIdx] = 0.03;
          rough[pIdx] = 0.86;
        } else if (channelDist < 0.056) {
          const bevel = (channelDist - 0.036) / 0.020;
          dImg.data[idx] = Math.round(52 + bevel * 52);
          dImg.data[idx + 1] = Math.round(17 + bevel * 19);
          dImg.data[idx + 2] = Math.round(5 + bevel * 5);
          dImg.data[idx + 3] = 255;
          height[pIdx] = 0.24 + bevel * 0.18 + pebbleDome * 0.12;
          rough[pIdx] = 0.82;
        } else {
          const photoShift = leatherDiff ? (leatherDiff[idx] - leatherMean) * 0.42 : 0;
          const hidePatina = Math.sin(nx * 14 + ny * 11) * Math.cos(nz * 13 - nx * 9) * 7;
          const grain = (Math.random() - 0.5) * 7;
          // Deep micro-AO in inter-pebble valleys (0.48) rising to rich burnt saddle-leather crowns (1.0)
          const pebbleAO = 0.48 + 0.52 * Math.pow(pebbleDome, 0.75);
          const baseR = 152 * pebbleAO + photoShift * 0.85 + hidePatina + grain;
          const baseG = 54 * pebbleAO + photoShift * 0.36 + hidePatina * 0.42 + grain * 0.45;
          const baseB = 14 * pebbleAO + photoShift * 0.14 + grain * 0.2;
          dImg.data[idx] = Math.min(255, Math.max(0, Math.round(baseR)));
          dImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round(baseG)));
          dImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round(baseB)));
          dImg.data[idx + 3] = 255;
          height[pIdx] = 0.36 + pebbleDome * 0.64;
          // Satin worn leather pebble crowns (0.56) vs deeply matte crevices (0.90)
          rough[pIdx] = 0.90 - pebbleDome * 0.34;
        }
      }
    }

    dCtx.putImageData(dImg, 0, 0);
    return {
      map: toSRGBTexture(diffC),
      normalMap: buildNormalTextureFromHeight(height, w, h, 4.4, true, leatherNor, 0.48),
      roughnessMap: buildRoughnessTextureFromArray(rough, w, h, true, leatherRough, 0.25)
    };
  }

  function buildSoccerBallMaps() {
    const w = 768;
    const h = 384;
    const diffC = makeCanvas(w, h);
    const dCtx = diffC.getContext('2d');
    const dImg = dCtx.createImageData(w, h);

    const leatherDiff = photoAssets.leatherWhiteDiff ? sampleTiledImageData(photoAssets.leatherWhiteDiff, w, h, 3, 2).data : null;
    const leatherNor = photoAssets.leatherWhiteNor ? sampleTiledImageData(photoAssets.leatherWhiteNor, w, h, 3, 2) : null;
    const leatherRough = photoAssets.leatherWhiteRough ? sampleTiledImageData(photoAssets.leatherWhiteRough, w, h, 3, 2) : null;

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

    const phi = (1 + Math.sqrt(5)) * 0.5;
    const rawV = [
      [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
      [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
      [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
    ];
    const verts = rawV.map(function (v) {
      const len = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / len, v[1] / len, v[2] / len];
    });

    const faces = [];
    for (let i = 0; i < 12; i += 1) {
      for (let j = i + 1; j < 12; j += 1) {
        const dotIJ = verts[i][0] * verts[j][0] + verts[i][1] * verts[j][1] + verts[i][2] * verts[j][2];
        if (dotIJ < 0.35) continue;
        for (let k = j + 1; k < 12; k += 1) {
          const dotIK = verts[i][0] * verts[k][0] + verts[i][1] * verts[k][1] + verts[i][2] * verts[k][2];
          const dotJK = verts[j][0] * verts[k][0] + verts[j][1] * verts[k][1] + verts[j][2] * verts[k][2];
          if (dotIK > 0.35 && dotJK > 0.35) {
            const fx = verts[i][0] + verts[j][0] + verts[k][0];
            const fy = verts[i][1] + verts[j][1] + verts[k][1];
            const fz = verts[i][2] + verts[j][2] + verts[k][2];
            const fl = Math.hypot(fx, fy, fz);
            faces.push([fx / fl, fy / fl, fz / fl]);
          }
        }
      }
    }

    for (let y = 0; y < h; y += 1) {
      const lat = (0.5 - y / h) * Math.PI;
      const cosLat = Math.max(0.08, Math.cos(lat));
      const ny = Math.sin(lat);

      for (let x = 0; x < w; x += 1) {
        const lon = (x / w - 0.5) * Math.PI * 2;
        const nx = cosLat * Math.cos(lon);
        const nz = cosLat * Math.sin(lon);

        let bestV = -1;
        for (let i = 0; i < verts.length; i += 1) {
          const d = nx * verts[i][0] + ny * verts[i][1] + nz * verts[i][2];
          if (d > bestV) bestV = d;
        }

        let bestF = -1;
        let secondF = -1;
        for (let i = 0; i < faces.length; i += 1) {
          const d = nx * faces[i][0] + ny * faces[i][1] + nz * faces[i][2];
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
        const isSeam = edgeDist < 0.013;

        const pIdx = y * w + x;
        const idx = pIdx * 4;
        const photoShift = leatherDiff ? (leatherDiff[idx] - leatherWhiteMean) * 0.42 : 0;
        const cushion = Math.min(1.0, edgeDist / 0.068);
        const pillow = Math.pow(cushion, 0.50);
        const panelAO = 0.56 + 0.44 * pillow;
        const microGrain = (Math.random() - 0.5) * 6;

        // Pro match-ball micro-dimple surface cell
        const dimpLon = ((lon * cosLat * 76) % 1 + 1) % 1 - 0.5;
        const dimpLat = ((lat * 76) % 1 + 1) % 1 - 0.5;
        const dimpD = Math.hypot(dimpLon, dimpLat);
        const dimple = dimpD < 0.34 ? -0.055 * (1 - dimpD / 0.34) : 0.015;

        if (isSeam) {
          const stitch = Math.sin((nx + ny + nz) * 210) > 0.25;
          dImg.data[idx] = stitch ? 46 : 12;
          dImg.data[idx + 1] = stitch ? 44 : 12;
          dImg.data[idx + 2] = stitch ? 40 : 14;
          dImg.data[idx + 3] = 255;
          height[pIdx] = stitch ? 0.24 : 0.05;
          rough[pIdx] = 0.94;
        } else if (isPentagon) {
          const pentAO = 0.64 + 0.36 * pillow;
          const base = Math.max(8, Math.round((24 + photoShift * 0.24 + dimple * 16 + microGrain * 0.5) * pentAO));
          dImg.data[idx] = base;
          dImg.data[idx + 1] = base + 1;
          dImg.data[idx + 2] = base + 3;
          dImg.data[idx + 3] = 255;
          height[pIdx] = 0.26 + pillow * 0.70 + dimple;
          rough[pIdx] = Math.min(0.92, 0.50 + (1.0 - pillow) * 0.24 - dimple * 0.8);
        } else {
          const rawTone = (186 + photoShift * 0.55 + dimple * 28 + microGrain) * panelAO;
          const base = Math.min(212, Math.max(76, Math.round(rawTone)));
          dImg.data[idx] = base;
          dImg.data[idx + 1] = Math.max(72, base - 4);
          dImg.data[idx + 2] = Math.max(66, base - 13);
          dImg.data[idx + 3] = 255;
          height[pIdx] = 0.26 + pillow * 0.70 + dimple;
          rough[pIdx] = Math.min(0.90, 0.46 + (1.0 - pillow) * 0.24 - dimple * 0.8);
        }
      }
    }

    dCtx.putImageData(dImg, 0, 0);
    return {
      map: toSRGBTexture(diffC),
      normalMap: buildNormalTextureFromHeight(height, w, h, 4.0, true, leatherNor, 0.46),
      roughnessMap: buildRoughnessTextureFromArray(rough, w, h, true, leatherRough, 0.26)
    };
  }

  function buildGoldIngotMaps() {
    const w = 1024;
    const h = 512;
    const diffC = makeCanvas(w, h);
    const dCtx = diffC.getContext('2d');

    const metalNor = photoAssets.metalNor ? sampleTiledImageData(photoAssets.metalNor, w, h, 2, 1) : null;
    const metalRough = photoAssets.metalRough ? sampleTiledImageData(photoAssets.metalRough, w, h, 2, 1) : null;

    const stampC = makeCanvas(w, h);
    const sCtx = stampC.getContext('2d');

    const grad = dCtx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FFE888');
    grad.addColorStop(0.45, '#F2B830');
    grad.addColorStop(1, '#CE8B15');
    dCtx.fillStyle = grad;
    dCtx.fillRect(0, 0, w, h);

    if (photoAssets.metalDiff) {
      dCtx.save();
      dCtx.globalAlpha = 0.32;
      dCtx.globalCompositeOperation = 'soft-light';
      drawTiledImage(dCtx, photoAssets.metalDiff, w, h, 2, 1);
      dCtx.restore();
    } else {
      for (let i = 0; i < 2400; i += 1) {
        dCtx.fillStyle = i % 2 === 0 ? 'rgba(255, 252, 224, 0.065)' : 'rgba(110, 62, 4, 0.05)';
        dCtx.fillRect(Math.random() * w * 0.35, Math.random() * h, w * 0.65, 1);
      }
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
    dCtx.globalAlpha = 0.64;
    dCtx.strokeStyle = 'rgba(58, 28, 2, 1)';
    dCtx.lineWidth = 14;
    dCtx.strokeRect(72, 52, w - 144, h - 104);
    dCtx.lineWidth = 6;
    dCtx.strokeRect(96, 76, w - 192, h - 152);
    dCtx.lineWidth = 5;
    dCtx.strokeRect(132, 108, 128, 72);

    // Subtle specular bevel catchline on upper-left rim of inner stamped frame
    dCtx.strokeStyle = 'rgba(255, 244, 188, 0.55)';
    dCtx.lineWidth = 2.5;
    dCtx.beginPath();
    dCtx.moveTo(98, h - 78);
    dCtx.lineTo(98, 78);
    dCtx.lineTo(w - 98, 78);
    dCtx.stroke();

    dCtx.fillStyle = 'rgba(54, 26, 2, 1)';
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

    for (let y = 0; y < h; y += 1) {
      const brushLine = (Math.random() - 0.5) * 0.025 + Math.sin(y * 0.42) * 0.012;
      const v = y / h;
      const inYBorder = v < 0.095 || v > 0.905;
      for (let x = 0; x < w; x += 1) {
        const u = x / w;
        const inBorder = inYBorder || u < 0.068 || u > 0.932;
        const pIdx = y * w + x;
        const stampVal = sData[pIdx * 4] / 255;
        height[pIdx] = 0.28 + stampVal * 0.56 + brushLine;
        if (inBorder) {
          // Mirror-lapped outer gold chamfer & bevels
          rough[pIdx] = 0.065 + Math.abs(brushLine) * 0.5;
        } else if (stampVal < 0.7) {
          // Matte frosted engraved crevices
          rough[pIdx] = 0.46;
        } else {
          // Satin micro-brushed ingot face
          rough[pIdx] = 0.155 + Math.abs(brushLine) * 0.95;
        }
      }
    }

    return {
      map: toSRGBTexture(diffC),
      normalMap: buildNormalTextureFromHeight(height, w, h, 3.0, false, metalNor, 0.35),
      roughnessMap: buildRoughnessTextureFromArray(rough, w, h, false, metalRough, 0.18),
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

  ns.WATCH_THEMES = WATCH_THEMES;
  ns.THEME_ORDER = THEME_ORDER;
  ns.VELVET_PRESETS = VELVET_PRESETS;
  ns.SoundFX = SoundFX;
  ns.PreviewIcons = buildPreviewIcons();

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
          const pmrem = new THREE.PMREMGenerator(renderer);
          pmrem.compileEquirectangularShader();
          const rt = pmrem.fromEquirectangular(hdrTex);
          hdrTex.dispose();
          pmrem.dispose();
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
      rubberNor: 'assets/textures/rubber/nor_gl.jpg',
      rubberRough: 'assets/textures/rubber/rough.jpg'
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
})(window);

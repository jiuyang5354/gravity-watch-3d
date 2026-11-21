(function (global) {
  'use strict';

  const ns = global.GravityWatch;
  const WATCH_THEMES = ns.WATCH_THEMES;
  const THEME_ORDER = ns.THEME_ORDER;
  const PreviewIcons = ns.PreviewIcons;
  const SoundFX = ns.SoundFX;
  const PhysicsWorld3D = ns.PhysicsWorld3D;
  const Scene3D = ns.Scene3D;

  const NEUTRAL_PITCH = 0.82; // ~47° comfortable wrist viewing angle
  const NEUTRAL_ROLL = 0.0;

  const appState = {
    themeId: 'tennis',
    densityPreset: 'cinematic',
    customBodyCount: null,
    grassDensity: 'balanced',
    clockMode: 'live',
    complicationsMode: 'auto',
    tiltMode: 'drag',
    caseVariant: 'series10',
    hdriPreset: 'studio09',
    aodMode: false,
    cleanRecord: false,
    n8aoEnabled: true,
    tennisFuzzEnabled: true,
    autoLevel: false,
    settingsOpen: false,
    tweaksOpen: false,
    targetPitch: NEUTRAL_PITCH,
    targetRoll: NEUTRAL_ROLL,
    smoothPitch: NEUTRAL_PITCH,
    smoothRoll: NEUTRAL_ROLL,
    smoothRotX: Math.sin(NEUTRAL_PITCH) * 0.28,
    smoothRotY: 0,
    smoothRotZ: 0,
    smoothGravity: { x: 0, y: -Math.sin(NEUTRAL_PITCH), z: -Math.cos(NEUTRAL_PITCH) },
    hudDateText: 'FRI 20',
    hudTimeText: '10:09',
    isPointerDragging: false,
    canvasDownX: 0,
    canvasDownY: 0,
    canvasDownHit: null,
    lastPointerX: 0,
    lastPointerY: 0,
    lastDx: 0,
    lastDy: 0,
    gyroActive: false
  };

  const els = {
    posterCard: document.getElementById('posterCard'),
    watchStage: document.getElementById('watchStage'),
    watchCanvasWrap: document.getElementById('watchCanvasWrap'),
    watchUiOverlay: document.getElementById('watchUiOverlay'),
    canvas: document.getElementById('webglCanvas'),
    watchDate: document.getElementById('watchDate'),
    watchTime: document.getElementById('watchTime'),
    gravityTelemetry: document.getElementById('gravityTelemetry'),
    tiltIndicator: document.getElementById('tiltIndicator'),
    tiltDot: document.getElementById('tiltDot'),
    pullMeBtn: document.getElementById('pullMeBtn'),
    watchSettingsBtn: document.getElementById('watchSettingsBtn'),
    watchSettingsSheet: document.getElementById('watchSettingsSheet'),
    sheetCloseBtn: document.getElementById('sheetCloseBtn'),
    sheetList: document.getElementById('sheetList'),
    stampSwitcher: document.getElementById('stampSwitcher'),
    quickTiltModeBtn: document.getElementById('quickTiltModeBtn'),
    quickTiltModeLabel: document.getElementById('quickTiltModeLabel'),
    gyroBtn: document.getElementById('gyroBtn'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    tweaksToggleBtn: document.getElementById('tweaksToggleBtn'),
    tweaksPanel: document.getElementById('tweaksPanel'),
    tweaksCloseBtn: document.getElementById('tweaksCloseBtn'),
    densityPresetSelect: document.getElementById('densityPresetSelect'),
    bodyCountRange: document.getElementById('bodyCountRange'),
    bodyCountVal: document.getElementById('bodyCountVal'),
    grassDensitySelect: document.getElementById('grassDensitySelect'),
    perfStatsText: document.getElementById('perfStatsText'),
    clockModeSelect: document.getElementById('clockModeSelect'),
    caseSelect: document.getElementById('caseSelect'),
    hdriSelect: document.getElementById('hdriSelect'),
    toneMappingSelect: document.getElementById('toneMappingSelect'),
    physicsEngineSelect: document.getElementById('physicsEngineSelect'),
    velvetColorSelect: document.getElementById('velvetColorSelect'),
    tiltModeSelect: document.getElementById('tiltModeSelect'),
    complicationsSelect: document.getElementById('complicationsSelect'),
    parallaxRange: document.getElementById('parallaxRange'),
    parallaxVal: document.getElementById('parallaxVal'),
    bloomRange: document.getElementById('bloomRange'),
    bloomVal: document.getElementById('bloomVal'),
    trailRange: document.getElementById('trailRange'),
    trailVal: document.getElementById('trailVal'),
    restitutionRange: document.getElementById('restitutionRange'),
    restitutionVal: document.getElementById('restitutionVal'),
    frictionRange: document.getElementById('frictionRange'),
    frictionVal: document.getElementById('frictionVal'),
    airDragRange: document.getElementById('airDragRange'),
    airDragVal: document.getElementById('airDragVal'),
    gravityRange: document.getElementById('gravityRange'),
    gravityVal: document.getElementById('gravityVal'),
    n8aoCheck: document.getElementById('n8aoCheck'),
    tennisFuzzCheck: document.getElementById('tennisFuzzCheck'),
    autoLevelCheck: document.getElementById('autoLevelCheck'),
    aodCheck: document.getElementById('aodCheck'),
    cleanRecordCheck: document.getElementById('cleanRecordCheck'),
    resetDefaultsBtn: document.getElementById('resetDefaultsBtn')
  };

  const initW = els.watchCanvasWrap.clientWidth || 396;
  const initH = els.watchCanvasWrap.clientHeight || 456;
  const scene3d = new Scene3D(els.canvas, initW, initH);

  const world3d = new PhysicsWorld3D({
    width: 4.0,
    height: 4.88,
    depth: 1.08,
    cornerRadius: 0.72,
    onCollision: function (speed) {
      SoundFX.playCollision(speed, appState.themeId);
    }
  });

  function isComplicationsVisible() {
    const theme = WATCH_THEMES[appState.themeId];
    if (appState.complicationsMode === 'show') return true;
    if (appState.complicationsMode === 'hide') return false;
    return Boolean(theme.isLuxury);
  }

  function syncHUD() {
    const theme = WATCH_THEMES[appState.themeId];
    scene3d.updateHUD({
      dateText: appState.hudDateText,
      timeText: appState.hudTimeText,
      showComplications: isComplicationsVisible(),
      aodMode: appState.aodMode,
      accentColor: theme.accentColor
    });
  }

  function updateClock() {
    const theme = WATCH_THEMES[appState.themeId];
    if (appState.clockMode === 'appleDemo') {
      if (theme.isLuxury) {
        appState.hudDateText = 'MON 6';
        appState.hudTimeText = '9:41';
      } else {
        appState.hudDateText = 'WED 12';
        appState.hudTimeText = '10:09';
      }
    } else {
      const now = new Date();
      const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      appState.hudDateText = weekdays[now.getDay()] + ' ' + now.getDate();

      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      appState.hudTimeText = hours + ':' + minutes;
    }

    els.watchDate.textContent = appState.hudDateText;
    els.watchTime.textContent = appState.hudTimeText;
    syncHUD();
  }

  function syncRestitutionDisplay() {
    const eff = world3d.getEffectiveRestitution();
    els.restitutionRange.value = eff.toFixed(2);
    els.restitutionVal.textContent = eff.toFixed(2);
  }

  function buildInWatchSheet() {
    els.sheetList.innerHTML = '';

    THEME_ORDER.forEach(function (themeId) {
      const theme = WATCH_THEMES[themeId];
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'sheet-item' + (themeId === appState.themeId ? ' is-selected' : '');
      itemBtn.setAttribute('data-theme', themeId);

      const icon = document.createElement('img');
      icon.className = 'sheet-item-icon';
      icon.src = PreviewIcons[themeId];
      icon.alt = theme.name;

      const copy = document.createElement('span');
      copy.className = 'sheet-item-copy';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'sheet-item-name';
      nameSpan.textContent = theme.name;

      const subSpan = document.createElement('span');
      subSpan.className = 'sheet-item-sub';
      subSpan.textContent = theme.subtitle;

      copy.appendChild(nameSpan);
      copy.appendChild(subSpan);

      const check = document.createElement('span');
      check.className = 'sheet-check';
      check.innerHTML =
        '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

      itemBtn.appendChild(icon);
      itemBtn.appendChild(copy);
      itemBtn.appendChild(check);

      itemBtn.addEventListener('click', function () {
        applySceneTheme(themeId, true);
        setWatchSettingsOpen(false);
      });

      els.sheetList.appendChild(itemBtn);
    });
  }

  function getTargetBodyCount(theme) {
    if (Number.isInteger(appState.customBodyCount) && appState.customBodyCount >= 6) {
      return appState.customBodyCount;
    }
    if (appState.densityPreset === 'lite') {
      return theme.liteCount || 8;
    }
    if (appState.densityPreset === 'dense40') {
      return theme.promptCount;
    }
    return theme.cinematicCount;
  }

  function rebuildPhysicsAndScene() {
    const theme = WATCH_THEMES[appState.themeId];
    const mode =
      appState.themeId === 'goldBar'
        ? 'goldBar'
        : appState.themeId === 'diamond'
        ? 'diamond'
        : 'sphere';
    const count = getTargetBodyCount(theme);

    if (els.bodyCountRange && els.bodyCountVal) {
      els.bodyCountRange.value = String(count);
      els.bodyCountVal.textContent = String(count);
    }

    world3d.configure(mode, count, appState.themeId);
    scene3d.rebuildBodies(appState.themeId, world3d.bodies);
    syncRestitutionDisplay();
    updatePerfStripNow();
  }

  function applySceneTheme(themeId, shouldPop) {
    if (!WATCH_THEMES[themeId]) return;
    const changed = appState.themeId !== themeId;
    appState.themeId = themeId;

    document.documentElement.style.setProperty(
      '--accent-color',
      WATCH_THEMES[themeId].accentColor
    );

    const stampButtons = els.stampSwitcher.querySelectorAll('.stamp-btn');
    stampButtons.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-theme') === themeId);
    });

    const sheetItems = els.sheetList.querySelectorAll('.sheet-item');
    sheetItems.forEach(function (item) {
      item.classList.toggle('is-selected', item.getAttribute('data-theme') === themeId);
    });

    rebuildPhysicsAndScene();
    updateClock();
    syncHUD();

    if (changed) {
      scene3d.spinCrown(1.05);
      SoundFX.playClick();
      if (shouldPop !== false) {
        world3d.applyThemePop();
      }
    }
  }

  function setCaseVariant(variant) {
    appState.caseVariant = variant || 'series10';
    els.caseSelect.value = appState.caseVariant;
    document.body.setAttribute('data-case', appState.caseVariant);
    scene3d.setCaseVariant(appState.caseVariant);
  }

  function setStudioHDRI(presetId) {
    appState.hdriPreset = presetId || 'studio09';
    els.hdriSelect.value = appState.hdriPreset;
    scene3d.setStudioHDRI(appState.hdriPreset);
  }

  function setWatchSettingsOpen(open) {
    appState.settingsOpen = Boolean(open);
    els.watchSettingsSheet.classList.toggle('is-open', appState.settingsOpen);
    els.watchSettingsSheet.setAttribute('aria-hidden', String(!appState.settingsOpen));
    SoundFX.playClick();
  }

  function updatePerfStripNow() {
    if (!appState.tweaksOpen || !els.perfStatsText || typeof scene3d.getPerfStats !== 'function') return;
    const st = scene3d.getPerfStats();
    const grassPart = st.grassBlades > 0 ? ' · ' + st.grassBlades.toLocaleString() + ' 草叶' : '';
    const n8aoPart = st.n8ao ? ' · N8AO' : '';
    const fuzzPart = st.fuzz ? ' · ShellFur' : '';
    els.perfStatsText.textContent =
      Math.round(lastMeasuredFps) + ' FPS (' + lastAvgFrameMs.toFixed(1) + 'ms) · ' + st.bodies + ' 物体' + grassPart + n8aoPart + fuzzPart;
  }

  function setTweaksOpen(open) {
    appState.tweaksOpen = Boolean(open);
    els.tweaksPanel.classList.toggle('is-open', appState.tweaksOpen);
    els.tweaksPanel.setAttribute('aria-hidden', String(!appState.tweaksOpen));
    els.tweaksToggleBtn.setAttribute('aria-expanded', String(appState.tweaksOpen));
    if (appState.tweaksOpen) {
      updatePerfStripNow();
    }
  }

  function setTiltMode(mode) {
    appState.tiltMode = mode;
    els.tiltModeSelect.value = mode;
    els.quickTiltModeBtn.classList.toggle('is-orbit', mode === 'orbit');
    if (mode === 'orbit') {
      els.quickTiltModeLabel.textContent = '自动摇摆中';
    } else if (mode === 'hover') {
      els.quickTiltModeLabel.textContent = '悬停倾斜';
    } else {
      els.quickTiltModeLabel.textContent = '拖拽倾斜';
    }
  }

  function setAODMode(enabled) {
    appState.aodMode = Boolean(enabled);
    els.aodCheck.checked = appState.aodMode;
    els.watchUiOverlay.classList.toggle('is-aod', appState.aodMode);
    syncHUD();
  }

  function setCleanRecordMode(enabled) {
    appState.cleanRecord = Boolean(enabled);
    els.cleanRecordCheck.checked = appState.cleanRecord;
    document.body.classList.toggle('is-clean-record', appState.cleanRecord);
  }

  function resetGimbalToNeutral() {
    appState.targetPitch = NEUTRAL_PITCH;
    appState.targetRoll = NEUTRAL_ROLL;
  }

  function setGimbalFromHover(clientX, clientY) {
    const rect = els.watchStage.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const normR = Math.max(rect.width * 0.45, 140);

    const nx = Math.max(-1, Math.min(1, (clientX - cx) / normR));
    const ny = Math.max(-1, Math.min(1, (clientY - cy) / normR));

    appState.targetRoll = nx * 1.15;
    appState.targetPitch = ny * 1.15;
  }

  function clampGimbal() {
    appState.targetPitch = Math.max(-1.35, Math.min(1.48, appState.targetPitch));
    appState.targetRoll = Math.max(-1.42, Math.min(1.42, appState.targetRoll));
  }

  function triggerShake() {
    els.pullMeBtn.classList.add('is-pulled');
    setTimeout(function () {
      els.pullMeBtn.classList.remove('is-pulled');
    }, 240);

    world3d.shake();
    SoundFX.playShake();
  }

  function resetDefaults() {
    appState.densityPreset = 'cinematic';
    appState.customBodyCount = null;
    appState.grassDensity = 'balanced';
    appState.clockMode = 'live';
    appState.complicationsMode = 'auto';
    appState.autoLevel = false;
    scene3d.parallaxStrength = 1.0;

    world3d.restitutionOverride = null;
    world3d.frictionScale = 1.0;
    world3d.airDragScale = 1.0;
    world3d.gravityScale = 1.0;

    els.densityPresetSelect.value = 'cinematic';
    if (els.grassDensitySelect && typeof scene3d.setGrassDensity === 'function') {
      els.grassDensitySelect.value = 'balanced';
      scene3d.setGrassDensity('balanced');
    }
    els.clockModeSelect.value = 'live';
    els.complicationsSelect.value = 'auto';
    els.parallaxRange.value = '1.0';
    els.parallaxVal.textContent = '1.0×';
    if (els.bloomRange && els.bloomVal && typeof scene3d.setBloomStrength === 'function') {
      els.bloomRange.value = '0.06';
      els.bloomVal.textContent = '0.06';
      scene3d.setBloomStrength(0.06);
    }
    if (els.trailRange && els.trailVal && typeof scene3d.setTrailStrength === 'function') {
      els.trailRange.value = '1.0';
      els.trailVal.textContent = '1.0×';
      scene3d.setTrailStrength(1.0);
    }
    if (els.toneMappingSelect && typeof scene3d.setToneMapping === 'function') {
      els.toneMappingSelect.value = 'neutral';
      scene3d.setToneMapping('neutral');
    }
    if (els.physicsEngineSelect && typeof world3d.setEngineMode === 'function') {
      const targetEngine = global.RAPIER ? 'rapier' : 'analytic';
      els.physicsEngineSelect.value = targetEngine;
      world3d.setEngineMode(targetEngine);
    }
    els.frictionRange.value = '1.0';
    els.frictionVal.textContent = '1.0×';
    els.airDragRange.value = '1.0';
    els.airDragVal.textContent = '1.0×';
    els.gravityRange.value = '1.0';
    els.gravityVal.textContent = '1.0×';
    appState.n8aoEnabled = true;
    appState.tennisFuzzEnabled = true;
    if (els.n8aoCheck && typeof scene3d.setN8AOEnabled === 'function') {
      els.n8aoCheck.checked = true;
      scene3d.setN8AOEnabled(true);
    }
    if (els.tennisFuzzCheck && typeof scene3d.setTennisFuzzEnabled === 'function') {
      els.tennisFuzzCheck.checked = true;
      scene3d.setTennisFuzzEnabled(true);
    }
    els.autoLevelCheck.checked = false;

    setCaseVariant('series10');
    setStudioHDRI('studio09');
    if (els.velvetColorSelect) {
      els.velvetColorSelect.value = 'obsidian';
      scene3d.setVelvetPreset('obsidian');
    }
    setAODMode(false);
    setCleanRecordMode(false);
    resetGimbalToNeutral();
    setTiltMode('drag');
    rebuildPhysicsAndScene();
    updateClock();
    syncHUD();
    SoundFX.playClick();
  }

  function bindEvents() {
    let longPressTimer = null;
    const cancelLongPress = function () {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    // Raycasted 3D hardware interaction + relative 3D gimbal drag
    els.posterCard.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button') || appState.settingsOpen) return;

      const hitTag =
        e.target === els.canvas ? scene3d.hitTestHardware(e.clientX, e.clientY) : null;
      appState.canvasDownX = e.clientX;
      appState.canvasDownY = e.clientY;
      appState.canvasDownHit = hitTag;

      if (hitTag === 'screen') {
        longPressTimer = setTimeout(function () {
          setWatchSettingsOpen(true);
          appState.isPointerDragging = false;
        }, 450);
      }

      appState.isPointerDragging = true;
      appState.lastPointerX = e.clientX;
      appState.lastPointerY = e.clientY;
      appState.lastDx = 0;
      appState.lastDy = 0;
      els.tiltIndicator.classList.add('is-active');
      if (appState.tiltMode === 'orbit') {
        setTiltMode('drag');
      }
    });

    els.posterCard.addEventListener('dblclick', function (e) {
      if (e.target.closest('button') || appState.settingsOpen) return;
      resetGimbalToNeutral();
      SoundFX.playClick();
    });

    let lastHoverHitMs = 0;
    let lastCursorVal = '';
    global.addEventListener('pointermove', function (e) {
      if (appState.isPointerDragging) {
        if (Math.hypot(e.clientX - appState.canvasDownX, e.clientY - appState.canvasDownY) > 6) {
          cancelLongPress();
        }

        const dx = e.clientX - appState.lastPointerX;
        const dy = e.clientY - appState.lastPointerY;
        appState.lastPointerX = e.clientX;
        appState.lastPointerY = e.clientY;

        appState.targetRoll += dx * 0.0085;
        appState.targetPitch += dy * 0.0085;
        clampGimbal();

        const jerkX = dx - appState.lastDx;
        const jerkY = dy - appState.lastDy;
        appState.lastDx = dx;
        appState.lastDy = dy;

        if (Math.hypot(jerkX, jerkY) > 6) {
          const ax = Math.max(-0.9, Math.min(0.9, jerkX * 0.025));
          const ay = Math.max(-0.9, Math.min(0.9, -jerkY * 0.025));
          const az = Math.min(0.6, Math.hypot(jerkX, jerkY) * 0.012);
          world3d.applyInertialAcceleration(ax, ay, az);
        }
      } else {
        if (!appState.settingsOpen && e.target === els.canvas) {
          const nowMs = global.performance ? global.performance.now() : Date.now();
          if (nowMs - lastHoverHitMs > 48) {
            lastHoverHitMs = nowMs;
            const hoverHit = scene3d.hitTestHardware(e.clientX, e.clientY);
            const nextCursor =
              hoverHit === 'crown' || hoverHit === 'sideButton' || hoverHit === 'actionButton'
                ? 'pointer'
                : '';
            if (nextCursor !== lastCursorVal) {
              lastCursorVal = nextCursor;
              els.canvas.style.cursor = nextCursor;
            }
          }
        } else if (lastCursorVal !== '') {
          lastCursorVal = '';
          els.canvas.style.cursor = '';
        }

        if (appState.tiltMode === 'hover' && !appState.settingsOpen) {
          setGimbalFromHover(e.clientX, e.clientY);
        }
      }
    });

    global.addEventListener('pointerup', function (e) {
      cancelLongPress();
      if (!appState.isPointerDragging) return;
      appState.isPointerDragging = false;
      els.tiltIndicator.classList.remove('is-active');

      const moveDist = Math.hypot(e.clientX - appState.canvasDownX, e.clientY - appState.canvasDownY);
      const hitTag = appState.canvasDownHit;
      appState.canvasDownHit = null;

      if (moveDist < 6 && !appState.settingsOpen) {
        if (hitTag === 'crown') {
          const idx = THEME_ORDER.indexOf(appState.themeId);
          applySceneTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length], true);
          return;
        }
        if (hitTag === 'sideButton') {
          setAODMode(!appState.aodMode);
          SoundFX.playClick();
          return;
        }
        if (hitTag === 'actionButton') {
          triggerShake();
          return;
        }
      }

      if (appState.autoLevel) {
        resetGimbalToNeutral();
      }
    });

    els.canvas.addEventListener(
      'wheel',
      function (e) {
        if (appState.settingsOpen) return;
        const hit = scene3d.hitTestHardware(e.clientX, e.clientY);
        if (hit === 'crown') {
          e.preventDefault();
          const idx = THEME_ORDER.indexOf(appState.themeId);
          const dir = e.deltaY > 0 ? 1 : -1;
          const nextIdx = (idx + dir + THEME_ORDER.length) % THEME_ORDER.length;
          applySceneTheme(THEME_ORDER[nextIdx], true);
        }
      },
      { passive: false }
    );

    els.watchSettingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setWatchSettingsOpen(true);
    });

    els.sheetCloseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setWatchSettingsOpen(false);
    });

    els.stampSwitcher.addEventListener('click', function (e) {
      const btn = e.target.closest('.stamp-btn');
      if (!btn) return;
      applySceneTheme(btn.getAttribute('data-theme'), true);
    });

    els.pullMeBtn.addEventListener('click', triggerShake);

    els.quickTiltModeBtn.addEventListener('click', function () {
      const nextMode = appState.tiltMode === 'orbit' ? 'drag' : 'orbit';
      setTiltMode(nextMode);
      SoundFX.playClick();
    });

    els.soundToggleBtn.addEventListener('click', function () {
      const next = !SoundFX.isEnabled();
      SoundFX.setEnabled(next);
      els.soundToggleBtn.setAttribute('aria-checked', String(next));
    });

    if (typeof global.DeviceOrientationEvent !== 'undefined') {
      const hasTilt = 'ontouchstart' in global || navigator.maxTouchPoints > 0;
      if (hasTilt) {
        els.gyroBtn.classList.remove('is-hidden');
      }

      const handleOrientation = function (event) {
        if (!appState.gyroActive) return;
        const gamma = Math.max(-75, Math.min(75, event.gamma || 0));
        const beta = Math.max(-75, Math.min(75, event.beta || 0));
        appState.targetRoll = (gamma * Math.PI) / 180;
        appState.targetPitch = (beta * Math.PI) / 180;
        clampGimbal();
      };

      els.gyroBtn.addEventListener('click', function () {
        if (typeof global.DeviceOrientationEvent.requestPermission === 'function') {
          global.DeviceOrientationEvent.requestPermission()
            .then(function (state) {
              if (state === 'granted') {
                appState.gyroActive = !appState.gyroActive;
                els.gyroBtn.classList.toggle('is-active', appState.gyroActive);
                global.addEventListener('deviceorientation', handleOrientation);
              }
            })
            .catch(function () {});
        } else {
          appState.gyroActive = !appState.gyroActive;
          els.gyroBtn.classList.toggle('is-active', appState.gyroActive);
          global.addEventListener('deviceorientation', handleOrientation);
        }
      });
    }

    els.tweaksToggleBtn.addEventListener('click', function () {
      setTweaksOpen(!appState.tweaksOpen);
    });

    els.tweaksCloseBtn.addEventListener('click', function () {
      setTweaksOpen(false);
    });

    els.densityPresetSelect.addEventListener('change', function (e) {
      appState.densityPreset = e.target.value;
      appState.customBodyCount = null;
      rebuildPhysicsAndScene();
      SoundFX.playClick();
    });

    if (els.bodyCountRange && els.bodyCountVal) {
      els.bodyCountRange.addEventListener('input', function (e) {
        const val = parseInt(e.target.value, 10);
        if (!Number.isFinite(val)) return;
        appState.customBodyCount = Math.max(6, Math.min(32, val));
        els.bodyCountVal.textContent = String(appState.customBodyCount);
        rebuildPhysicsAndScene();
      });
    }

    if (els.grassDensitySelect) {
      els.grassDensitySelect.addEventListener('change', function (e) {
        appState.grassDensity = e.target.value || 'balanced';
        if (typeof scene3d.setGrassDensity === 'function') {
          scene3d.setGrassDensity(appState.grassDensity);
        }
        updatePerfStripNow();
        SoundFX.playClick();
      });
    }

    els.clockModeSelect.addEventListener('change', function (e) {
      appState.clockMode = e.target.value;
      updateClock();
      SoundFX.playClick();
    });

    els.caseSelect.addEventListener('change', function (e) {
      setCaseVariant(e.target.value);
      SoundFX.playClick();
    });

    els.hdriSelect.addEventListener('change', function (e) {
      setStudioHDRI(e.target.value);
      SoundFX.playClick();
    });

    if (els.toneMappingSelect) {
      els.toneMappingSelect.addEventListener('change', function (e) {
        if (typeof scene3d.setToneMapping === 'function') {
          scene3d.setToneMapping(e.target.value);
        }
        SoundFX.playClick();
      });
    }

    if (els.physicsEngineSelect) {
      els.physicsEngineSelect.addEventListener('change', function (e) {
        if (typeof world3d.setEngineMode === 'function') {
          world3d.setEngineMode(e.target.value);
        }
        SoundFX.playClick();
      });
    }

    if (els.velvetColorSelect) {
      els.velvetColorSelect.addEventListener('change', function (e) {
        scene3d.setVelvetPreset(e.target.value);
        if (appState.themeId !== 'diamond') {
          applySceneTheme('diamond', true);
        } else {
          SoundFX.playClick();
        }
      });
    }

    els.tiltModeSelect.addEventListener('change', function (e) {
      setTiltMode(e.target.value);
      SoundFX.playClick();
    });

    els.complicationsSelect.addEventListener('change', function (e) {
      appState.complicationsMode = e.target.value;
      syncHUD();
      SoundFX.playClick();
    });

    els.parallaxRange.addEventListener('input', function (e) {
      const val = parseFloat(e.target.value);
      scene3d.parallaxStrength = val;
      scene3d._pass1Dirty = true;
      els.parallaxVal.textContent = val.toFixed(1) + '×';
    });

    if (els.bloomRange && els.bloomVal) {
      els.bloomRange.addEventListener('input', function (e) {
        const val = parseFloat(e.target.value);
        if (typeof scene3d.setBloomStrength === 'function') {
          scene3d.setBloomStrength(val);
        }
        els.bloomVal.textContent = val.toFixed(2);
      });
    }

    if (els.trailRange && els.trailVal) {
      els.trailRange.addEventListener('input', function (e) {
        const val = parseFloat(e.target.value);
        if (typeof scene3d.setTrailStrength === 'function') {
          scene3d.setTrailStrength(val);
        }
        els.trailVal.textContent = val.toFixed(1) + '×';
      });
    }

    els.restitutionRange.addEventListener('input', function (e) {
      const val = parseFloat(e.target.value);
      world3d.restitutionOverride = val;
      world3d.wakeUp();
      els.restitutionVal.textContent = val.toFixed(2);
    });

    els.frictionRange.addEventListener('input', function (e) {
      const val = parseFloat(e.target.value);
      world3d.frictionScale = val;
      world3d.wakeUp();
      els.frictionVal.textContent = val.toFixed(1) + '×';
    });

    els.airDragRange.addEventListener('input', function (e) {
      const val = parseFloat(e.target.value);
      world3d.airDragScale = val;
      world3d.wakeUp();
      els.airDragVal.textContent = val.toFixed(1) + '×';
    });

    els.gravityRange.addEventListener('input', function (e) {
      const val = parseFloat(e.target.value);
      world3d.gravityScale = val;
      world3d.wakeUp();
      els.gravityVal.textContent = val.toFixed(1) + '×';
    });

    if (els.n8aoCheck) {
      els.n8aoCheck.addEventListener('change', function (e) {
        appState.n8aoEnabled = e.target.checked;
        if (typeof scene3d.setN8AOEnabled === 'function') {
          scene3d.setN8AOEnabled(appState.n8aoEnabled);
        }
        updatePerfStripNow();
        SoundFX.playClick();
      });
    }

    if (els.tennisFuzzCheck) {
      els.tennisFuzzCheck.addEventListener('change', function (e) {
        appState.tennisFuzzEnabled = e.target.checked;
        if (typeof scene3d.setTennisFuzzEnabled === 'function') {
          scene3d.setTennisFuzzEnabled(appState.tennisFuzzEnabled);
        }
        updatePerfStripNow();
        SoundFX.playClick();
      });
    }

    els.autoLevelCheck.addEventListener('change', function (e) {
      appState.autoLevel = e.target.checked;
      if (appState.autoLevel && !appState.isPointerDragging) {
        resetGimbalToNeutral();
      }
    });

    els.aodCheck.addEventListener('change', function (e) {
      setAODMode(e.target.checked);
    });

    els.cleanRecordCheck.addEventListener('change', function (e) {
      setCleanRecordMode(e.target.checked);
    });

    els.resetDefaultsBtn.addEventListener('click', resetDefaults);

    global.addEventListener('keydown', function (e) {
      if (e.key === '1') applySceneTheme('tennis', true);
      else if (e.key === '2') applySceneTheme('diamond', true);
      else if (e.key === '3') applySceneTheme('basketball', true);
      else if (e.key === '4') applySceneTheme('goldBar', true);
      else if (e.key === '5') applySceneTheme('soccer', true);
      else if (e.code === 'Space') {
        e.preventDefault();
        triggerShake();
      } else if (e.key === 'r' || e.key === 'R') {
        resetGimbalToNeutral();
      } else if (e.key === 'a' || e.key === 'A') {
        setAODMode(!appState.aodMode);
      } else if (e.key === 't' || e.key === 'T') {
        setTweaksOpen(!appState.tweaksOpen);
      } else if (e.key === 'Escape') {
        if (appState.settingsOpen) setWatchSettingsOpen(false);
        if (appState.tweaksOpen) setTweaksOpen(false);
      }
    });

    global.addEventListener('resize', function () {
      const w = els.watchCanvasWrap.clientWidth || 396;
      const h = els.watchCanvasWrap.clientHeight || 456;
      scene3d.resize(w, h);
    });

    global.addEventListener(
      'scroll',
      function () {
        if (typeof scene3d.invalidateRectCache === 'function') {
          scene3d.invalidateRectCache();
        }
      },
      { passive: true }
    );
  }

  let lastTelemetryText = '';
  let lastTelemetryMs = 0;

  function renderFrame(timestampSec, dt) {
    if (appState.tiltMode === 'orbit' && !appState.isPointerDragging) {
      const angle = timestampSec * 1.1;
      appState.targetRoll = Math.sin(angle) * 1.05;
      appState.targetPitch = Math.cos(angle * 0.72) * 1.02;
    }

    // Frame-rate-independent exponential smoothing (identical feel at 60Hz, 120Hz, 144Hz)
    const gimbalAlpha = 1.0 - Math.exp(-10.5 * dt);
    appState.smoothPitch += (appState.targetPitch - appState.smoothPitch) * gimbalAlpha;
    appState.smoothRoll += (appState.targetRoll - appState.smoothRoll) * gimbalAlpha;

    const cp = Math.cos(appState.smoothPitch);
    const sp = Math.sin(appState.smoothPitch);
    const cr = Math.cos(appState.smoothRoll);
    const sr = Math.sin(appState.smoothRoll);

    const gx = sr * cp;
    const gy = -sp;
    const gz = -cr * cp;

    appState.smoothGravity.x = gx;
    appState.smoothGravity.y = gy;
    appState.smoothGravity.z = gz;

    world3d.setGravity3D(gx, gy, gz);
    world3d.step(dt);

    const nowMs = timestampSec * 1000;
    if (nowMs - lastTelemetryMs > 66) {
      lastTelemetryMs = nowMs;
      const sx = (gx >= 0 ? '+' : '') + gx.toFixed(2);
      const sy = (gy >= 0 ? '+' : '') + gy.toFixed(2);
      const sz = (gz >= 0 ? '+' : '') + gz.toFixed(2);
      const nextTelemetry = 'GX ' + sx + ' · GY ' + sy + ' · GZ ' + sz;
      if (nextTelemetry !== lastTelemetryText) {
        lastTelemetryText = nextTelemetry;
        els.gravityTelemetry.textContent = nextTelemetry;
      }
    }

    if (appState.isPointerDragging) {
      els.tiltDot.style.transform =
        'translate3d(' + (gx * 150).toFixed(1) + 'px, ' + (-gy * 150).toFixed(1) + 'px, 0)';
    }

    // Real 3D Three.js watch hardware rotation aligned with wrist gimbal
    const targetRotX = appState.settingsOpen ? 0 : sp * 0.34;
    const targetRotY = appState.settingsOpen ? 0 : sr * 0.44;
    const targetRotZ = appState.settingsOpen ? 0 : sr * 0.08;

    const rotAlpha = 1.0 - Math.exp(-12.0 * dt);
    appState.smoothRotX += (targetRotX - appState.smoothRotX) * rotAlpha;
    appState.smoothRotY += (targetRotY - appState.smoothRotY) * rotAlpha;
    appState.smoothRotZ += (targetRotZ - appState.smoothRotZ) * rotAlpha;

    const camGx = appState.settingsOpen ? 0 : gx;
    const camGy = appState.settingsOpen ? 0 : gy;

    scene3d.syncAndRender(
      world3d.bodies,
      camGx,
      camGy,
      appState.aodMode,
      appState.smoothRotX,
      appState.smoothRotY,
      appState.smoothRotZ,
      dt,
      world3d.isResting
    );
  }

  let perfFrameCount = 0;
  let perfWindowStartMs = 0;
  let lastMeasuredFps = 60;
  let lastAvgFrameMs = 16.7;

  global.__GRAVITY_PERF__ = function () {
    const stats = typeof scene3d.getPerfStats === 'function' ? scene3d.getPerfStats() : {};
    return {
      fps: Math.round(lastMeasuredFps),
      frameMs: Number(lastAvgFrameMs.toFixed(2)),
      theme: appState.themeId,
      bodies: stats.bodies || world3d.bodies.length,
      grassBlades: stats.grassBlades || 0,
      rtWidth: stats.rtWidth || 0,
      rtHeight: stats.rtHeight || 0,
      isResting: Boolean(world3d.isResting)
    };
  };

  function startLoop() {
    let lastFrameMs = 0;
    let rafId = 0;

    function tick(nowMs) {
      if (document.hidden) {
        rafId = 0;
        lastFrameMs = 0;
        perfFrameCount = 0;
        perfWindowStartMs = 0;
        return;
      }
      const rawDt = lastFrameMs > 0 ? (nowMs - lastFrameMs) * 0.001 : 1 / 60;
      lastFrameMs = nowMs;
      const dt = Math.min(0.05, Math.max(1 / 240, rawDt));
      renderFrame(nowMs * 0.001, dt);

      perfFrameCount += 1;
      if (!perfWindowStartMs) perfWindowStartMs = nowMs;
      const elapsedMs = nowMs - perfWindowStartMs;
      if (elapsedMs >= 500) {
        lastMeasuredFps = (perfFrameCount * 1000) / elapsedMs;
        lastAvgFrameMs = elapsedMs / perfFrameCount;
        perfFrameCount = 0;
        perfWindowStartMs = nowMs;
        updatePerfStripNow();
      }

      rafId = global.requestAnimationFrame(tick);
    }

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !rafId) {
        lastFrameMs = 0;
        rafId = global.requestAnimationFrame(tick);
      }
    });

    rafId = global.requestAnimationFrame(tick);
  }

  function init() {
    buildInWatchSheet();
    setCaseVariant('series10');
    setStudioHDRI('studio09');
    if (els.toneMappingSelect && typeof scene3d.setToneMapping === 'function') {
      els.toneMappingSelect.value = 'neutral';
      scene3d.setToneMapping('neutral');
    }
    if (els.bloomRange && els.bloomVal && typeof scene3d.setBloomStrength === 'function') {
      els.bloomRange.value = '0.06';
      els.bloomVal.textContent = '0.06';
      scene3d.setBloomStrength(0.06);
    }
    if (els.trailRange && els.trailVal && typeof scene3d.setTrailStrength === 'function') {
      els.trailRange.value = '1.0';
      els.trailVal.textContent = '1.0×';
      scene3d.setTrailStrength(1.0);
    }
    if (els.grassDensitySelect && typeof scene3d.setGrassDensity === 'function') {
      els.grassDensitySelect.value = appState.grassDensity;
      scene3d.setGrassDensity(appState.grassDensity);
    }
    if (els.n8aoCheck && typeof scene3d.setN8AOEnabled === 'function') {
      els.n8aoCheck.checked = appState.n8aoEnabled;
      scene3d.setN8AOEnabled(appState.n8aoEnabled);
    }
    if (els.tennisFuzzCheck && typeof scene3d.setTennisFuzzEnabled === 'function') {
      els.tennisFuzzCheck.checked = appState.tennisFuzzEnabled;
      scene3d.setTennisFuzzEnabled(appState.tennisFuzzEnabled);
    }
    if (els.physicsEngineSelect) {
      const rapierOpt = els.physicsEngineSelect.querySelector('option[value="rapier"]');
      if (!global.RAPIER && rapierOpt) {
        rapierOpt.disabled = true;
        rapierOpt.textContent = 'Rapier3D WASM (不可用)';
      }
      els.physicsEngineSelect.value = world3d.engineMode || (global.RAPIER ? 'rapier' : 'analytic');
    }
    if (els.velvetColorSelect) {
      els.velvetColorSelect.value = 'obsidian';
      scene3d.setVelvetPreset('obsidian');
    }
    applySceneTheme('tennis', false);
    setTiltMode('drag');
    updateClock();
    global.setInterval(updateClock, 1000);
    bindEvents();
    ns.loadPhotographicMaps(function () {
      scene3d.refreshPhotographicMaterials();
    });
    startLoop();
  }

  if (document.readyState === 'loading') {
    global.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);

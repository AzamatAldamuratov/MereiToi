(() => {
  const designWidth = 1000;
  const desktopDesignHeight = 3204;
  const event = {
    year: 2026,
    month: 12,
    day: 11,
    hour: 16,
    minute: 0,
    timeZone: 'Asia/Qyzylorda',
  };
  const MUSIC_TRACK_URL = './fdf0540ad697f872d3c43b75ba477dc6_GI4Gf2gK.mp3';
  // Direct Telegram integration, matching the working reference page.
  const TELEGRAM_BOT_TOKEN = '8963644913:AAFFBH9GkXueN-RoDCrlK4BICdR2Av9weow';
  const TELEGRAM_CHAT_ID = '7612121485';

  const shell = document.getElementById('siteShell');
  const canvas = document.getElementById('invitationCanvas');
  const form = document.getElementById('rsvpForm');
  const status = document.getElementById('formStatus');
  const openingScreen = document.getElementById('openingScreen');
  const openButton = document.getElementById('openInvitation');
  const musicToggle = document.getElementById('musicToggle');
  const musicToggleLabel = musicToggle.querySelector('.music-toggle-label');
  const audio = document.getElementById('invitationAudio');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let invitationOpened = false;
  let revealStarted = false;

  const fitCanvas = () => {
    const viewportWidth = document.documentElement.clientWidth || shell.clientWidth;
    if (viewportWidth <= 900) {
      document.documentElement.style.setProperty('--canvas-scale', '1');
      shell.style.removeProperty('width');
      shell.style.removeProperty('height');
      canvas.style.removeProperty('height');
      return;
    }
    const scale = Math.min(1, viewportWidth / designWidth);
    document.documentElement.style.setProperty('--canvas-scale', String(scale));
    shell.style.width = `${viewportWidth}px`;
    canvas.style.height = `${desktopDesignHeight}px`;
    shell.style.height = `${desktopDesignHeight * scale}px`;
  };

  const wallTimeToEpoch = ({ year, month, day, hour, minute, timeZone }) => {
    const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    let candidate = targetAsUtc;

    // Correct the guess against the requested IANA zone rather than hard-coding its UTC offset.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]));
      const renderedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day,
        parts.hour, parts.minute, parts.second);
      const correction = targetAsUtc - renderedAsUtc;
      candidate += correction;
      if (correction === 0) break;
    }
    return candidate;
  };

  const countdownRoot = document.getElementById('countdown');
  const countdownFinished = document.getElementById('countdownFinished');
  const eventEpoch = wallTimeToEpoch(event);
  const kazakhMonths = [
    'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
    'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан',
  ];
  const eventMonth = kazakhMonths[event.month - 1];
  const capitalizeKazakh = (value) => value.slice(0, 1).toLocaleUpperCase('kk-KZ') + value.slice(1);
  document.getElementById('pageTitle').textContent = 'Мерей Той';
  document.getElementById('pageDescription').content = 'Мерей тойына шақыру';
  document.getElementById('calendarMonth').textContent = capitalizeKazakh(eventMonth);
  const countdownParts = {
    days: countdownRoot.querySelector('[data-count="days"]'),
    hours: countdownRoot.querySelector('[data-count="hours"]'),
    minutes: countdownRoot.querySelector('[data-count="minutes"]'),
    seconds: countdownRoot.querySelector('[data-count="seconds"]'),
  };

  const updateCountdown = () => {
    const totalSeconds = Math.max(0, Math.floor((eventEpoch - Date.now()) / 1000));
    if (totalSeconds === 0) {
      countdownRoot.hidden = true;
      countdownFinished.hidden = false;
      return;
    }
    countdownParts.days.textContent = String(Math.floor(totalSeconds / 86400));
    countdownParts.hours.textContent = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, '0');
    countdownParts.minutes.textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    countdownParts.seconds.textContent = String(totalSeconds % 60).padStart(2, '0');
  };

  const updateMusicControl = () => {
    const playing = !audio.paused && !audio.ended;
    musicToggle.classList.toggle('is-playing', playing);
    musicToggle.setAttribute('aria-pressed', String(playing));
    if (playing) {
      musicToggleLabel.textContent = 'Әуенді өшіру';
      musicToggle.setAttribute('aria-label', 'Әуенді өшіру');
      musicToggle.title = 'Әуенді өшіру';
    } else {
      musicToggleLabel.textContent = 'Әуенді қосу';
      musicToggle.setAttribute('aria-label', 'Әуенді қосу');
      musicToggle.title = 'Әуенді қосу';
    }
  };

  const attemptPlayback = async () => {
    audio.volume = 0.3;
    try {
      await audio.play();
      updateMusicControl();
      return true;
    } catch {
      updateMusicControl();
      return false;
    }
  };

  const revealTargets = [
    ['.paper-layer--top', 0], ['.paper-layer--calendar', 0],
    ['.paper-layer--rsvp', 0], ['.paper-layer--footer', 0],
    ['.countdown h2', 0], ['.countdown-unit', 100], ['.countdown-units i', 170],
    ['.welcome-title', 0], ['.invitation-copy', 110], ['.family-signoff', 230],
    ['.calendar-month', 70], ['.calendar-grid', 0], ['.weekdays', 150],
    ['.days li:not(:empty)', 200, 16],
    ['.venue-title', 0], ['.venue-address', 100], ['.venue-hint', 210], ['.map-button', 320],
    ['.rsvp-title', 0], ['.guest-label', 100], ['.guest-input-wrap', 150],
    ['.attendance-choice', 220], ['.submit-button', 390],
  ];
  revealTargets.forEach(([selector, baseDelay, stagger = 38]) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      element.setAttribute('data-reveal', '');
      element.style.setProperty('--reveal-delay', `${baseDelay + index * stagger}ms`);
    });
  });

  const startRevealAnimations = () => {
    if (revealStarted) return;
    revealStarted = true;
    const targets = [...document.querySelectorAll('[data-reveal]')];
    document.documentElement.classList.add('reveal-ready');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const pending = new Set(targets);
    let observer;
    let fallbackFrame = 0;
    const stopFallback = () => {
      if (pending.size) return;
      window.removeEventListener('scroll', schedulePassedCheck);
      window.removeEventListener('resize', schedulePassedCheck);
      observer.disconnect();
      if (fallbackFrame) window.cancelAnimationFrame(fallbackFrame);
    };
    const reveal = (element) => {
      if (!pending.delete(element)) return;
      element.classList.add('is-visible');
      observer.unobserve(element);
      stopFallback();
    };
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px 8% 0px' });
    const revealPassedTargets = () => {
      fallbackFrame = 0;
      const viewportBottom = window.scrollY + window.innerHeight * 1.08;
      pending.forEach((element) => {
        const elementTop = element.getBoundingClientRect().top + window.scrollY;
        if (elementTop <= viewportBottom) reveal(element);
      });
    };
    const schedulePassedCheck = () => {
      if (fallbackFrame || !pending.size) return;
      fallbackFrame = window.requestAnimationFrame(revealPassedTargets);
    };
    targets.forEach((element) => observer.observe(element));
    window.addEventListener('scroll', schedulePassedCheck, { passive: true });
    window.addEventListener('resize', schedulePassedCheck, { passive: true });
    schedulePassedCheck();
  };

  const openInvitation = () => {
    if (invitationOpened) return;
    invitationOpened = true;
    void attemptPlayback();
    shell.inert = false;
    document.body.classList.add('invitation-open');
    document.body.classList.remove('opening-active');
    document.documentElement.classList.remove('opening-active');
    fitCanvas();
    window.scrollTo({ top: 0, behavior: 'auto' });
    startRevealAnimations();
    musicToggle.removeAttribute('aria-hidden');
    musicToggle.tabIndex = 0;
    openingScreen.classList.add('is-opening');
    window.setTimeout(() => openingScreen.remove(), reducedMotion.matches ? 860 : 1400);
    window.setTimeout(() => shell.focus({ preventScroll: true }), 0);
  };

  fitCanvas();
  window.addEventListener('resize', fitCanvas, { passive: true });
  window.addEventListener('orientationchange', fitCanvas, { passive: true });
  updateCountdown();
  window.setInterval(updateCountdown, 1000);
  audio.volume = 0.3;
  audio.src = MUSIC_TRACK_URL;
  updateMusicControl();
  openButton.focus({ preventScroll: true });

  openButton.addEventListener('click', openInvitation);
  musicToggle.addEventListener('click', () => {
    if (!audio.paused) {
      audio.pause();
      updateMusicControl();
      return;
    }
    void attemptPlayback();
  });
  ['play', 'playing', 'pause', 'ended', 'error', 'loadedmetadata'].forEach((type) => {
    audio.addEventListener(type, updateMusicControl);
  });

  form.addEventListener('submit', async (submission) => {
    submission.preventDefault();
    if (!form.reportValidity()) return;

    const submitButton = form.querySelector('.submit-button');
    const attendance = form.querySelector('input[name="attendance"]:checked')?.value;
    const attendanceLabels = {
      yes: 'әрине, келемін',
      'plus-one': 'жұбыммен келемін',
      no: 'өкінішке орай, келе алмаймын',
    };
    const guestName = form.elements.guestName.value.trim();
    const message = [
      'Жаңа тойға жауап',
      `Аты-жөні: ${guestName}`,
      `Қатысуы: ${attendanceLabels[attendance]}`,
    ].join('\n');

    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    status.textContent = 'Жауабыңыз жіберіліп жатыр…';
    status.classList.add('is-visible');
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
      });
      const result = await response.json();
      if (!response.ok || result?.ok !== true) throw new Error('Telegram rejected the RSVP');
      status.textContent = 'Рақмет! Жауабыңыз жіберілді.';
      form.reset();
    } catch {
      status.textContent = 'Жауап жіберілмеді. Қайтадан көріңіз немесе той иесіне хабарласыңыз.';
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
    }
  });
})();

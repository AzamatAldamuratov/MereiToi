(() => {
  const designWidth = 1000;
  const desktopDesignHeight = 4883;
  const mobileDesignHeight = 5520;
  const event = {
    year: 2026,
    month: 12,
    day: 11,
    hour: 16,
    minute: 0,
    timeZone: 'Asia/Qyzylorda',
  };
  const MUSIC_TRACK_URL = './fdf0540ad697f872d3c43b75ba477dc6_GI4Gf2gK.mp3';
  // Configure a same-origin backend route when the bot is ready; keep its token on the server.
  const RSVP_SUBMISSION_ENDPOINT = '/api/rsvp';

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
    const scale = Math.min(1, viewportWidth / designWidth);
    const designHeight = viewportWidth <= 700 ? mobileDesignHeight : desktopDesignHeight;
    document.documentElement.style.setProperty('--canvas-scale', String(scale));
    shell.style.width = `${viewportWidth}px`;
    canvas.style.height = `${designHeight}px`;
    shell.style.height = `${designHeight * scale}px`;
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
  const kazakhWeekdays = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'];
  const eventMonth = kazakhMonths[event.month - 1];
  const eventWeekday = kazakhWeekdays[new Date(Date.UTC(event.year, event.month - 1, event.day)).getUTCDay()];
  const capitalizeKazakh = (value) => value.slice(0, 1).toLocaleUpperCase('kk-KZ') + value.slice(1);
  const eventDateShort = `${event.day} ${eventMonth} ${event.year}`;
  const eventDateLong = `${eventDateShort} жыл`;
  const eventTimeLabel = `сағат ${String(event.hour).padStart(2, '0')}:${String(event.minute).padStart(2, '0')}`;
  const eventIsoDate = `${event.year}-${String(event.month).padStart(2, '0')}-${String(event.day).padStart(2, '0')}`;
  document.getElementById('pageTitle').textContent = `Мерей Той — ${eventDateShort}`;
  document.getElementById('pageDescription').content = `${eventDateLong} — Мерей тойына шақыру`;
  document.getElementById('openingDate').textContent = `${String(event.day).padStart(2, '0')} • ${String(event.month).padStart(2, '0')} • ${event.year}`;
  document.getElementById('coverWeekday').textContent = capitalizeKazakh(eventWeekday);
  document.getElementById('coverDay').textContent = String(event.day);
  document.getElementById('coverMonth').textContent = capitalizeKazakh(eventMonth);
  document.getElementById('coverYear').textContent = String(event.year);
  document.getElementById('eventDateText').textContent = eventDateLong;
  document.getElementById('eventDateText').dateTime = eventIsoDate;
  document.getElementById('eventDateText').dataset.timeZone = event.timeZone;
  const eventTimeElement = document.getElementById('eventTimeText');
  eventTimeElement.textContent = eventTimeLabel;
  eventTimeElement.dateTime = `${eventIsoDate}T${String(event.hour).padStart(2, '0')}:${String(event.minute).padStart(2, '0')}`;
  eventTimeElement.dataset.timeZone = event.timeZone;
  document.getElementById('calendarEventDate').textContent = eventDateShort;
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
    ['.cover-frame', 0], ['.flower--top', 70], ['.cover-title', 150],
    ['.cover-date', 260], ['.flower--lower', 100],
    ['.countdown h2', 0], ['.countdown-unit', 100], ['.countdown-units i', 170],
    ['.welcome-title', 0], ['.invitation-copy', 110], ['.family-signoff', 230],
    ['.calendar-date', 0], ['.calendar-month', 70], ['.calendar-grid', 0], ['.weekdays', 150],
    ['.days li:not(:empty)', 200, 16],
    ['.venue-title', 0], ['.venue-address', 100], ['.venue-hint', 210], ['.map-button', 320],
    ['.rsvp-title', 0], ['.guest-label', 100], ['.guest-input-wrap', 150],
    ['.attendance-choice', 220], ['.submit-button', 390], ['.closing p', 100],
  ];
  revealTargets.forEach(([selector, baseDelay, stagger = 38]) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      element.setAttribute('data-reveal', '');
      element.style.setProperty('--reveal-delay', `${baseDelay + index * stagger}ms`);
    });
  });

  const startRevealAnimations = () => {
    if (revealStarted || !('IntersectionObserver' in window)) return;
    revealStarted = true;
    document.documentElement.classList.add('reveal-ready');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
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
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    status.textContent = 'Жауабыңыз жіберіліп жатыр…';
    status.classList.add('is-visible');
    try {
      const response = await fetch(RSVP_SUBMISSION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: form.elements.guestName.value.trim(),
          attendance: form.querySelector('input[name="attendance"]:checked').value,
        }),
      });
      if (!response.ok) throw new Error('RSVP submission failed');
      status.textContent = 'Рақмет! Жауабыңыз жіберілді.';
    } catch {
      status.textContent = 'Жауап жіберілмеді. Бот уақытша қолжетімсіз, кейінірек қайталап көріңіз.';
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
    }
  });
})();

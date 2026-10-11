(() => {
  'use strict';

  /* ----------------------------------------------------------
     Einstellungen
     ---------------------------------------------------------- */

  // URL des Google-Apps-Scripts. Solange leer, wird nichts verschickt,
  // die Antwort landet nur in der Browser-Konsole (zum lokalen Testen).
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxrHTJ9yHQza1wmFca49LYHcCUMcFD_5Dwk5LlvD6awFWZ11xQK_74Kmt597cFNumq_/exec';

  // Ab welchem Anteil der Scrollstrecke der Titel wechselt (0 bis 1).
  // Bei 1 ist die Strecke zu Ende: «Brei» erscheint, und ab dann scrollen
  // Eckdaten und Titel raus. Kleiner als 1 = «Brei» bleibt erst kurz stehen.
  const SWITCH_ZWEI = 0.25;
  const SWITCH_BREI = 1;

  /* ----------------------------------------------------------
     Titel: Eins – Zwei – Brei
     ---------------------------------------------------------- */

  const intro = document.querySelector('.intro');
  const stage = document.querySelector('.stage');
  const title = document.querySelector('.title');
  let ticking = false;

  function updateTitle() {
    ticking = false;
    // Strecke, über die der erste Viewport stehen bleibt (unabhängig davon,
    // ob auf dem Handy die Browserleisten gerade ein- oder ausgeblendet sind)
    const range = intro.offsetHeight - stage.offsetHeight;
    const progress = range > 0
      ? Math.min(1, Math.max(0, (window.scrollY - intro.offsetTop) / range))
      : 1;
    const word = progress < SWITCH_ZWEI ? 0 : progress < SWITCH_BREI ? 1 : 2;
    if (title.dataset.word !== String(word)) title.dataset.word = word;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateTitle);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  updateTitle();

  /* ----------------------------------------------------------
     Zu- und Absage
     ---------------------------------------------------------- */

  const rsvp = document.querySelector('.rsvp');
  const form = rsvp.querySelector('.form');
  const nameInput = form.querySelector('.name');
  const honeypot = form.querySelector('.hp');
  const plus = form.querySelector('.plus');
  const done = rsvp.querySelector('.done');
  const bye = rsvp.querySelector('.bye');

  const setState = (state) => { rsvp.dataset.state = state; };
  const getState = () => rsvp.dataset.state;

  // Zufällige Kennung pro Browser: Wer sich umentscheidet, erzeugt einen
  // zweiten Eintrag mit derselben Kennung, im Sheet zählt dann der letzte.
  function visitorId() {
    try {
      let id = localStorage.getItem('einladung-id');
      if (!id) {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('einladung-id', id);
      }
      return id;
    } catch (e) {
      return '';
    }
  }

  async function send(answer) {
    const data = { ...answer, id: visitorId() };
    if (!ENDPOINT) {
      console.log('[Einladung] Kein Endpunkt gesetzt, Antwort wäre:', data);
      return;
    }
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,   // wird auch fertig gesendet, wenn jemand die Seite sofort schliesst
        body: new URLSearchParams(data),
      });
    } catch (e) {
      console.warn('[Einladung] Senden fehlgeschlagen', e);
    }
  }

  rsvp.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-choose]');
    if (!choice) return;

    if (choice.dataset.choose === 'yes') {
      setState('yes');
      nameInput.focus();
    } else {
      setState('no');
      send({ kommt: 'nein', name: '', plus: 0 });
      bye.focus({ preventScroll: true });
    }
  });

  // «bis ein andermal» nochmals anklicken: zurück zur Auswahl
  bye.addEventListener('click', () => {
    if (getState() === 'no') setState('idle');
  });

  plus.addEventListener('click', () => {
    const active = plus.getAttribute('aria-pressed') === 'true';
    plus.setAttribute('aria-pressed', String(!active));
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (getState() !== 'yes') return;

    const name = nameInput.value.trim();
    if (!name) {
      form.classList.remove('is-missing');
      void form.offsetWidth; // Animation neu starten
      form.classList.add('is-missing');
      nameInput.focus();
      return;
    }

    const withGuest = plus.getAttribute('aria-pressed') === 'true';
    done.textContent = withGuest ? `bis dann, ${name} +1` : `bis dann, ${name}`;
    leaveField();
    setState('sent');

    // Ausgefülltes Honeypot-Feld = Bot, dann wird nichts verschickt
    if (!honeypot.value) {
      send({ kommt: 'ja', name, plus: withGuest ? 1 : 0 });
    }
  });

  // Das Namensfeld zuerst verlassen (Tastatur schliessen), erst dann den
  // Zustand wechseln. Wird ein Feld ausgeblendet, das noch den Fokus hat,
  // kann Safari auf dem iPhone an den Seitenanfang springen.
  function leaveField() {
    if (document.activeElement === nameInput) nameInput.blur();
  }

  // Zurück zur Auswahl, solange noch nichts abgeschickt ist:
  // Escape oder Klick/Tipp neben den Button
  function backToIdle() {
    if (getState() !== 'yes') return;
    leaveField();
    setState('idle');
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') backToIdle();
  });

  // Nur ein Tipp ohne Bewegung zählt. Wer mit dem Finger scrollt, während
  // das Namensfeld offen ist, klappt es dadurch nicht zu.
  let tapStart = null;
  document.addEventListener('pointerdown', (event) => {
    tapStart = event.target.closest('.rsvp .pill')
      ? null
      : { x: event.clientX, y: event.clientY };
  });
  document.addEventListener('pointerup', (event) => {
    if (tapStart && Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) < 10) {
      backToIdle();
    }
    tapStart = null;
  });
  document.addEventListener('pointercancel', () => { tapStart = null; });

  // Sicherheitsnetz fürs Handy: Steht die Seite nach dem Schliessen der
  // Tastatur weiter oben als vorher, wird die alte Position wiederhergestellt.
  // Sobald man den Bildschirm wieder berührt, mischt sich das nicht mehr ein.
  let keepY = null;
  let guards = [];
  const stopGuard = () => { guards.forEach(clearTimeout); guards = []; };
  nameInput.addEventListener('focus', () => { stopGuard(); keepY = window.scrollY; });
  nameInput.addEventListener('blur', () => {
    if (keepY === null) return;
    const y = keepY;
    stopGuard();
    [80, 250, 500].forEach((ms) => {
      guards.push(setTimeout(() => {
        if (window.scrollY < y - 40) window.scrollTo(0, y);
      }, ms));
    });
  });
  window.addEventListener('touchstart', stopGuard, { passive: true });
})();

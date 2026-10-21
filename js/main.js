(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s),
    $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    header = $(".header"),
    hero = $(".hero"),
    track = $(".hero-track"),
    media = $(".hero-media"),
    fog = $(".hero-fog"),
    heroContent = $(".hero-content"),
    caption = $(".hero-caption"),
    video = $(".hero-video"),
    videoToggle = $(".video-toggle"),
    videoLabel = $(".play-label"),
    videoSymbol = $(".play-symbol"),
    soundToggle = $(".sound-toggle"),
    soundLabel = $(".sound-label"),
    videoNote = $(".video-note"),
    menu = $(".menu-dialog"),
    menuToggle = $(".menu-toggle");
  let manuallyPaused = false,
    videoFailed = false,
    autoEligible = !reduced.matches,
    heroVisible = true;
  function videoUI() {
    const playing = !video.paused && !videoFailed;
    videoLabel.textContent = playing ? "영상 일시정지" : "영상 재생";
    videoSymbol.textContent = playing ? "Ⅱ" : "▶";
    videoToggle.setAttribute(
      "aria-label",
      playing ? "영상 일시정지" : "영상 재생",
    );
  }
  function videoFallback() {
    videoFailed = true;
    video.classList.remove("ready");
    videoNote.hidden = false;
    videoNote.textContent = "영상 대신 센터 사진을 보여드리고 있습니다.";
    videoToggle.hidden = true;
    soundToggle.hidden = true;
  }
  function soundUI() {
    const audible = !video.muted && video.volume > 0;
    soundToggle.setAttribute("aria-pressed", String(audible));
    soundToggle.setAttribute("aria-label", audible ? "소리 끄기" : "소리 켜기");
    // Show the action of the button, matching the play/pause control.
    soundLabel.textContent = audible ? "소리 OFF" : "소리 ON";
  }
  async function playVideo() {
    if (videoFailed) return;
    try {
      await video.play();
      videoNote.hidden = true;
    } catch (e) {
      if (videoFailed || e.name === "AbortError") return;
      video.classList.remove("ready");
      videoNote.hidden = false;
      videoNote.textContent = "재생 버튼을 눌러 센터 영상을 만나보세요.";
      videoUI();
    }
  }
  video.muted = true;
  video.addEventListener("playing", () => {
    video.classList.add("ready");
    videoUI();
  });
  video.addEventListener("pause", videoUI);
  video.addEventListener("volumechange", soundUI);
  video.addEventListener("error", videoFallback);
  $("source", video).addEventListener("error", videoFallback);
  videoToggle.addEventListener("click", () => {
    if (video.paused) {
      manuallyPaused = false;
      autoEligible = true;
      playVideo();
    } else {
      manuallyPaused = true;
      video.pause();
    }
  });
  soundToggle.addEventListener("click", () => {
    video.muted = !video.muted;
    video.volume = 1;
    if (!video.muted && video.paused) {
      manuallyPaused = false;
      autoEligible = true;
      playVideo();
    }
    soundUI();
  });
  videoUI();
  soundUI();
  if (!reduced.matches) playVideo();
  function resumeVisibleVideo() {
    if (
      autoEligible &&
      !manuallyPaused &&
      !reduced.matches &&
      heroVisible &&
      !document.hidden
    )
      playVideo();
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) =>
        entries.forEach(({ isIntersecting }) => {
          heroVisible = isIntersecting;
          if (!isIntersecting) video.pause();
          else resumeVisibleVideo();
        }),
      { threshold: 0.1 },
    ).observe(hero);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
    else resumeVisibleVideo();
  });
  function closeMenu() {
    if (menu.open) menu.close();
  }
  menuToggle.addEventListener("click", () => {
    menu.showModal();
    document.body.classList.add("menu-open");
    menuToggle.setAttribute("aria-expanded", "true");
  });
  $(".menu-close").addEventListener("click", closeMenu);
  menu.addEventListener("close", () => {
    document.body.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.focus({ preventScroll: true });
  });
  $$('a[href^="#"]', menu).forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = $(a.getAttribute("href"));
      closeMenu();
      requestAnimationFrame(() => {
        target.scrollIntoView({
          behavior: reduced.matches ? "instant" : "smooth",
        });
        target.focus({ preventScroll: true });
        history.replaceState(null, "", a.getAttribute("href"));
      });
    }),
  );
  const panels = $$(".program-panel");
  function selectPanel(panel, focus = false) {
    panels.forEach((p) => {
      const on = p === panel;
      p.classList.toggle("active", on);
      $(".panel-select", p).setAttribute("aria-pressed", String(on));
    });
    if (focus) $(".panel-select", panel).focus({ preventScroll: true });
  }
  panels.forEach((panel, i) => {
    const button = $(".panel-select", panel);
    button.addEventListener("click", () => selectPanel(panel));
    button.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse" && matchMedia("(min-width:801px)").matches)
        selectPanel(panel);
    });
    button.addEventListener("focus", () => selectPanel(panel));
    button.addEventListener("keydown", (e) => {
      let n;
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        n = (i + 1) % panels.length;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        n = (i - 1 + panels.length) % panels.length;
      if (e.key === "Home") n = 0;
      if (e.key === "End") n = panels.length - 1;
      if (n !== undefined) {
        e.preventDefault();
        selectPanel(panels[n], true);
      }
    });
  });
  const dayButtons = $$(".schedule-tabs button"),
    dayTables = $$(".day-table");
  function setDay(day) {
    dayButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.day === day)),
    );
    dayTables.forEach(
      (t) => (t.hidden = day !== "all" && t.dataset.day !== day),
    );
  }
  dayButtons.forEach((b, i) => {
    b.addEventListener("click", () => setDay(b.dataset.day));
    b.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const n =
          (i + (e.key === "ArrowRight" ? 1 : -1) + dayButtons.length) %
          dayButtons.length;
        dayButtons[n].focus();
        setDay(dayButtons[n].dataset.day);
      }
    });
  });
  setDay("mon");
  $$("img").forEach((im) =>
    im.addEventListener("error", () => {
      im.classList.add("photo-fallback");
      if (im.classList.contains("hero-poster")) im.style.opacity = "0";
    }),
  );
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
    smooth = (x) => x * x * (3 - 2 * x),
    reveals = $$(".reveal"),
    drifts = $$(".drift"),
    mainPhoto = $(".moment-main"),
    mainPhotoImg = $(".moment-main img");
  let queued = false;
  function paint() {
    queued = false;
    const y = scrollY,
      vh = innerHeight,
      total = document.documentElement.scrollHeight - vh;
    $(".progress").style.width = (total > 0 ? (100 * y) / total : 0) + "%";
    header.classList.toggle(
      "scrolled",
      y >
        (reduced.matches
          ? hero.offsetHeight * 0.76
          : Math.max(1, track.offsetHeight - hero.offsetHeight) * 0.55),
    );
    if (reduced.matches) {
      [
        media,
        heroContent,
        caption,
        mainPhoto,
        mainPhotoImg,
        ...reveals,
        ...drifts,
      ].forEach((n) => {
        n.style.transform = "none";
        n.style.opacity = "1";
      });
      fog.style.opacity = "0";
      return;
    }
    const distance = Math.max(1, track.offsetHeight - hero.offsetHeight),
      p = clamp(y / distance),
      fade = smooth(clamp((p - 0.1) / 0.9));
    media.style.transform = `scale(${1.055 - p * 0.055}) translateY(${p * 18}px)`;
    fog.style.opacity = String(fade);
    heroContent.style.opacity = String(1 - smooth(clamp(p * 1.8)));
    heroContent.style.transform = `translateY(${-p * 40}px)`;
    caption.style.opacity = String(1 - clamp(p * 2));
    reveals.forEach((el) => {
      const r = el.getBoundingClientRect();
      const t = clamp((vh - r.top) / (vh * 0.35));
      el.style.opacity = String(0.18 + 0.82 * smooth(t));
      el.style.transform = `translateY(${(1 - smooth(t)) * 24}px)`;
    });
    const r = mainPhoto.getBoundingClientRect(),
      t = clamp((vh - r.top) / (vh + r.height));
    mainPhoto.style.transform = `scale(${0.9 + 0.1 * smooth(clamp(t * 1.9))})`;
    mainPhotoImg.style.transform = `scale(${1.08 - 0.08 * t})`;
    drifts.forEach((el) => {
      const r = el.getBoundingClientRect(),
        p = clamp((vh - r.top) / (vh + r.height));
      el.style.transform = `translateY(${(p - 0.5) * Number(el.dataset.drift) * 2}px)`;
    });
  }
  function queue() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(paint);
    }
  }
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      autoEligible = false;
      video.pause();
    }
    paint();
  });
  document.fonts.ready.then(queue);
  paint();
})();

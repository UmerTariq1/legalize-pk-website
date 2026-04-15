/* Motion system: Lenis smooth scroll + GSAP reveals (respects reduced motion). */

(function () {
  function prefersReduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function hasGsap() {
    return Boolean(window.gsap) && !prefersReduced();
  }

  function initLenis() {
    if (prefersReduced()) return;
    if (!window.Lenis) return;

    try {
      const lenis = new window.Lenis({ smoothWheel: true, duration: 1.1 });
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    } catch {
      // Non-fatal.
    }
  }

  function initReveals() {
    const items = document.querySelectorAll(
      ".hero-copy, .hero-visual, .feature-card, .page-head, .panel, .filter-bar, .amendment-card"
    );
    for (const el of items) el.classList.add("reveal");

    if (prefersReduced()) {
      for (const el of items) {
        el.style.opacity = "1";
        el.style.transform = "none";
      }
      return;
    }

    if (!window.gsap) return;
    window.gsap.to(".reveal", {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: "power2.out",
      stagger: 0.04,
      overwrite: true,
      delay: 0.05,
    });
  }

  function animateTimeline() {
    if (!hasGsap()) return;
    const line = document.querySelector(".timeline-line");
    if (!line) return;
    window.gsap.fromTo(
      line,
      { scaleY: 0, transformOrigin: "top" },
      { scaleY: 1, duration: 1.05, ease: "power2.out", delay: 0.1 }
    );

    const dots = document.querySelectorAll(".timeline-dot");
    if (dots.length) {
      window.gsap.from(dots, {
        opacity: 0,
        y: 8,
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.05,
        delay: 0.15,
      });
    }
  }

  function animateDiffLines(root = document) {
    if (!hasGsap()) return;
    const adds = root.querySelectorAll(".diff-line.add");
    const removes = root.querySelectorAll(".diff-line.remove");

    if (adds.length) {
      window.gsap.from(adds, {
        opacity: 0,
        x: -10,
        duration: 0.35,
        ease: "power2.out",
        stagger: 0.01,
        overwrite: true,
      });
    }
    if (removes.length) {
      window.gsap.from(removes, {
        opacity: 0,
        x: 10,
        duration: 0.35,
        ease: "power2.out",
        stagger: 0.01,
        overwrite: true,
      });
    }
  }

  function init() {
    initLenis();
    initReveals();
    animateTimeline();
  }

  window.Animations = { animateDiffLines, animateTimeline };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();


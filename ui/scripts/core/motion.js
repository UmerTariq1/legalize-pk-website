import { REDUCED_MOTION_QUERY } from "./constants.js";
import { animate, inView, stagger } from "https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm";

export function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function animateIn(selector, options = {}) {
  if (prefersReducedMotion()) {
    return;
  }

  const elements = document.querySelectorAll(selector);
  if (!elements.length) {
    return;
  }

  animate(
    elements,
    { opacity: [0, 1], y: [20, 0] },
    {
      duration: options.duration || 0.45,
      delay: options.delay || stagger(0.08),
      easing: options.easing || "ease-out"
    }
  );
}

export function attachInViewAnimation(selector) {
  if (prefersReducedMotion()) {
    return;
  }

  document.querySelectorAll(selector).forEach((el) => {
    inView(el, () => {
      animate(el, { opacity: [0, 1], y: [16, 0] }, { duration: 0.4, easing: "ease-out" });
    });
  });
}

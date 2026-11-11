"use client";

import { useEffect, type RefObject } from "react";

/** Event-driven motion: no render loop, and no React updates on scroll or pointer movement. */
export function useHomeMotion(
  root: RefObject<HTMLDivElement | null>,
  paused: boolean,
) {
  useEffect(() => {
    const element = root.current;
    const hero = element?.querySelector<HTMLElement>(".eclipse-hero");
    if (!element || !hero) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    let pageHeight = 1;
    let heroTop = 0;
    let heroHeight = 1;
    let bounds: DOMRect | null = null;
    let pointerX = 0;
    let pointerY = 0;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));

    const draw = () => {
      frame = 0;
      if (document.hidden) return;
      const motionEnabled = !paused && !reduced.matches;
      element.style.setProperty(
        "--page-progress",
        String(clamp(window.scrollY / pageHeight)),
      );
      element.style.setProperty(
        "--hero-scroll",
        motionEnabled
          ? String(clamp((window.scrollY - heroTop) / heroHeight))
          : "0",
      );
      hero.style.setProperty("--pointer-x", motionEnabled ? String(pointerX) : "0");
      hero.style.setProperty("--pointer-y", motionEnabled ? String(pointerY) : "0");
    };
    const schedule = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const measure = () => {
      const rect = hero.getBoundingClientRect();
      heroTop = rect.top + window.scrollY;
      heroHeight = Math.max(1, rect.height);
      pageHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      bounds = null;
      schedule();
    };
    const scroll = () => {
      bounds = null;
      schedule();
    };
    const move = (event: PointerEvent) => {
      if (paused || reduced.matches || !finePointer.matches || event.pointerType !== "mouse") return;
      bounds ??= hero.getBoundingClientRect();
      pointerX = (clamp((event.clientX - bounds.left) / bounds.width) - 0.5) * 2;
      pointerY = (clamp((event.clientY - bounds.top) / bounds.height) - 0.5) * 2;
      schedule();
    };
    const resetPointer = () => {
      pointerX = 0;
      pointerY = 0;
      schedule();
    };
    const visibility = () => {
      element.setAttribute("data-motion-visibility", document.hidden ? "hidden" : "visible");
      if (document.hidden && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      schedule();
    };

    const targets = element.querySelectorAll<HTMLElement>(
      ".section-heading, .plan-grid, .plan-detail, .steps-grid li, .faq-section, .closing, .solar-clock, .energy-intro",
    );
    const showAll = () => targets.forEach((target) => target.classList.add("is-revealed"));
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          for (const entry of entries) {
            const zone = entry.target.matches(".eclipse-hero, .energy-intro, .solar-clock");
            if (zone) {
              entry.target.setAttribute("data-in-view", String(entry.isIntersecting));
            }
            if (entry.target !== hero && entry.isIntersecting) {
              entry.target.classList.add("is-revealed");
              if (!zone) observer?.unobserve(entry.target);
            }
          }
        }, { threshold: 0.08 })
      : null;

    if (observer && !paused && !reduced.matches) {
      targets.forEach((target) => {
        // Already visible content never disappears during hydration or navigation.
        if (target.getBoundingClientRect().top < window.innerHeight) {
          target.classList.add("is-revealed");
        } else {
          target.classList.add("reveal-on-scroll");
          observer.observe(target);
        }
        if (target.matches(".energy-intro, .solar-clock")) observer.observe(target);
      });
      observer.observe(hero);
    } else showAll();

    const preferenceChanged = () => {
      if (reduced.matches) showAll();
      resetPointer();
    };
    const resize = "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    resize?.observe(element);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerleave", resetPointer);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", preferenceChanged);
    finePointer.addEventListener("change", resetPointer);
    measure();
    visibility();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      resize?.disconnect();
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", measure);
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", resetPointer);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", preferenceChanged);
      finePointer.removeEventListener("change", resetPointer);
    };
  }, [root, paused]);
}

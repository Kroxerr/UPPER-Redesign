// Browsers try to restore the previous scroll position on a plain reload
// (and on back/forward navigation) by default — left alone, that fights
// everything below, which assumes a refresh always starts at the very
// top: the intro reveal locks scroll and plays every time regardless of
// where the page was left, and HERO-TO-NAV's own math is all relative to
// scroll position 0. "manual" opts out of that native restoration
// entirely, and the explicit scrollTo(0,0) below covers the page having
// already been rendered scrolled-down for an instant before this script
// got a chance to run.
history.scrollRestoration = "manual";
window.scrollTo(0, 0);

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, CustomEase, SplitText, Draggable, InertiaPlugin);

// -- CONTEXT CURSOR -- //
//Reusable: any element anywhere on the site can opt into this just by
//adding data-cursor="some text" — no per-element wiring needed beyond
//that attribute. .context-cursor follows the mouse continuously (same
//always-tracking + quickTo technique the old plain cursor dot used, so
//it's already in the right place the instant it becomes visible, rather
//than jumping there from wherever it last was). On hover it fills in the
//hovered element's own text and scales/fades in exactly like the menu
//window does (see MENU OVERLAY above — same fromTo shape, same
//power3.out); on mouseleave it fades out quickly, matching the "closing
//should be fast" preference already established for the menu itself.
const contextCursor = document.querySelector(".context-cursor");
const contextCursorText = document.querySelector(".context-cursor-text");

if (contextCursor && contextCursorText && window.matchMedia("(hover: hover)").matches) {
  const CURSOR_Y_OFFSET = 17; // sits this many px above the real cursor,
                               // not centered on it (a third of the
                               // previous 50px)

  // scale/autoAlpha start at 0 here (matching the CSS opacity:0/
  // visibility:hidden defaults) purely so GSAP has a tracked starting
  // value to tween *from* on the very first hover — showContextCursor
  // below uses a plain .to(), not .fromTo(), specifically so it can
  // continue smoothly from wherever the cursor currently is instead of
  // resetting to 0 every time (see the comment there).
  gsap.set(contextCursor, { xPercent: -50, yPercent: -50, scale: 0, autoAlpha: 0 });

  const contextCursorX = gsap.quickTo(contextCursor, "x", { duration: 0.3, ease: "power3" });
  const contextCursorY = gsap.quickTo(contextCursor, "y", { duration: 0.3, ease: "power3" });
  // Longer duration than the x/y tweens above — rotation visibly lagging
  // a bit behind the position is what actually reads as "weight" (like
  // something swinging as it's dragged), rather than snapping to match
  // the cursor's direction instantly.
  const contextCursorRotation = gsap.quickTo(contextCursor, "rotation", { duration: 0.5, ease: "power3" });

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let prevMouseX = mouseX;
  let activeCursorTrigger = null;

  const showContextCursor = (trigger) => {
    activeCursorTrigger = trigger;
    contextCursorText.textContent = trigger.dataset.cursor;
    // .to(), not .fromTo(): fromTo hardcodes its starting values on every
    // call, so re-triggering a show while a hide was still fading out
    // (e.g. leaving a trigger then reversing back onto one before the
    // fade finished) would snap the live scale/opacity down to 0 first,
    // then animate back up — a visible "pop". .to() just continues from
    // whatever the current live value already is, so an interrupted hide
    // blends straight into the new show instead of resetting.
    //
    // overwrite: "auto" is the other half of that fix — show/hide each
    // create a brand-new tween instance (unlike the quickTo x/y tweens
    // above, which reuse one persistent tween), so without this, a show
    // triggered while a hide is still mid-flight doesn't hand off control:
    // both tweens keep writing scale/autoAlpha to the element every frame,
    // fighting each other, which is what actually caused the "confused"
    // pop on a fast reversal. This makes the newer tween immediately take
    // exclusive ownership instead of racing the old one.
    gsap.to(contextCursor, { scale: 1, autoAlpha: 1, duration: 0.5, ease: "power3.out", overwrite: "auto" });
  };

  const hideContextCursor = () => {
    activeCursorTrigger = null;
    gsap.to(contextCursor, { scale: 0, autoAlpha: 0, duration: 0.2, ease: "power2.out", overwrite: "auto" });
  };

  // Re-checks what's actually under the cursor, instead of relying only
  // on mouseenter/mouseleave firing on each trigger element. With many
  // small, tightly-packed triggers (like the calendar cards, 12px
  // apart), fast mouse movement can skip past an element fast enough
  // that its mouseleave never fires — leaving the label stuck open even
  // once the cursor is well outside it. This check can't get stuck the
  // same way: it's independent of whichever events did or didn't fire,
  // so a missed mouseleave just gets corrected on the very next check
  // instead of persisting. Shared between mousemove (below) and scroll
  // (further below) — same logic, different source for "what's under
  // the cursor right now".
  const updateHoverTarget = (target) => {
    const hoveredTrigger = target ? target.closest("[data-cursor]") : null;
    if (hoveredTrigger !== activeCursorTrigger) {
      hoveredTrigger ? showContextCursor(hoveredTrigger) : hideContextCursor();
    }
  };

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    contextCursorX(mouseX);
    contextCursorY(mouseY - CURSOR_Y_OFFSET);
    updateHoverTarget(e.target);
  });

  // Also hides it if the pointer leaves the browser window/tab entirely —
  // mousemove stops firing there too, same class of "stuck visible" risk.
  // Using "mouseout" + a null relatedTarget check instead of "mouseleave":
  // mouseleave on document only fires once the browser has actually
  // computed a boundary-crossing transition, and a fast flick off the
  // edge of the window can drop that — the last event it manages to
  // deliver is still the one from over the trigger, and then nothing
  // else fires, leaving the label stuck. mouseout bubbles up from
  // wherever the pointer actually last was, all the way to document, and
  // its relatedTarget is reliably null exactly when there's nowhere left
  // to enter (i.e. it left the page) — that holds up much better under
  // fast movement.
  document.addEventListener("mouseout", (e) => {
    if (!e.relatedTarget && activeCursorTrigger) hideContextCursor();
  });

  // Separate failure mode from the mouse leaving the viewport: losing
  // window focus entirely (fast alt-tab, clicking the address bar,
  // switching apps) doesn't necessarily fire any mouse event at all, so
  // it needs its own independent check.
  window.addEventListener("blur", () => {
    if (activeCursorTrigger) hideContextCursor();
  });

  // Rotation is driven off GSAP's ticker (every animation frame) rather
  // than the mousemove handler itself, so it naturally settles back to 0
  // when the mouse stops — mousemove simply stops firing once the cursor
  // is still, so a rotation computed only inside that handler would be
  // stuck at whatever angle it last had. Computing frame-to-frame
  // horizontal velocity here means it's naturally 0 (nothing moved since
  // last frame) within a frame or two of the mouse actually stopping.
  //
  // The same per-frame callback also re-runs updateHoverTarget, using
  // elementFromPoint at the last known mouse position — this is what
  // catches scrolling: content moves under an otherwise-stationary mouse,
  // so mousemove never fires just because the page scrolled, and a
  // [data-cursor] element sliding into (or out of) that position would
  // never get caught by the mousemove handler alone. Tried listening for
  // a ScrollTrigger/ScrollSmoother scroll event instead of polling every
  // frame here, but nothing fires reliably enough for this virtualized,
  // transform-based scroll — the ticker doesn't care what caused the
  // change, so it can't miss one. elementFromPoint is cheap, and this
  // loop is already running every frame regardless.
  gsap.ticker.add(() => {
    const velocityX = mouseX - prevMouseX;
    prevMouseX = mouseX;
    contextCursorRotation(gsap.utils.clamp(-20, 20, velocityX * 1.5));

    updateHoverTarget(document.elementFromPoint(mouseX, mouseY));
  });
}

// -- SMOOTH SCROLL SETUP -- //
//Turns raw wheel/touch input into eased, lagged scrolling for the whole
//page. Starts paused so the user can't scroll mid-reveal; the reveal
//timeline's onComplete (below) releases it.
//
//`smooth` bumped from .5 to 1.1 to read closer to tech-recruit.com's
//scroll — that site runs on Lenis, a different library with its own
//damping curve, so this is an approximation (matching ScrollSmoother's
//"catch-up" duration to Lenis's typical ~1.2s default) rather than a
//verified match — I can't inspect their actual Lenis config values.
const smoother = ScrollSmoother.create({
  wrapper: "#smooth-wrapper",
  content: "#smooth-content",
  smooth: 1.1, // how long (in seconds) it takes to "catch up" to the native scroll position
  effects: true, // enable effects like data-speed and data-lag
  smoothTouch: 0.1, // much shorter smoothing on touch devices (default is .5)
  normalizeScroll: true,
});
smoother.scrollTo(0, false); // belt-and-suspenders alongside the
                               // scrollRestoration/scrollTo(0,0) pair up
                               // top — ScrollSmoother reads the native
                               // scroll position when it initializes, so
                               // this makes sure ITS OWN internal state
                               // starts at 0 too, not just the browser's
smoother.paused(true);
let introDone = false; // guards against the menu (below) unpausing scroll
                        // if it's somehow closed before the intro reveal
                        // itself has finished and legitimately unpaused it

// -- LOGO REVEAL ANIMATION -- //
//Plays once on load: each shape slides up from behind its own clip-path
//mask, left-to-right pairs revealing from the center outward.
const SHAPE_OFFSETS = {
  "shape-1": 379,
  "shape-2": 254,
  "shape-3": 249,
  "shape-4": 249,
  "shape-5": 249,
  "shape-6": 254,
  "shape-7": 379,
}; // Height of each shape's own bounding box (= its clip-path rect height).
   // Used to push the shape fully below its own mask before revealing it.

const shapeIds = Object.keys(SHAPE_OFFSETS);
const shapeEls = shapeIds.map((id) => document.getElementById(id));

// Start every shape pushed down, fully hidden behind its own clip-path.
gsap.set(shapeEls, {
  y: (i) => SHAPE_OFFSETS[shapeIds[i]],
});

const tl = gsap.timeline({
  defaults: {
    duration: 1.3, // was 1.8 — sped back up by .5s
    ease: CustomEase.create("custom", "M0,0 C0,0 0,0 0,0 0,0.07 0,0 0,0 0,0.083 0,0 0,0 0,0.104 0,0 0,0 0,0.143 0.085,0.937 0.315,1.01 0.468,1.058 0.541,0.964 0.68,0.964 0.775,0.964 0.864,1 1,1 1.059,1 1,1 1,1 "),
  },
  onComplete: () => {
    // Reveal is done — hand control of the page back to the user.
    introDone = true;
    smoother.paused(false);
  },
});

// 4 -> (3,5) -> (2,6) -> (1,7)
tl.to("#shape-4", { y: 0 }, .1)
  .to(["#shape-3", "#shape-5"], { y: 0 }, 0.2)
  .to(["#shape-2", "#shape-6"], { y: 0 }, 0.25)
  .to(["#shape-1", "#shape-7"], { y: 0 }, 0.35);

// -- SCROLL ANIMATION FROM LOGO TO NAV -- //
//Everything below animates the logo from its big centered hero position
//into its docked spot (32px tall, 18px from the top), tracking scroll
//progress from 0 to 50vh. The logo doesn't need to physically live inside
//.navbar — it just needs to end up looking aligned with it — so instead
//of reparenting it into the nav, this measures its natural on-screen rect
//once (while still laid out normally, centered in .hero), then treats it
//as an independent fixed overlay from that point on: only `scale` and `y`
//are animated (cheap, transform-only, no layout thrashing), interpolating
//from "big, at its natural spot" down to "docked". Horizontal centering
//is handled by a constant xPercent:-50, never tweened, so it can't drift
//off-center mid-transition.
const NAV_LOGO_HEIGHT = 40;
const NAV_LOGO_TOP = 18;
const SVG_ASPECT = 1118 / 378; // .hero-logo svg's viewBox ratio (width/height)

const heroLogo = document.querySelector(".hero-logo");

// Once heroLogo is reparented+fixed below, it can no longer answer "how
// big would I naturally be at this viewport width?" — its size is then
// driven by JS, not by the width:60vw/80vw rule in main.css. This hidden
// twin keeps using that same CSS rule (untouched by any of the above),
// so it can be measured at any time — including after a resize — to find
// out what the logo's natural size currently is.
const heroLogoRuler = document.createElement("div");
heroLogoRuler.className = "hero-logo";
heroLogoRuler.style.cssText = "position:absolute; visibility:hidden; height:auto; pointer-events:none;";
heroLogoRuler.setAttribute("aria-hidden", "true");
document.body.appendChild(heroLogoRuler);

// The logo's "natural" size/position — i.e. what it would look like if it
// were still laid out normally, centered in the 100vh hero — recomputed
// from the ruler + current viewport height, rather than a one-time
// measurement, so it stays correct after the window is resized.
function getHeroLogoNaturalRect() {
  const width = heroLogoRuler.getBoundingClientRect().width;
  const height = width / SVG_ASPECT;
  return {
    height,
    top: (window.innerHeight - height) / 2, // .hero centers it in 100vh
  };
}

// Move it out from under the hero (and out of #smooth-content — see the
// comment on #smooth-wrapper in index.html for why) so position:fixed
// keeps tracking the real viewport once the scroll-smoothing transform
// is in play.
document.body.appendChild(heroLogo);

const heroLogoStartRect = getHeroLogoNaturalRect();

gsap.set(heroLogo, {
  position: "fixed",
  top: NAV_LOGO_TOP,
  left: "50%",
  xPercent: -50,
  height: NAV_LOGO_HEIGHT,
  width: "auto",
  zIndex: 100, // below .menu-overlay's 150 (main.css) — the docked logo
               // must never render above the menu
  transformOrigin: "50% 0%",
  scale: heroLogoStartRect.height / NAV_LOGO_HEIGHT,
  y: heroLogoStartRect.top - NAV_LOGO_TOP,
});

// Two distinct eases so scale and position each get their own bezier
// "character" instead of both moving in lockstep — equivalent to CSS
// cubic-bezier() curves, just written in GSAP's CustomEase path syntax
// (the two C control points are the same numbers either way).
const heroToNavMoveEase = CustomEase.create(
  "heroToNavMove",
  "M0,0 C0,0.532 0.471,0.705 1,1" // cubic-bezier(.65,0,.35,1) — smooth ease-in-out
);
const heroToNavScaleEase = CustomEase.create(
  "heroToNavScale",
  "M0,0 C0,0.208 0.24,1 1,1" // cubic-bezier(.83,0,.17,1) — slower start/end,
                             // a sharper snap through the middle than the
                             // move ease, so the shrink reads distinctly
                             // from the rise instead of feeling rubbery
);

// Tracks whether the logo has actually finished docking into the nav —
// used further down (LOGO HOVER + SCROLL TO TOP) to gate its hover-scale
// so hovering the huge hero-sized logo, or catching it mid-transition,
// doesn't trigger it — only once it's fully settled into place.
// onLeave/onEnterBack fire at "docked" (scrolled forward past the end, or
// scrolled back up into contact with it from below — both mean it's
// sitting at its final docked state); onEnter/onLeaveBack fire back to
// "not docked" (still hero-sized, or actively mid-transition).
let heroLogoDocked = false;

const heroToNavTl = gsap.timeline({
  scrollTrigger: {
    trigger: ".hero",
    start: "top top",
    // Function form (not the "+=50vh" string) so this is always exactly
    // half the CURRENT viewport height in px, recalculated on resize —
    // ScrollTrigger's relative-offset shorthand doesn't reliably parse a
    // vh suffix, which is why this used to jump to its end state after
    // barely any scrolling (it was reading "50vh" as ~50px).
    end: () => "+=" + window.innerHeight * 0.5,
    scrub: 1.5, // a deliberate lag behind the scroll position, so the
                // motion visibly catches up rather than tracking 1:1 —
                // combined with ScrollSmoother's own smoothing above,
                // this is what makes the transition feel smooth instead
                // of mechanically tied to the scrollbar.
    invalidateOnRefresh: true, // re-run the function-based from() values
                                // below whenever ScrollTrigger recalculates
                                // (it does this on resize automatically),
                                // instead of reusing whatever was true the
                                // first time this timeline was built.
    onLeave: () => { heroLogoDocked = true; heroLogo.classList.add("hero-logo--docked"); },
    onEnterBack: () => { heroLogoDocked = true; heroLogo.classList.add("hero-logo--docked"); },
    // Also resets any in-progress hover-enlarge back to normal — if the
    // mouse stays put while the page scrolls under it (no mouseleave
    // fires), it could otherwise get stuck enlarged once undocked.
    onEnter: () => {
      heroLogoDocked = false;
      heroLogo.classList.remove("hero-logo--docked");
      gsap.to(heroLogo.querySelector("svg"), { scale: 1, duration: 0.3, ease: navButtonHoverEase });
    },
    onLeaveBack: () => {
      heroLogoDocked = false;
      heroLogo.classList.remove("hero-logo--docked");
      gsap.to(heroLogo.querySelector("svg"), { scale: 1, duration: 0.3, ease: navButtonHoverEase });
    },
  },
});

// Both tweens span the whole timeline (position 0, default duration 1),
// so scrub maps scroll progress 0→1 straight onto each ease curve below —
// slower at the start, fastest through the middle, slower again at the
// end, rather than a flat linear response to how far you've scrolled.
// fromTo (not to) with function-based "from" values, so invalidateOnRefresh
// above can re-measure the ruler and get a fresh natural size after resize
// instead of replaying whatever scale/y happened to be current at the time.
heroToNavTl
  .fromTo(heroLogo,
    { scale: () => getHeroLogoNaturalRect().height / NAV_LOGO_HEIGHT },
    { scale: 1, ease: heroToNavScaleEase },
    0
  )
  .fromTo(heroLogo,
    { y: () => getHeroLogoNaturalRect().top - NAV_LOGO_TOP },
    { y: 0, ease: heroToNavMoveEase },
    0
  );

// -- HERO SCROLL INDICATOR -- //
//Two overlapping chevrons at the bottom of the hero that breathe up and
//down on an infinite loop, then fade out (pure opacity, nothing else) as
//the page scrolls the first 35vh — a "scroll down" hint that gets out of
//the way once the user's actually doing it.
//
//Two independent values drive the breathing loop: the GROUP's own
//shared y (.hero-scroll-indicator — both chevrons move together, since
//the bottom one never gets an offset of its own) and the TOP chevron's
//own extra y on top of that, which is what actually opens/closes the
//gap between them (the bottom one is the fixed reference that gap is
//measured against). Three stages, looping:
//  1. Rise — a small, deliberately understated drift: the group drifts
//     up a little while the top chevron rises even further on top of
//     that, stretching the gap open.
//  2. Squeeze — the top chevron reverses and snaps back down PAST its
//     resting position (overlapping the bottom one more than at rest —
//     -7px instead of -3px) while the group gets pushed down below
//     where it started, as if the top chevron's own downward snap is
//     what shoves the whole pair down. sine.inOut (not an ease-in-only
//     curve) is deliberate here — easing INTO this motion but not back
//     OUT of it read as an abrupt stop right as it hit bottom, like it
//     had slammed into a floor instead of actually settling there.
//  3. Return — both ease back to their resting values (0), closing the
//     loop exactly where it began.
const heroScrollIndicator = document.querySelector(".hero-scroll-indicator");
const heroScrollArrowTop = document.querySelector(".hero-scroll-arrow--top");

if (heroScrollIndicator && heroScrollArrowTop) {
  const heroScrollBreatheTl = gsap.timeline({ repeat: -1 })
    .to(heroScrollIndicator, { y: -4, duration: 0.9, ease: "sine.inOut" }, 0)
    .to(heroScrollArrowTop, { y: -5, duration: 0.9, ease: "sine.inOut" }, 0) // gap: -3 -> +2px (stretched open)
    .to(heroScrollIndicator, { y: 6, duration: 0.5, ease: "sine.inOut" }, 0.9)
    .to(heroScrollArrowTop, { y: 4, duration: 0.5, ease: "sine.inOut" }, 0.9) // gap: -3 -> -7px (squeezed)
    .to(heroScrollIndicator, { y: 0, duration: 0.9, ease: "sine.inOut" }, 1.4)
    .to(heroScrollArrowTop, { y: 0, duration: 0.9, ease: "sine.inOut" }, 1.4);

  // Plain opacity, not autoAlpha — nothing else about it should change
  // as it fades. scrub (not a discrete toggle) so the fade completes
  // exactly BY the time 35vh has been scrolled, not at some arbitrary
  // point within it. The breathing loop pauses once fully faded (and
  // resumes scrolling back up) purely so it isn't animating forever off
  // in the background doing nothing visible.
  gsap.to(heroScrollIndicator, {
    opacity: 0,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: () => "+=" + window.innerHeight * 0.35,
      scrub: true,
      onLeave: () => heroScrollBreatheTl.pause(),
      onEnterBack: () => heroScrollBreatheTl.play(),
    },
  });
}

// -- NAV BUTTON HOVER SWAP -- //
//Each .nav-button-label starts holding just its plain text. This finds
//that text once, then rebuilds the label as: a track (holding the
//original text and an aria-hidden clone, stacked normally, one above the
//other) inside the label. The label is the mask (overflow:hidden, never
//itself moves — see main.css); the track is what actually gets animated.
//Sliding the track up by 50% of ITS OWN height (= exactly one line, since
//it holds two stacked lines) moves the original out through the top of
//the still-static mask as the clone slides in from the bottom, both
//clipped by that mask the whole time. Reverses on mouseleave.
const navButtonHoverEase = CustomEase.create(
  "navButtonHover",
  "M0,0 C0.16,1 0.3,1 1,1" // cubic-bezier(.16,1,.3,1) — "expo.out": fast
                            // out of the gate, long clean deceleration to
                            // a hard stop, no overshoot past the target —
                            // crisp/confident rather than bouncy
);

document.querySelectorAll(".nav-button-label").forEach((label) => {
  const text = label.textContent.trim();
  label.textContent = "";

  const track = document.createElement("span");
  track.className = "nav-button-label-track";

  const original = document.createElement("span");
  original.textContent = text;

  const clone = document.createElement("span");
  clone.textContent = text;
  clone.setAttribute("aria-hidden", "true");

  track.append(original, clone);
  label.append(track);

  // Falls back to the nearest link when there's no .nav-button ancestor
  // (the menu items reuse just this text-slide, not the pill/scale) —
  // the scale tween below only runs when a real .nav-button was found,
  // so those get text-slide-only, matching a plain nav button minus the
  // scale.
  const button = label.closest(".nav-button");
  const hoverTarget = button || label.closest("a") || label;

  // The scale lives on `button` (not track/label), so it's a transform on
  // top of the whole pill — purely visual, doesn't touch layout/flex gap.
  hoverTarget.addEventListener("mouseenter", () => {
    gsap.to(track, { yPercent: -50, duration: 0.4, ease: navButtonHoverEase });
    if (button) gsap.to(button, { scale: 1.05, duration: 0.4, ease: navButtonHoverEase });
  });
  hoverTarget.addEventListener("mouseleave", () => {
    gsap.to(track, { yPercent: 0, duration: 0.4, ease: navButtonHoverEase });
    if (button) gsap.to(button, { scale: 1, duration: 0.4, ease: navButtonHoverEase });
  });
});

// -- NAVBAR COLOR SWAP -- //
//The navbar itself has no background (see .navbar in main.css) — the
//Menu button is the only thing in it that needs to stay readable, so its
//own color/border swap to white (via .navbar--light, toggled on .navbar
//itself) is all this drives. Two independent things want that white
//state: scrolling over a black-background section (testimonials/gallery
//— NOT the footer, deliberately left out), and having the menu open (its
//own red overlay — see MENU OVERLAY below). Tracked as two separate
//flags rather than toggling the class straight from either trigger,
//since otherwise closing the menu while still scrolled over a dark
//section (or the reverse) would incorrectly clear the white state the
//OTHER trigger still wants active.
const navbarEl = document.querySelector(".navbar");
let navOnDarkSection = false;
let navMenuOpen = false;

const updateNavbarColor = () => {
  navbarEl.classList.toggle("navbar--light", navOnDarkSection || navMenuOpen);
};

if (navbarEl) {
  // One continuous trigger spanning both dark sections (they're
  // consecutive in the page, no light section between them) rather than
  // two separate ones — simpler, and avoids any gap/overlap edge case
  // between them.
  ScrollTrigger.create({
    trigger: ".testimonials-section",
    start: "top top",
    endTrigger: ".gallery-section",
    end: "bottom bottom",
    onEnter: () => { navOnDarkSection = true; updateNavbarColor(); },
    onLeave: () => { navOnDarkSection = false; updateNavbarColor(); },
    onEnterBack: () => { navOnDarkSection = true; updateNavbarColor(); },
    onLeaveBack: () => { navOnDarkSection = false; updateNavbarColor(); },
  });
}

// -- MENU BUTTON HAMBURGER ICON -- //
//A paused, built-once timeline morphing the three bars into an X: the top
//and bottom bars rotate 45°/-45° and slide 6px to meet at the middle
//bar's position (6px is the gap between bars — see .hamburger-line in
//main.css), while the middle bar shrinks away. Played/reversed together
//with the menu overlay below, off the same open/close state — not wired
//to its own click handler here.
const menuButton = document.querySelector(".nav-button--menu");
let hamburgerTl;

if (menuButton) {
  const [topLine, midLine, bottomLine] = menuButton.querySelectorAll(".hamburger-line");

  hamburgerTl = gsap.timeline({
    paused: true,
    defaults: { duration: 0.35, ease: "power2.inOut" },
  });

  hamburgerTl
    .to(topLine, { y: 6, rotate: 45 }, 0)
    .to(midLine, { opacity: 0, scale: 0 }, 0)
    .to(bottomLine, { y: -6, rotate: -45 }, 0);
}

// -- MENU OVERLAY -- //
//Opens together with the hamburger icon above, on the same click. A
//single full-page red panel (.menu-overlay — .menu-window, a separate
//smaller box docked under the button, is gone, folded into this) slides
//up from below the viewport (yPercent 100 -> 0) — a pure position slide,
//deliberately no opacity/fade blended into it — while the 5 menu items
//reveal the same mechanic the hero logo uses on load — each one starts
//pushed down inside its own overflow:hidden mask (.menu-item) and slides
//up into view, staggered — but with navButtonHoverEase (no overshoot)
//rather than the hero reveal's bouncier one, which read as too playful
//for a menu.
//
//autoAlpha is still used, just not as part of the visible motion: it's
//set instantly (via .set, not tweened) the moment the slide starts, and
//reset instantly once the slide back down finishes — purely so the panel
//isn't focusable/interactive while sitting off-screen, without that
//toggle itself reading as a fade.
//
//Closing is intentionally NOT menuTl played backwards: reversing the
//staggered item reveal (even sped up) still reads as items "un-stacking"
//one at a time, which feels slow no matter the duration. Closing is its
//own short, single slide of the whole panel back down — quick and final
//rather than a mirror of the entrance.
const menuOverlay = document.querySelector(".menu-overlay");
const menuItemLinks = gsap.utils.toArray(".menu-item a");
const MENU_CLOSE_DURATION = 0.4;

if (menuButton && menuOverlay && menuItemLinks.length) {
  gsap.set(menuOverlay, { yPercent: 100, autoAlpha: 0 });

  const menuTl = gsap.timeline({ paused: true })
    .set(menuOverlay, { autoAlpha: 1 }, 0)
    .to(menuOverlay, { yPercent: 0, duration: 0.6, ease: "power3.out" }, 0)
    .fromTo(menuItemLinks,
      { yPercent: 100 },
      { yPercent: 0, duration: 0.8, ease: navButtonHoverEase, stagger: 0.08 },
      0.2
    );

  // menuTl's own yPercent tween and closeMenu's standalone one below both
  // target the SAME property on the SAME element. GSAP's overwrite:"auto"
  // doesn't help here — it only resolves conflicts at the moment a tween
  // is CREATED, and menuTl's tween was already created once up front;
  // .restart() just replays it, it doesn't re-run that check against
  // whatever's active right now. So a fast re-toggle (close, then open
  // again before the close finishes) would leave both tweens running at
  // once, fighting over yPercent every frame — and the orphaned close
  // tween's onComplete would still fire on its own original schedule and
  // set autoAlpha:0, hiding the menu again even though the open tween
  // "won" visually. Tracking the close tween explicitly and killing it
  // before restarting the open timeline sidesteps all of that.
  let menuCloseTween = null;

  const openMenu = () => {
    menuButton.setAttribute("aria-expanded", "true");
    hamburgerTl.play();
    if (menuCloseTween) menuCloseTween.kill(); // cancel any in-flight
                                                 // close (and its
                                                 // onComplete) first
    menuTl.restart(); // always the full entrance from scratch, even if a
                       // previous close cut it off partway through
    smoother.paused(true); // no scrolling while the menu is open
    navMenuOpen = true; // white nav text/border while the red panel is
                         // behind it — see NAVBAR COLOR SWAP above
    updateNavbarColor();
  };

  const closeMenu = () => {
    menuButton.setAttribute("aria-expanded", "false");
    hamburgerTl.reverse();
    menuTl.pause(); // stop the entrance wherever it currently is, so the
                     // close tween below isn't fighting it for control of
                     // the same properties
    if (introDone) smoother.paused(false); // don't re-enable scroll here
                                            // if the intro reveal hasn't
                                            // legitimately unpaused it yet
    menuCloseTween = gsap.to(menuOverlay, {
      yPercent: 100,
      duration: MENU_CLOSE_DURATION,
      ease: "power2.out",
      onComplete: () => gsap.set(menuOverlay, { autoAlpha: 0 }),
    });
    navMenuOpen = false;
    updateNavbarColor(); // back to whatever navOnDarkSection alone says
  };

  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });

  // Click on empty space (not a link/icon) closes it — the panel is
  // full-viewport now, but plenty of empty red space still surrounds the
  // centered content, same idea the old smaller backdrop click used.
  menuOverlay.addEventListener("click", (e) => {
    if (e.target === menuOverlay) closeMenu();
  });

  // Escape closes it too — standard for this kind of overlay.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
      closeMenu();
    }
  });

  // Clicking a menu item closes the menu and scrolls to its section —
  // via ScrollSmoother's own .scrollTo(), not a plain anchor jump, since
  // plain jumps don't account for its virtualized scroll transform (see
  // the note on #smooth-wrapper in index.html for the same issue
  // elsewhere on this site).
  menuItemLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      smoother.scrollTo(target, true);
    });
  });

  // Non-hovered items dim to 60% opacity while one is hovered — a plain
  // CSS transition (see .menu-item a's own transition:opacity in
  // main.css), not a GSAP tween; simple enough not to need one. Scoped
  // to .menu-item (not the <a> directly) so it fires on the full row's
  // hit area, matching the same element NAV BUTTON HOVER SWAP above
  // falls back to for its own text-slide on these same links.
  gsap.utils.toArray(".menu-item").forEach((item) => {
    const link = item.querySelector("a");
    item.addEventListener("mouseenter", () => {
      menuItemLinks.forEach((otherLink) => {
        if (otherLink !== link) otherLink.style.opacity = 0.6;
      });
    });
    item.addEventListener("mouseleave", () => {
      menuItemLinks.forEach((otherLink) => { otherLink.style.opacity = ""; });
    });
  });
}

// -- MENU SOCIAL LINKS -- //
//Background/icon color swap on hover, animated (not a plain CSS :hover)
//to match how every other interactive element on the site behaves.
//Animating the link's own `color` is enough to move the icon too — the
//SVGs use currentColor for their stroke/fill, so it follows automatically.
document.querySelectorAll(".menu-social-link").forEach((link) => {
  link.addEventListener("mouseenter", () => {
    gsap.to(link, { backgroundColor: "#FFFFFF", color: "#111111", duration: 0.3, ease: "power2.out" });
  });
  link.addEventListener("mouseleave", () => {
    gsap.to(link, { backgroundColor: "transparent", color: "#FFFFFF", duration: 0.3, ease: "power2.out" });
  });
});

// -- INTRO TEXT REVEAL -- //
//Each letter is masked and slides up individually, staggered, rather than
//the whole heading moving as one block. SplitText fragments text into one
//<span> per character, which breaks native selection/copy on whatever it
//splits — so it's never run on the real heading. Instead, a purely visual
//<div> clone of it (.intro-text-heading--decorative, aria-hidden, stacked
//exactly on top via CSS — see main.css) is what actually gets split and
//animated. The real <h2> underneath (.intro-text-heading--real) stays a
//normal, single text node the whole time: selectable, copyable, and read
//normally by screen readers.
//
//Wrapped in document.fonts.ready because SplitText measures each
//character's actual rendered position to do the split — if it ran before
//the custom @font-face (Katarine) finishes loading, it would split against
//fallback-font metrics and the layout would shift once the real font
//swaps in.
//
//Not scrubbed — plays as its own timed animation once triggered, not
//tracked to scroll position. toggleActions "restart none none reset" is
//what makes it replayable: scrolling down INTO the trigger point always
//restarts it from scratch, scrolling back UP past it resets to hidden —
//so scrolling back down again replays the full animation instead of
//showing it already-finished.
document.fonts.ready.then(() => {
  const introTextReal = document.querySelector(".intro-text-heading--real");
  if (!introTextReal) return;

  const introTextDecorative = document.createElement("div");
  introTextDecorative.className = "intro-text-heading intro-text-heading--decorative";
  introTextDecorative.setAttribute("aria-hidden", "true");
  introTextDecorative.textContent = introTextReal.textContent;
  introTextReal.insertAdjacentElement("afterend", introTextDecorative);

  // type:"words, chars" (not just "chars") — SplitText wraps each word in
  // its own stable container first, which is what tells the browser's
  // line-breaking algorithm "these characters belong together". Splitting
  // straight to chars with no word-level grouping was letting the browser
  // wrap wherever it liked between any two letters, including mid-word.
  const introTextSplit = new SplitText(introTextDecorative, { type: "words, chars" });

  // Give each character its own overflow:hidden mask — this is what makes
  // "slides up from behind a mask" happen per letter instead of the whole
  // heading moving/clipping as one block.
  introTextSplit.chars.forEach((char) => {
    const mask = document.createElement("span");
    mask.className = "intro-text-char-mask";
    char.parentNode.insertBefore(mask, char);
    mask.appendChild(char);
  });

  gsap.set(introTextSplit.chars, { yPercent: 100 });

  gsap.to(introTextSplit.chars, {
    yPercent: 0,
    duration: 0.6,
    stagger: 0.02,
    ease: navButtonHoverEase,
    scrollTrigger: {
      trigger: ".intro-text",
      start: "top 75%", // roughly "25vh into the section entering view" —
                         // see the comment on this exact line's earlier
                         // version in project history for the arithmetic
      toggleActions: "restart none none reset",
    },
  });
});

// -- INTRO ARROWS PARALLAX -- //
//24 decorative Arrow_Up icons scattered behind the "Jsme platforma..."
//heading, in 3 sizes (.intro-arrow--lg/md/sm in main.css). Built here
//rather than hardcoded as 24 near-identical inline-SVG blocks in
//index.html — the layout is really just a data table (which tier, where),
//so that table lives here and the DOM gets generated from it, same spirit
//as SHAPE_OFFSETS/arrowLayout elsewhere in this file.
//
//Positions come from a 6x4 grid (one arrow per cell, jittered within a
//safe inner margin), not pure random placement — that's what guarantees
//none of them ever touch: every cell is sized bigger than its arrow's own
//bounding box plus a shared gap, so two arrows in neighboring cells can
//never land closer than that gap to each other no matter how the jitter
//lands. Generated once offline against a 1600x900 reference box and
//hardcoded below as plain left/top percentages (of .intro-arrows' own
//box) — nothing about this layout needs recomputing at runtime.
const INTRO_ARROW_TIERS = {
  // Feeds ScrollSmoother's own data-speed effect below: speed > 1 scrolls
  // faster than the page, < 1 scrolls slower — so the largest/"closest"
  // arrows visibly outrun the smallest/"furthest" ones as this section
  // scrolls by, same depth-layering logic as a real parallax scene.
  lg: { speed: 1.6 },
  md: { speed: 1.15 },
  sm: { speed: 0.7 },
};

// The first entry is deliberately the one sitting right at the section's
// top edge, clear of the centered heading — it's what's already on screen
// the instant .intro-text starts entering the viewport from the hero
// above, so there's no blank beat before any arrow shows up.
//
// Two "sm" entries (marked below) sit noticeably lower than the grid cell
// they were generated in. clamp() (see the .effects() call further down)
// stops the parallax from leaking past scroll position 0 in general, but
// it doesn't zero out the offset for something that's simply not centered
// in the viewport yet — a "sm" arrow (speed 0.7, i.e. the tier that lags
// BEHIND normal scroll) sitting near this section's top edge still gets
// dragged upward by tens of px at scroll 0, which was enough to poke it
// up into the hero above before any scrolling had happened. "lg"/"md"
// (speed > 1) don't have this problem — they lag the other way, further
// INTO the section, not out of it. Moving these two down past roughly the
// section's own vertical midpoint gives the lag enough room to happen
// inside .intro-text's own bounds instead of spilling out its top.
const INTRO_ARROWS_LAYOUT = [
  { tier: "lg", left: 22.50, top: 6.07 },
  { tier: "sm", left: 35.76, top: 46.00 }, // pushed down from 5.11
  { tier: "lg", left: 54.78, top: 93.90 },
  { tier: "md", left: 90.79, top: 64.68 },
  { tier: "sm", left: 5.42, top: 37.65 },
  { tier: "md", left: 90.11, top: 34.93 },
  { tier: "lg", left: 26.07, top: 38.66 },
  { tier: "sm", left: 80.93, top: 91.19 },
  { tier: "md", left: 30.86, top: 68.64 },
  { tier: "sm", left: 82.20, top: 40.98 },
  { tier: "md", left: 70.40, top: 18.71 },
  { tier: "sm", left: 65.15, top: 45.72 },
  { tier: "sm", left: 42.68, top: 91.84 },
  { tier: "sm", left: 87.43, top: 94.23 },
  { tier: "md", left: 42.67, top: 58.80 },
  { tier: "sm", left: 51.93, top: 69.69 },
  { tier: "md", left: 15.03, top: 5.42 },
  { tier: "lg", left: 62.10, top: 11.27 },
  { tier: "lg", left: 70.62, top: 59.67 },
  { tier: "md", left: 12.01, top: 68.92 },
  { tier: "sm", left: 84.98, top: 48.00 }, // pushed down from 14.83
  { tier: "lg", left: 2.63, top: 90.50 },
  { tier: "sm", left: 22.52, top: 95.23 },
  { tier: "md", left: 48.24, top: 37.59 },
];

const introArrowsContainer = document.querySelector(".intro-arrows");

if (introArrowsContainer) {
  // Same path data as .video-arrow-icon elsewhere in this file/index.html
  // — same icon, reused fill="currentColor" so .intro-arrow's CSS color
  // controls it.
  const ARROW_PATH_D = "M11.9158 44.9811H2.99431C1.62107 44.9811 -1.35275 42.6893 0.702551 39.1517L21.8649 1.3923C22.8925 -0.326517 25.639 -0.553876 26.6667 1.27407L47.829 39.2608C48.7475 41.0887 48.9749 44.9811 45.5372 44.9811H36.2702C33.9784 44.9811 32.8417 46.4725 32.8417 49.4464V80.2213C32.8417 82.8496 31.814 84.2228 29.6405 84.2228H19.0002C16.5993 84.2228 15.4534 82.9678 15.4534 80.5578V48.8643C15.4534 46.2361 14.3076 44.972 11.9067 44.972";

  INTRO_ARROWS_LAYOUT.forEach(({ tier, left, top }) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 49 85");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("intro-arrow", `intro-arrow--${tier}`);
    gsap.set(svg, { left: `${left}%`, top: `${top}%` });

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ARROW_PATH_D);
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);

    introArrowsContainer.appendChild(svg);
  });

  // Wired up programmatically (rather than static data-speed attributes)
  // because these elements don't exist yet at the ScrollSmoother.create()
  // call above — .effects() is the documented way to apply speed/lag to
  // anything added to the DOM afterward. One call per tier since each
  // needs its own speed.
  //
  // speed is wrapped in clamp(...) — plain data-speed only reaches its
  // authored position once the element is vertically centered in the
  // viewport, which means anything not yet centered (like this whole
  // section on page load, still a screen below the hero) starts out
  // already displaced from where it's actually laid out. That was why
  // the arrows were visible, overflowing above the section, before any
  // scrolling had happened. clamp() keeps that same speed effect during
  // normal scrolling but stops it from "leaking" past the page's own
  // bounds — so at scroll position 0 every arrow sits exactly at its
  // authored spot (fully inside the section, nothing poking out into the
  // hero above), and the parallax only actually starts once real
  // scrolling carries it away from there.
  Object.entries(INTRO_ARROW_TIERS).forEach(([tier, { speed }]) => {
    smoother.effects(introArrowsContainer.querySelectorAll(`.intro-arrow--${tier}`), { speed: `clamp(${speed})` });
  });
}

// -- CARD STACK REVEAL -- //
//Three cards slide up from below, one at a time, and appear to "stick"
//once they arrive. .cards-stack is pinned for the entire height of
//.cards-section — GSAP's own pin, not CSS position:sticky, since
//ScrollSmoother moves #smooth-content via a transform, and a transform'd
//ancestor breaks native sticky the same way it breaks position:fixed
//(see the comment on #smooth-wrapper in index.html for the same issue
//elsewhere on this site). .cards-heading "becomes sticky" the exact same
//way — it's pinned together with the row as part of the same
//.cards-stack, so the moment the pin engages is already the moment the
//first card starts moving; no separate trigger needed to keep those two
//in sync.
//
//The cards already sit in their final overlapping horizontal layout from
//the start (see .card--2/.card--3's margin-left in main.css) — only
//vertical position and rotation are animated here, each card rising from
//fully hidden AND flat (rotation:0) into its own tilted resting spot
//(see CARD_REST below). Each card's reveal now occupies a back-to-back
//slot (position i * 0.6, duration 0.6) in a single scrubbed timeline, so
//card 2's tween starts the instant card 1's ends — no dead scroll in
//between where nothing visibly moves, which used to read as a jarring
//pause. A trailing no-op tween pads the timeline with a held pause after
//all three have arrived, so scrolling further doesn't immediately spill
//into whatever section comes after this one.
const cards = gsap.utils.toArray(".card");

if (cards.length) {
  // Each card needs to start fully below the viewport. The offset for
  // that has to be computed from the card's position RELATIVE TO
  // .cards-stack, not card.getBoundingClientRect().top on its own —
  // .cards-section sits ~200vh down the page (after the hero and
  // intro-text sections), so at the moment this script runs (page load,
  // scroll position 0) that raw top value reflects the card being far
  // below the CURRENT viewport, not its eventual position once pinned.
  // That previously produced a large NEGATIVE offset — pushing cards UP
  // near/past their resting spot instead of down out of view, which is
  // exactly why they were visible immediately and appeared to slide DOWN
  // into place while scrolling, backwards from the intended effect.
  // The card's offset relative to .cards-stack's own top, though, is
  // stable regardless of scroll position — it's just .cards-row's fixed
  // CSS position (see main.css) — and once pinned, .cards-stack's top
  // will sit at the viewport's own top (y:0), so viewport height minus
  // that stable offset is the correct amount to push each card down by.
  const cardsStackEl = document.querySelector(".cards-stack");
  const FIRST_CARD_PEEK = 80; // px of card--1 left showing above the
                               // viewport's bottom edge before its own
                               // reveal tween starts — same "don't start
                               // from a hard blank" idea as the intro
                               // arrows' deliberately-placed first arrow

  // Each card's RESTING state, once it arrives — not just y:0/rotation:0
  // for all three anymore. The y values stagger the row into a slight
  // "staircase" (card 2 sits 16px lower than card 1, card 3 40px lower —
  // trimmed down from an earlier 24px/96px: combined with card--3's own
  // 10° tilt, resting that much lower pushed its rotated bounding box
  // low enough to also risk crossing the BOTTOM of the viewport on
  // shorter screens, not just its sides), and the rotation values give
  // each card its own fixed tilt, both measured from the card's own
  // natural, unrotated CSS position/size — exactly what gsap.set below
  // with rotation:0 establishes as the starting point, so "0 degrees at
  // rest off-screen, rotating INTO its tilt as it rises" is literally
  // what the tween from that start to this end does.
  const CARD_REST = [
    { y: 0, rotation: -4 },  // card--1: tilts left 4°
    { y: 16, rotation: -1 }, // card--2: left 1°, rests 16px lower than card 1
    { y: 40, rotation: 10 }, // card--3: right 10°, rests 40px lower than card 1
  ];

  cards.forEach((card, i) => {
    const cardOffsetInStack = card.getBoundingClientRect().top - cardsStackEl.getBoundingClientRect().top;
    const hiddenY = window.innerHeight - cardOffsetInStack + 20;
    gsap.set(card, { y: i === 0 ? hiddenY - FIRST_CARD_PEEK : hiddenY, rotation: 0 });
  });

  const cardsTl = gsap.timeline({
    scrollTrigger: {
      trigger: ".cards-section",
      start: "top top",
      end: "bottom bottom",
      pin: ".cards-stack",
      scrub: true, // exact 1:1 tracking (not a laggy number, unlike some
                    // other scrubs on this site) — precise arrival timing
                    // matters more here than a smoothed catch-up feel
    },
  });

  cards.forEach((card, i) => {
    // power3.out (up from power1.out): a more pronounced deceleration
    // right as the card reaches its resting spot, so the settle reads as
    // a deliberate soft landing rather than just gently trailing off.
    // Positioned at i * 0.6 (0, 0.6, 1.2) instead of i (0, 1, 2) — each
    // duration:0.6 tween now fills its ENTIRE slot back-to-back, instead
    // of leaving 0.4 of dead scroll after every arrival before the next
    // card's tween began.
    cardsTl.to(card, { ...CARD_REST[i], duration: 0.6, ease: "power3.out" }, i * 0.6);
  });

  cardsTl.to({}, { duration: 0.04 }); // trailing hold — just enough to
  // avoid an instant jump-cut into the next section the moment the third
  // card lands, not a real pause. scrub maps this section's ENTIRE real
  // scroll distance (.cards-section is 400vh tall, minus the 100vh
  // viewport the pin releases at "bottom bottom" = 300vh of actual
  // scrolling) proportionally onto the timeline's total duration — so a
  // hold that's, say, 10% of the timeline isn't a small thing, it's ~30vh
  // of dead scroll. That's what was still "awkward" even after the
  // previous cut from 1 down to 0.3. At this size (~1.5% of the timeline)
  // it's only a few vh — barely felt as a pause, not as broken scroll.
}

// -- CONTACTS PHOTOS REVEAL -- //
//Each of the 3 photo+text items slides up and fades in as the row
//scrolls into view — same "top 80%"/once:true pattern as PROGRAMS
//SECTION REVEAL and CALENDAR EVENT REVEAL above (plays once, never
//resets on scrolling back up), but a single shared trigger (the row
//itself) with a stagger, not one trigger per item — the row is short
//enough that all 3 cross "top 80%" together anyway, so separate triggers
//would just fire back to back with no real scroll distance between them.
gsap.utils.toArray(".contact-person").forEach((person) => {
  gsap.set(person, { y: 60, autoAlpha: 0 });
});

gsap.to(".contact-person", {
  y: 0,
  autoAlpha: 1,
  duration: 0.8,
  stagger: 0.15, // "a little delay" on the 2nd and 3rd items
  ease: "power3.out",
  scrollTrigger: {
    trigger: ".contacts-photos",
    start: "top 80%",
    once: true,
  },
});

// -- PROGRAMS SECTION REVEAL -- //
//Each item's image scales up from 0 to full size as that item
//individually scrolls into view — separate triggers per item, so each
//plays exactly when ITS OWN item reaches the trigger point rather than
//all firing together off one shared trigger.
//
//transformOrigin "left bottom" is what makes it grow up-and-right from
//that corner instead of the default center-out scale.
//
//The trigger is .program-item, not .program-image itself: scale:0 is
//applied via a CSS transform, and transforms are baked into
//getBoundingClientRect() — so the image's OWN rect would collapse to a
//near-zero point at its transform-origin corner the moment it's set,
//throwing off ScrollTrigger's start-position math if it were reading
//position from that same collapsing element. .program-item's box is
//never transformed, so it stays a stable, correctly-sized reference.
//
//once:true — plays the one time the item scrolls into view and then
//stays revealed for good; it doesn't reset/replay on scrolling back up.
gsap.utils.toArray(".program-item").forEach((item, i) => {
  const img = item.querySelector(".program-image");
  if (!img) return;

  gsap.set(img, { scale: 0, transformOrigin: "left bottom" });

  gsap.to(img, {
    scale: 1,
    duration: 0.8,
    // Items share a row 3-at-a-time (grid-column: span 4 on the 12-column
    // grid), so without this every item in a row would hit "top 80%" at
    // essentially the same scroll position and pop in together. Staggering
    // by column position (i % 3) instead plays them left to right, like
    // dominoes next to each other.
    delay: (i % 3) * 0.15,
    ease: "power3.out",
    scrollTrigger: {
      trigger: item,
      start: "top 80%", // roughly "20vh into the viewport" — same
                         // arithmetic as the "top 75%"/"25vh" trigger on
                         // INTRO TEXT REVEAL earlier
      once: true,
    },
  });
});

// -- CALENDAR EVENT REVEAL -- //
//Each event card slides up AND fades in from 0 opacity into place as it
//individually scrolls into view — same "top 80%"/once:true pattern as
//PROGRAMS SECTION REVEAL above: its own trigger per card, plays once,
//never resets on scrolling back up.
//
//Cards sit two per row (.calendar-event: grid-column span 6 on the
//12-column .calendar-grid, see main.css) — the right-hand one in each
//pair gets a small delay so a row doesn't pop in as one flat block.
gsap.utils.toArray(".calendar-event").forEach((event, i) => {
  gsap.set(event, { y: 60, autoAlpha: 0 });

  gsap.to(event, {
    y: 0,
    autoAlpha: 1,
    duration: 0.8,
    delay: i % 2 === 1 ? 0.15 : 0,
    ease: "power3.out",
    scrollTrigger: {
      trigger: event,
      start: "top 80%",
      once: true,
    },
  });
});

// -- TESTIMONIALS CARD HEIGHT -- //
//All 9 cards share one height: the tallest card's own natural
//(content-driven) height, measured before anything is fixed — a card
//that already had an explicit height set couldn't tell you what its own
//natural height should be, same reasoning as CONTACTS ACCORDION above.
const testimonialItems = gsap.utils.toArray(".testimonial-item");

if (testimonialItems.length) {
  const tallestTestimonialHeight = Math.max(...testimonialItems.map((item) => item.offsetHeight));
  testimonialItems.forEach((item) => {
    item.style.height = tallestTestimonialHeight + "px";
  });
}

// -- TESTIMONIALS DRAG SCROLL -- //
//.testimonials-track is dragged horizontally inside the .testimonials-
//scroll mask. Draggable's own `bounds` option (given the mask element)
//already does the "can't drag past either end" clamping — no manual
//min/max math needed.
//
//Beyond the drag itself, each card's visibility is a state machine, not a
//continuous scroll-linked blend: once a card drops to ~5% visible at
//either edge it's cut instantly (gsap.set, no tween) — no slow shrink.
//Coming back the other way, it scales up FROM whichever side it was cut
//off on (transformOrigin "left" if it was hidden past the mask's left
//edge, "right" if past the right), so it visibly grows out of the
//direction it's being dragged in from, rather than just fading in place.
//
//A WeakMap tracks each card's last-known shown/hidden state so the
//hide/show logic only fires once PER CROSSING of the 5% line, not on
//every single drag frame — re-running gsap.to() every frame while a card
//sits fully visible (or fully hidden) would be pointless work at best
//and, if two calls overlapped, the same kind of fighting-tweens glitch
//fixed on the context cursor's hover pop earlier in this project.
//
//Position is read via offsetLeft/offsetWidth, NOT item.getBoundingClientRect()
//— once a card is hidden it's sitting at scale:0, and getBoundingClientRect()
//bakes transforms into its result, so a scaled-to-0 card's own rect
//collapses to a near-zero point and can never be measured as "visible"
//again (this was the actual bug: cards disappeared and never came back).
//offsetLeft/offsetWidth are pure layout values — completely unaffected by
//the card's own transform — so they stay correct no matter its scale.
//.testimonials-track itself is never scaled, only translated by
//Draggable, so its own getBoundingClientRect() stays reliable throughout;
//combining that with each card's offsetLeft (relative to the track,
//thanks to .testimonials-track's position:relative — see main.css) gives
//each card's true on-screen position regardless of its current scale.
const testimonialsTrack = document.querySelector(".testimonials-track");
const testimonialsScroll = document.querySelector(".testimonials-scroll");

if (testimonialsTrack && testimonialsScroll && testimonialItems.length) {
  const VISIBLE_THRESHOLD = 0.05; // 5% visible or less reads as "gone"
  const testimonialVisible = new WeakMap();
  testimonialItems.forEach((item) => testimonialVisible.set(item, true));

  const updateTestimonialEdges = () => {
    const maskRect = testimonialsScroll.getBoundingClientRect();
    const trackRect = testimonialsTrack.getBoundingClientRect();

    testimonialItems.forEach((item) => {
      const itemLeft = trackRect.left + item.offsetLeft;
      const itemRight = itemLeft + item.offsetWidth;
      const visibleWidth = Math.max(0,
        Math.min(itemRight, maskRect.right) - Math.max(itemLeft, maskRect.left)
      );
      const isVisible = (visibleWidth / item.offsetWidth) > VISIBLE_THRESHOLD;

      if (isVisible === testimonialVisible.get(item)) return; // no crossing, nothing to do
      testimonialVisible.set(item, isVisible);

      if (isVisible) {
        const hiddenOnLeft = itemLeft < maskRect.left;
        gsap.set(item, { transformOrigin: hiddenOnLeft ? "left center" : "right center" });
        gsap.to(item, { scale: 1, opacity: 1, duration: 0.35, ease: "power2.out", overwrite: "auto" });
      } else {
        gsap.set(item, { scale: 0, opacity: 0 });
      }
    });
  };

  Draggable.create(testimonialsTrack, {
    type: "x",
    bounds: testimonialsScroll,
    inertia: true,
    onDrag: updateTestimonialEdges,
    onThrowUpdate: updateTestimonialEdges,
  });

  updateTestimonialEdges(); // initial state — the last few cards start
                              // partly/fully outside the mask, hidden
                              // instantly with no animation on load
  window.addEventListener("resize", updateTestimonialEdges);
}

// -- GALLERY WHEEL REVEAL -- //
//15 photos stream bottom-to-top through .gallery-stack (pinned for the
//whole .gallery-scroll height — see main.css), each one scaling 0% -> 100%
//-> 100% -> 0% as it crosses the vertical middle and following a gentle
//side-to-side curve rather than a straight vertical line — the "looking
//at a slightly-off-axis rotating wheel from the side" effect: no rotation
//is ever applied to a photo itself (it always stays flat/facing the
//camera), the scale change alone is what reads as it swinging closer then
//further away.
//
//This is driven by a single standalone ScrollTrigger (no linked tween/
//timeline — with 15 items each needing its own position+scale+curve
//formula every frame, one ScrollTrigger reading self.progress and writing
//directly via gsap.set in a loop is both simpler and cheaper than 15
//separate scrubbed tweens) using the same tall-wrapper-plus-pinned-100vh-
//stack split CARD STACK REVEAL above uses: .gallery-scroll (tall)
//provides the scroll distance, .gallery-stack (100vh) is what actually
//gets pinned.
const galleryItems = gsap.utils.toArray(".gallery-image-wrap");

if (galleryItems.length) {
  const GALLERY_VISIBLE_AT_ONCE = 7; // how many photos are mid-flight
                                       // (somewhere between bottom and
                                       // top) at the same scroll moment —
                                       // the actual "how close together /
                                       // how much overlap" knob. Raising
                                       // this spreads each photo's own
                                       // journey across a bigger slice of
                                       // the scroll range, so more of them
                                       // overlap in flight at once.
  const GALLERY_EDGE_MARGIN = 0.18; // fraction of the viewport's own half-
                                      // height that each photo's bottom/top
                                      // turning point sits IN FROM the
                                      // actual edge — a photo never travels
                                      // all the way out to (or past) the
                                      // real edge, it turns around while
                                      // still clearly inside the frame.
                                      // Higher = more breathing room at the
                                      // top/bottom, but also a shorter
                                      // overall journey for each photo.

  // Deterministic pseudo-random per index (classic GLSL-style hash) —
  // gives each photo its own fixed curve amplitude/direction, unlike
  // Math.random() which would reshuffle every reload for no benefit
  // (these are placeholder photos, but the CURVE pattern itself should
  // stay put so the effect doesn't visibly "jump" between refreshes).
  const seededRandom = (seed) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  // spacing = how much of the ScrollTrigger's own 0-1 progress separates
  // each photo's start from the next; span = how much of that same 0-1
  // progress one photo's own bottom-to-top journey takes. Solved so that
  // (count - 1) * spacing + span lands exactly on 1 — the last photo
  // finishes its journey exactly as the pin's own scroll distance runs
  // out, with GALLERY_VISIBLE_AT_ONCE photos overlapping in flight at any
  // moment in between.
  const spacing = 1 / (galleryItems.length - 1 + GALLERY_VISIBLE_AT_ONCE);
  const span = GALLERY_VISIBLE_AT_ONCE * spacing;

  // Fixed per-photo z-index, assigned once here and never touched again
  // — deliberately NOT recomputed from scale every frame. Tying it to
  // scale (biggest-on-top) meant the stacking order kept reshuffling as
  // two overlapping photos grew/shrank past each other, which read as
  // distracting flicker. A z-index fixed for a photo's entire lifetime
  // means whichever one lands on top during an overlap is arbitrary —
  // it just doesn't change mid-flight anymore.
  galleryItems.forEach((item, i) => {
    gsap.set(item, { zIndex: Math.round(seededRandom(i + 500) * galleryItems.length) });
  });

  // Per-photo layout (travel distance, curve amplitude) all depend on
  // viewport size — computed once up front and recomputed on every
  // ScrollTrigger refresh (window resize, the 768px breakpoint flipping
  // .gallery-image from a fixed height to a fixed width, etc.) rather
  // than baked in once.
  let galleryTravelY = 0;
  let galleryCurveAmp = galleryItems.map(() => 0);

  const computeGalleryLayout = () => {
    // Half the viewport height, pulled in by GALLERY_EDGE_MARGIN — this
    // (not a full-clearance distance) is deliberate: photos should turn
    // around well short of the real edge, not travel out to/past it, so
    // the whole motion stays visibly inset from the top and bottom of
    // the screen. overflow:hidden on .gallery-stack is only a safety net
    // now, not something this math is trying to just barely satisfy.
    galleryTravelY = (window.innerHeight / 2) * (1 - GALLERY_EDGE_MARGIN);

    const curveBase = window.innerWidth * 0.06; // 6vw minimum bow
    const curveRange = window.innerWidth * 0.10; // up to +10vw more, varied per photo
    galleryCurveAmp = galleryItems.map((_, i) => {
      const dir = i % 2 === 0 ? 1 : -1; // alternate which side each photo bows toward
      return dir * (curveBase + seededRandom(i) * curveRange);
    });
  };

  const renderGallery = (progress) => {
    galleryItems.forEach((item, i) => {
      const localP = Math.min(Math.max((progress - i * spacing) / span, 0), 1);
      const arc = Math.sin(localP * Math.PI); // 0 at both ends, 1 at the midpoint — drives BOTH scale and the curve's bow, so a photo is biggest exactly where it's bowed furthest off-center, reading as "swinging toward the camera"
      gsap.set(item, {
        xPercent: -50,
        yPercent: -50,
        x: galleryCurveAmp[i] * arc,
        y: galleryTravelY - localP * (galleryTravelY * 2), // +travelY (bottom) at localP 0 -> -travelY (top) at localP 1
        scale: arc,
      });
    });
  };

  computeGalleryLayout();
  renderGallery(0); // initial paint, before any scroll/refresh event has fired

  ScrollTrigger.create({
    trigger: ".gallery-scroll",
    start: "top top",
    end: "bottom bottom",
    pin: ".gallery-stack",
    scrub: 0.6, // a touch of lag (not scrub:true's exact 1:1) — this is a
                 // continuous flowing motion, not something that needs
                 // precise arrival timing the way .cards-stack/.contact-
                 // stack above do, so a little smoothing reads more like
                 // physical momentum
    onUpdate: (self) => renderGallery(self.progress),
    onRefresh: (self) => {
      computeGalleryLayout();
      renderGallery(self.progress);
    },
  });
}

// -- VIDEO ARROWS REVEAL -- //
//Wireframe/concept, not final. Cut down from a shrink+pin+snap sequence
//to just this: each arrow reveals by sliding out from behind a mask —
//same overflow:hidden + translate technique as INTRO TEXT REVEAL, just
//applied per-arrow instead of per-character — once, as .video-rect
//scrolls into view normally (no pin, no scale, no scrub). The reveal
//motion for each one happens in ITS OWN LOCAL "up" axis (yPercent 100 →
//0, identical math to the text chars) — and because each arrow's
//mask+icon lives inside its own .video-arrow container, which is already
//rotated to point at the rect's center (see arrowLayout below), that
//local "up" slide comes out, after the rotation, as sliding in whatever
//direction that specific arrow actually points: "up" locally IS the
//direction each arrow's tip faces before rotation, so the reveal motion
//and the arrow's pointing direction always match.
const videoRect = document.querySelector(".video-rect");
const videoArrows = gsap.utils.toArray(".video-arrow");

if (videoRect && videoArrows.length === 8) {
  const FINAL_WIDTH = 600;
  const FINAL_HEIGHT = (FINAL_WIDTH * 9) / 16; // 337.5 — matches the
                                                 // 16:9 aspect-ratio set
                                                 // in main.css
  const GAP = 40; // not specified — reasonable breathing room between
                   // the rect's edge and the arrows around it

  const arrowLayout = [
    { mx: 0, my: -1, rotation: 180 },  // top
    { mx: 1, my: -1, rotation: 225 },  // top-right
    { mx: 1, my: 0, rotation: 270 },   // right
    { mx: 1, my: 1, rotation: 315 },   // bottom-right
    { mx: 0, my: 1, rotation: 0 },     // bottom
    { mx: -1, my: 1, rotation: 45 },   // bottom-left
    { mx: -1, my: 0, rotation: 90 },   // left
    { mx: -1, my: -1, rotation: 135 }, // top-left
  ];

  const videoArrowIcons = videoArrows.map((arrow, i) => {
    const { mx, my, rotation } = arrowLayout[i];
    gsap.set(arrow, {
      xPercent: -50,
      yPercent: -50,
      x: mx * (FINAL_WIDTH / 2 + GAP),
      y: my * (FINAL_HEIGHT / 2 + GAP),
      rotation,
    });

    const icon = arrow.querySelector(".video-arrow-icon");
    gsap.set(icon, { yPercent: 100 }); // hidden behind .video-arrow-mask
                                         // until the reveal below
    return icon;
  });

  // "top 80%, once:true" — the same reveal-on-scroll pattern as MISSION
  // SECTION REVEAL / PROGRAMS SECTION REVEAL / CALENDAR EVENT REVEAL
  // elsewhere in this file: plays the one time this scrolls into view,
  // no pin or scrub involved.
  gsap.to(videoArrowIcons, {
    yPercent: 0,
    duration: 1,
    stagger: 0.05,
    ease: navButtonHoverEase,
    scrollTrigger: {
      trigger: videoRect,
      start: "top 80%",
      once: true,
    },
  });
}

// -- LOGO HOVER + SCROLL TO TOP -- //
//Three logos share "slightly enlarge on hover, like a nav button" but
//each pivots from a different point, and only two of them scroll back to
//the top on click. Scale reuses .nav-button's own hover values (1.05,
//navButtonHoverEase, 0.4s) for a consistent feel across the site.
//
//The hero logo's hover-scale targets its INNER <svg>, not .hero-logo
//itself — that outer element already has its OWN scale/y (HERO-TO-NAV,
//scroll-scrubbed) and filter (menu open/close blur) tweens running on
//it; adding a fourth, hover-driven scale tween to the same element would
//fight those instead of layering cleanly on top. The inner svg has
//nothing else touching its transform, so it's an isolated, safe target.
//.hero-logo is a <div>, not a real <button>/<a>, so it needs manual
//keydown handling for keyboard activation (role="button" alone doesn't
//grant that) — the other two logos are a real <a> and <button>, which
//both get this natively.
if (heroLogo) {
  const heroLogoSvg = heroLogo.querySelector("svg");

  // Gated on heroLogoDocked (set above, in HERO-TO-NAV) — hovering the
  // full hero-sized logo, or catching it mid-transition, shouldn't
  // trigger this; only once it's actually settled into the nav.
  heroLogo.addEventListener("mouseenter", () => {
    if (!heroLogoDocked) return;
    gsap.to(heroLogoSvg, { scale: 1.05, duration: 0.4, ease: navButtonHoverEase });
  });
  heroLogo.addEventListener("mouseleave", () => {
    if (!heroLogoDocked) return;
    gsap.to(heroLogoSvg, { scale: 1, duration: 0.4, ease: navButtonHoverEase });
  });

  // Also gated — clicking (or Enter/Space-ing) it while still hero-sized
  // shouldn't do anything either, matching the hover gating above.
  const scrollToTop = () => {
    if (!heroLogoDocked) return;
    smoother.scrollTo(0, true);
  };
  heroLogo.addEventListener("click", scrollToTop);
  heroLogo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      scrollToTop();
    }
  });
}

// FMK logo, top-left of the navbar — hover-scale only; its click is a
// real external link (href, see index.html), not a scroll-to-top.
const navbarLogo = document.querySelector(".navbar-logo");
if (navbarLogo) {
  navbarLogo.addEventListener("mouseenter", () => {
    gsap.to(navbarLogo, { scale: 1.05, duration: 0.4, ease: navButtonHoverEase });
  });
  navbarLogo.addEventListener("mouseleave", () => {
    gsap.to(navbarLogo, { scale: 1, duration: 0.4, ease: navButtonHoverEase });
  });
}

// Footer arrow logo — hover-scale + scroll-to-top, same as the hero logo,
// but a real <button> so keyboard activation already works natively with
// no extra keydown handling needed.
const footerLogoArrow = document.querySelector(".footer-logo-arrow");
if (footerLogoArrow) {
  footerLogoArrow.addEventListener("mouseenter", () => {
    gsap.to(footerLogoArrow, { scale: 1.05, duration: 0.4, ease: navButtonHoverEase });
  });
  footerLogoArrow.addEventListener("mouseleave", () => {
    gsap.to(footerLogoArrow, { scale: 1, duration: 0.4, ease: navButtonHoverEase });
  });
  footerLogoArrow.addEventListener("click", () => smoother.scrollTo(0, true));
}

// -- CONTACT FORM -- //
//Wireframe: no backend/endpoint exists yet, so submitting for real would
//just reload the page against action="#" and lose whatever was typed —
//preventDefault keeps that from happening until a real endpoint exists.
//The "Odeslat" button itself needs no extra JS: it's a plain
//.nav-button--fill with a .nav-button-label, so it already gets the same
//hover-scale + text-swap-track animation as every other nav button for
//free (NAV BUTTON HOVER SWAP above targets .nav-button-label generically).
const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", (e) => e.preventDefault());
}

// -- REFRESH AFTER FULL LOAD -- //
//Everything above runs as soon as this script executes (synchronously,
//right as the DOM parses), which is BEFORE images have actually
//downloaded and taken up their real space — the gallery section alone
//has 15 full photos. Every ScrollTrigger position (pins, reveals) that
//was computed off that too-short, pre-image layout is stale once those
//images land and the page grows to its real height: a pin's own "start"
//can end up measured a bit early or late, which is what was showing up
//as .gallery-stack not sitting flush against the top of the viewport
//right as it engaged — a symptom of a stale trigger position, not a
//layout bug in .gallery-stack itself. window "load" (not
//DOMContentLoaded, which fires before images finish) is the correct
//point to recheck: everything, including every image, is guaranteed
//loaded by then. refresh() recalculates every ScrollTrigger's start/end
//against the page's now-final, accurate height.
window.addEventListener("load", () => ScrollTrigger.refresh());


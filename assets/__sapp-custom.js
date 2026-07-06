window.__sapp = window.__sapp || {};
window.__sapp.handlers = window.__sapp.handlers || {};

(function (S) {

  /* ---- rule handlers ---- */

  /* Example: prevent default + stop propagation before replay
     S.handlers.beforeReplay = function (ev) {
       ev.preventDefault();
       ev.stopPropagation();
       //etc
     };
  */

  /* Example: react when a specific script has actually loaded
     S.handlers.afterReplay = function (node, rule) {
       console.log('replay ready', node.src);
     };
  */



})(window.__sapp);


/* ---- fixes ---- */

/* Anchor-scroll fix for lazy layout.
   A native <a href="#id"> jump computes the target position at click time, but
   sapp defers images (src -> data-src, 1x1 placeholder) and gates widgets on
   interaction (the Stamped reviews widget loads on the very click that scrolls
   to it), so content ABOVE the target is still 0-height — the page lands short,
   then shifts down as images/widgets settle. We intercept the review-rating
   anchors, scroll, then RE-CORRECT the position for a short window while the
   layout above settles, pinning the target. Cancels the instant the user scrolls
   (never fights the user). Respects scroll-margin-top. Extend SEL as needed. */
(function (w, d) {
  if (w.__sappAnchorFix) return;
  w.__sappAnchorFix = 1;

  var SEL = 'a[href="#stamped-main-widget"], .c-rating a[href^="#"]';
  var HARD_CAP = 20000;     /* absolute max tracking time after the click */
  var IDLE_STOP = 1500;     /* stop this long after the document stops growing, once pinned */
  var EASE = 0.18;          /* fraction of the remaining distance covered per frame */
  var MAX_STEP = 600;       /* px/frame cap -> a steady, smooth glide even for long scrolls */
  var CANCEL_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown', 'pointerdown'];

  function now() { return (w.performance && performance.now) ? performance.now() : Date.now(); }
  function raf(fn) { return w.requestAnimationFrame ? w.requestAnimationFrame(fn) : setTimeout(fn, 16); }

  function targetOf(a) {
    var h = a.getAttribute('href') || '';
    if (h.charAt(0) !== '#' || h.length < 2) return null;
    try { return d.getElementById(h.slice(1)); } catch (e) { return null; }
  }

  /* The reviews widget is event-gated on scroll/touchstart (no `click`, so the
     add-to-cart click can't wake it), so a desktop rating click without a prior
     scroll would otherwise scroll to an empty container. Clicking the rating IS the
     intent to see reviews, so run its parked task now. Idempotent — runTask has a
     task.done guard, so a later scroll trigger won't double-run it. */
  function kickWidget() {
    var S = w.__sapp;
    if (!S || !S.queues || !S.queues.event || !S.run || !S.run.task) return;
    var ev = S.queues.event;
    for (var k = 0; k < ev.length; k++) {
      var t = ev[k];
      if (!t || t.done || !t.node) continue;
      var src = (t.node.getAttribute && (t.node.getAttribute('data-src') || t.node.getAttribute('src')) || t.node.src) || '';
      if (src.indexOf('widget.min.js') >= 0) { try { S.run.task(t); } catch (e) {} }
    }
  }

  function scrollToTarget(el) {
    var offset = parseFloat((w.getComputedStyle && getComputedStyle(el).scrollMarginTop) || 0) || 0;
    var de = d.documentElement;
    var cancelled = false, start = now(), lastGrow = start, lastH = -1, i;

    function desired() { return Math.max(0, el.getBoundingClientRect().top + (w.pageYOffset || 0) - offset); }
    /* The page sets a global `scroll-behavior: smooth` (with !important) on <html>;
       the positional scrollTo(x,y) would honour it and animate every step, so our
       per-frame increments would read stale positions and stall near the target.
       The behavior:'instant' option overrides CSS scroll-behavior per spec, so each
       step applies synchronously and we drive the smoothness ourselves via easing. */
    function setY(y) {
      try { w.scrollTo({ top: y, left: 0, behavior: 'instant' }); }
      catch (e) { try { w.scrollTo(0, y); } catch (e2) {} }
    }

    function onUser(ev) { if (!ev || ev.isTrusted !== false) cleanup(); }
    function cleanup() {
      cancelled = true;
      for (var j = 0; j < CANCEL_EVENTS.length; j++) w.removeEventListener(CANCEL_EVENTS[j], onUser, true);
    }
    for (i = 0; i < CANCEL_EVENTS.length; i++) w.addEventListener(CANCEL_EVENTS[i], onUser, { capture: true, passive: true });

    /* Continuous eased glide toward a target that may move. Each frame re-reads
       desired() and eases toward it, stepping instantly so the move is exact. Two
       failures both surface as the target not yet being pinned and are handled the
       same way:
         • content ABOVE grows -> target shifts down -> we keep following it;
         • content BELOW grows -> the page was too short, so the scroll clamps short;
           once it's tall enough the glide reaches the top.
       We stop only once pinned AND the page has been stable for IDLE_STOP (so a
       late growth that finally makes the target reachable is never missed), at
       HARD_CAP, or the moment the user scrolls. */
    (function frame() {
      if (cancelled) return;
      var t = now();
      var cur = (w.pageYOffset || 0);
      var diff = desired() - cur;
      var pinned = Math.abs(diff) <= 1;
      if (!pinned) {
        var step = diff * EASE;
        if (step > MAX_STEP) step = MAX_STEP;
        else if (step < -MAX_STEP) step = -MAX_STEP;
        else if (Math.abs(step) < 1) step = diff;
        setY(cur + step);
      }
      var h = de.scrollHeight || 0;
      if (h !== lastH) { lastH = h; lastGrow = t; }   /* page still settling */
      if ((pinned && t - lastGrow > IDLE_STOP) || t - start > HARD_CAP) { cleanup(); return; }
      raf(frame);
    })();
  }

  d.addEventListener('click', function (e) {
    if (e.defaultPrevented || (e.button != null && e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target && e.target.closest && e.target.closest(SEL);
    if (!a) return;
    var el = targetOf(a);
    if (!el) return;
    e.preventDefault();
    try { if (w.history && history.pushState) history.pushState(null, '', a.getAttribute('href')); } catch (x) {}
    kickWidget();
    scrollToTarget(el);
  }, true);
})(window, document);


/* Wistia popover "Watch: How It Works" fix for deferred player.js.
   The watch buttons are <wistia-player wistia-popover popover-content="link"> web
   components that stay inert until fast.wistia.com/player.js has loaded and upgraded
   them. sapp defers player.js (and E-v1.js) to the event queue (scroll/touchstart).
   These Watch buttons sit high on the product page (often in the first viewport), so
   a visitor can tap one as their FIRST action — before player.js has loaded. A tap on
   an un-upgraded element does nothing; and while we can intercept it and REPLAY the
   click once Wistia loads, the browser blocks video autoplay from a synthetic
   (untrusted) click — so the popover opens but the video won't play, and the user has
   to tap a second time. That's the "needs 2 taps on mobile" bug.
   Fix: load Wistia PROACTIVELY on idle right after render (only when Watch buttons
   exist), so the element is already upgraded by the time the user taps — their first
   REAL (trusted) tap then opens AND plays natively. IntersectionObserver is a second
   trigger; the click interceptor below is a last-resort that at least opens the
   popover if a tap still beats the load. Idempotent — runTask has a done guard. */
(function (w, d) {
  if (w.__sappWistiaKick) return;
  w.__sappWistiaKick = 1;

  var WISTIA_SRC = ['player.js', 'E-v1.js'];
  var LINK_SEL = '.c-wistia__link';
  var kicked = false;

  function kickWistia() {
    if (kicked) return;
    var S = w.__sapp;
    if (!S || !S.queues || !S.queues.event || !S.run || !S.run.task) return;
    var ev = S.queues.event, k, j, ran = false;
    for (k = 0; k < ev.length; k++) {
      var t = ev[k];
      if (!t || t.done || !t.node) continue;
      var src = (t.node.getAttribute && (t.node.getAttribute('data-src') || t.node.getAttribute('src')) || t.node.src) || '';
      for (j = 0; j < WISTIA_SRC.length; j++) {
        if (src.indexOf(WISTIA_SRC[j]) >= 0) { try { S.run.task(t); ran = true; } catch (e) {} break; }
      }
    }
    if (ran) kicked = true;   /* only latch once we actually ran the parked task(s) */
  }

  function upgraded() { return !!(w.customElements && customElements.get('wistia-player')); }

  function setup() {
    var links = d.querySelectorAll(LINK_SEL);
    if (!links.length) return;   /* no Watch buttons on this page — stay fully deferred */

    /* (1) Proactive: load Wistia once the page is idle so the element is upgraded
       before the user reaches and taps a Watch button. This is what makes the first
       real tap open+play (a trusted gesture on a ready element) instead of needing a
       second tap. Post-render/idle, so it doesn't compete with LCP. */
    var ric = w.requestIdleCallback || function (fn) { return w.setTimeout(fn, 1); };
    ric(function () { kickWistia(); }, { timeout: 1500 });

    /* (2) Also load as soon as a Watch button nears the viewport (belt & suspenders). */
    if (w.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { kickWistia(); io.disconnect(); return; }
        }
      }, { rootMargin: '600px' });
      for (var i = 0; i < links.length; i++) io.observe(links[i]);
    }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();

  /* Intercept the Watch click: if Wistia isn't upgraded yet, block the dead click,
     load it, then replay once defined so the popover opens for this very click. */
  d.addEventListener('click', function (e) {
    if (e.defaultPrevented || (e.button != null && e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var link = e.target && e.target.closest && e.target.closest(LINK_SEL);
    if (!link) return;
    if (upgraded()) return;             /* Wistia ready — let it handle the click */
    e.preventDefault();
    e.stopPropagation();
    var host = link.closest('wistia-player');
    kickWistia();
    if (w.customElements && customElements.whenDefined) {
      customElements.whenDefined('wistia-player').then(function () {
        /* the element upgrades on definition; give Wistia a tick to wire the popover,
           then replay a fresh click (Wistia may have re-rendered the inner content). */
        setTimeout(function () {
          var l = (host && host.querySelector(LINK_SEL)) || link;
          try { l.click(); } catch (x) {}
        }, 80);
      });
    }
  }, true);
})(window, document);


/* loadjs */
loadjs=function(){var h=function(){},c={},u={},f={};function o(e,n){if(e){var r=f[e];if(u[e]=n,r)for(;r.length;)r[0](e,n),r.splice(0,1)}}function l(e,n){e.call&&(e={success:e}),n.length?(e.error||h)(n):(e.success||h)(e)}function d(r,t,s,i){var c,o,e=document,n=s.async,u=(s.numRetries||0)+1,f=s.before||h,l=r.replace(/[\?|#].*$/,""),a=r.replace(/^(css|img)!/,"");i=i||0,/(^css!|\.css$)/.test(l)?((o=e.createElement("link")).rel="stylesheet",o.href=a,(c="hideFocus"in o)&&o.relList&&(c=0,o.rel="preload",o.as="style")):/(^img!|\.(png|gif|jpg|svg|webp)$)/.test(l)?(o=e.createElement("img")).src=a:((o=e.createElement("script")).src=r,o.async=void 0===n||n),!(o.onload=o.onerror=o.onbeforeload=function(e){var n=e.type[0];if(c)try{o.sheet.cssText.length||(n="e")}catch(e){18!=e.code&&(n="e")}if("e"==n){if((i+=1)<u)return d(r,t,s,i)}else if("preload"==o.rel&&"style"==o.as)return o.rel="stylesheet";t(r,n,e.defaultPrevented)})!==f(r,o)&&e.head.appendChild(o)}function r(e,n,r){var t,s;if(n&&n.trim&&(t=n),s=(t?r:n)||{},t){if(t in c)throw"LoadJS";c[t]=!0}function i(n,r){!function(e,t,n){var r,s,i=(e=e.push?e:[e]).length,c=i,o=[];for(r=function(e,n,r){if("e"==n&&o.push(e),"b"==n){if(!r)return;o.push(e)}--i||t(o)},s=0;s<c;s++)d(e[s],r,n)}(e,function(e){l(s,e),n&&l({success:n,error:r},e),o(t,e)},s)}if(s.returnPromise)return new Promise(i);i()}return r.ready=function(e,n){return function(e,r){e=e.push?e:[e];var n,t,s,i=[],c=e.length,o=c;for(n=function(e,n){n.length&&i.push(e),--o||r(i)};c--;)t=e[c],(s=u[t])?n(t,s):(f[t]=f[t]||[]).push(n)}(e,function(e){l(n,e)}),r},r.done=function(e){o(e,[])},r.reset=function(){c={},u={},f={}},r.isDefined=function(e){return e in c},r}();loadJS=loadjs;
/*
 * n-lcp-defer.js
 * ---------------------------------------------------------------------------
 * Frees the network during the LCP critical window.
 *
 * Server-side (snippets/__sapp-html-rewrite.liquid) every <img> WITHOUT
 * loading="eager" has its src/srcset rewritten to data-src/data-srcset, so the
 * browser's preload scanner cannot fetch it. The single eager image (the hero /
 * LCP) keeps its real src and loads first, alone, getting the full bandwidth.
 *
 * This module waits until the eager image(s) have loaded — that is the LCP
 * moment — and only then hands the deferred images to an IntersectionObserver.
 * Near-viewport images load right after LCP; far ones wait for scroll (data
 * saving). If JS is the only thing standing between the user and the images, a
 * fallback timeout guarantees they are never stuck hidden.
 */
(function () {
  'use strict';

  // How early (relative to the viewport) a deferred image starts loading once
  // the observer is active. Larger = preload sooner; smaller = save more data.
  var ROOT_MARGIN = '300px 0px';

  // Safety net: release everything if the eager image never fires load/error.
  var FALLBACK_MS = 4000;

  function swap(img) {
    var dss = img.getAttribute('data-srcset');
    var ds = img.getAttribute('data-src');
    if (dss) { img.setAttribute('srcset', dss); img.removeAttribute('data-srcset'); }
    if (ds) { img.setAttribute('src', ds); img.removeAttribute('data-src'); }
  }

  // Activate lazy loading for every deferred image.
  function activate() {
    var deferred = document.querySelectorAll('img[data-src], img[data-srcset]');
    if (!deferred.length) return;

    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < deferred.length; i++) swap(deferred[i]);
      return;
    }

    var io = new IntersectionObserver(function (entries, obs) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          swap(entries[i].target);
          obs.unobserve(entries[i].target);
        }
      }
    }, { rootMargin: ROOT_MARGIN });

    for (var j = 0; j < deferred.length; j++) io.observe(deferred[j]);
  }

  // Resolve once all eager (critical) images have finished — the LCP moment.
  function whenLcpReady(cb) {
    var eager = document.querySelectorAll('img[loading="eager"]');
    var pending = 0;
    var done = false;

    function fire() { if (!done) { done = true; cb(); } }

    for (var i = 0; i < eager.length; i++) {
      var img = eager[i];
      if (img.complete) continue;
      pending++;
      img.addEventListener('load', settle, { once: true });
      img.addEventListener('error', settle, { once: true });
    }

    function settle() { if (--pending <= 0) fire(); }

    if (pending === 0) fire();        // nothing to wait for / all cached
    setTimeout(fire, FALLBACK_MS);    // safety net
  }

  function start() { whenLcpReady(activate); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

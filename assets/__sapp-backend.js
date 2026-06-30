(function (w, d) {
  var S = w.__sapp;
  if (!S || S.state.failed) return;

  var cfg = S.config;

  /* Active timeout profile, resolved lazily in start() — NOT at module load.
     The slow/fast decision depends on S.net (measured post-LCP by the inlined
     orchestrator), which isn't ready when this file first executes, but IS ready
     by the time start() fires (window load / 3s fallback). When a `timeoutsSlow`
     profile exists and the connection is slow, use it; ?sappconn=slow|fast forces
     a profile for testing. */
  function resolveTimeouts() {
    var slow;
    var forced = /[?&]sappconn=(slow|fast)/.exec(w.location.search);
    if (forced) slow = forced[1] === 'slow';
    else slow = !!(S.net && S.net.slow);
    /* Publish the resolved decision so runQueue can pick queueOptionsSlow with
       the same slow/fast trigger (measured net or ?sappconn= override). */
    S.state.slow = slow;
    var profile = (slow && cfg.timeoutsSlow) ? cfg.timeoutsSlow : cfg.timeouts;
    return (S.state.isMobile ? profile.mobile : profile.desktop) || {};
  }
  var t = {};

  function isDisabled(v) { return v === 'none' || v === 0 || v == null || v === false; }
  function scheduleQueue(name, timeout) {
    if (isDisabled(timeout)) { S.debug.log('queue disabled:', name, '(', timeout, ')'); return; }
    setTimeout(function () { S.run.queue(name); }, timeout);
  }
  var SCRIPT_SEL = 'script[type^="javascript/sapp-loading"]';
  var MEDIA_SEL = 'iframe[data-src]:not([src]),video[data-src]:not([src]),audio[data-src]:not([src])';

  function materializeMedia(node) {
    try {
      var src = node.dataset && node.dataset.src;
      if (src) node.src = src;
      return true;
    } catch (e) { S.debug.log('sweep media failed', e); return false; }
  }

  function interactionGatedNodes() {
    var set = [];
    var ev = (S.queues && S.queues.event) || [];
    for (var i = 0; i < ev.length; i++) {
      var task = ev[i];
      if (task.done) continue;
      if (task.node) set.push(task.node);
      var n = task._chainNext;
      while (n) { if (n.node) set.push(n.node); n = n._chainNext; }
    }
    return set;
  }

  function finalSweep(reason) {
    var keep = interactionGatedNodes();
    var swept = 0;
    var scripts = d.querySelectorAll(SCRIPT_SEL);
    for (var i = 0; i < scripts.length; i++) {
      if (keep.indexOf(scripts[i]) !== -1) continue;
      if (S.exec && S.exec.script) {
        try { S.exec.script(scripts[i]); swept++; } catch (e) { S.debug.log('sweep script failed', e); }
      }
    }
    var media = d.querySelectorAll(MEDIA_SEL);
    for (var j = 0; j < media.length; j++) {
      if (keep.indexOf(media[j]) !== -1) continue;
      if (materializeMedia(media[j])) swept++;
    }
    if (swept) S.debug.log('finalSweep(' + reason + '):', swept, 'orphans run');
    return swept;
  }
  S.run.sweep = finalSweep;

  function maxTimeout() {
    var vals = [t.preload, t.scripts, t.embeds, t.other, t.async], m = 0, any = false;
    for (var i = 0; i < vals.length; i++) {
      if (isDisabled(vals[i])) continue;
      var n = parseInt(vals[i], 10);
      if (!isNaN(n)) { any = true; if (n > m) m = n; }
    }
    return any ? m : 4500;
  }

  function scheduleSweep() {
    var MAX_REARMS = 20, rearms = 0;
    function tick(reason) {
      var n = finalSweep(reason);
      if (n > 0 && rearms < MAX_REARMS) { rearms++; setTimeout(function () { tick('rearm'); }, 800); }
    }
    setTimeout(function () { tick('timeout'); }, maxTimeout() + 1500);
    if (d.readyState !== 'complete') {
      w.addEventListener('load', function () { setTimeout(function () { tick('load'); }, 1000); }, { once: true });
    }
  }

  function dispatchSynthetic() {
    if (!cfg.dispatchSyntheticEvents) return;
    try { d.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true })); w.dispatchEvent(new Event('DOMContentLoaded')); } catch (e) {}
    setTimeout(function () {
      try { d.dispatchEvent(new Event('load')); w.dispatchEvent(new Event('load')); } catch (e) {}
    }, 300);
    S.debug.log('synthetic DOMContentLoaded/load dispatched');
  }

  function start() {
    t = resolveTimeouts();
    S.debug.log('backend start, timeouts=', t, 'net=', S.net);
    if (S.observer && S.observer.stop) S.observer.stop();

    var pendingQueues = 1; /* loaded */
    if (!isDisabled(t.preload)) pendingQueues++;
    if (!isDisabled(t.scripts)) pendingQueues++;
    if (!isDisabled(t.embeds))  pendingQueues++;
    if (!isDisabled(t.other))   pendingQueues++;
    if (!isDisabled(t.async))   pendingQueues++;

    var syntheticFired = false;
    function onQueueDone() {
      pendingQueues--;
      if (pendingQueues <= 0 && !syntheticFired) {
        syntheticFired = true;
        setTimeout(dispatchSynthetic, 200);
      }
    }
    S.on('queueDone', onQueueDone);

    S.run.queue('loaded');
    if (S.observer && S.observer.materializeAsyncLoad) S.observer.materializeAsyncLoad();
    scheduleQueue('preload', t.preload);
    scheduleQueue('scripts', t.scripts);
    scheduleQueue('embeds',  t.embeds);
    scheduleQueue('other',   t.other);
    scheduleQueue('async',   t.async);
    scheduleSweep();
    S.emit('ready');
  }

  var started = false;
  function safeStart() { if (started) return; started = true; start(); }
  function safeStartWhenParsed() {
    if (d.readyState === 'loading') { d.addEventListener('DOMContentLoaded', safeStart, { once: true }); }
    else { safeStart(); }
  }
  if (d.readyState === 'complete') safeStart();
  else w.addEventListener('load', safeStart, { once: true });
  setTimeout(safeStartWhenParsed, 3000);
})(window, document);
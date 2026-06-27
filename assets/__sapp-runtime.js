(function (w, d) {
  if (w.__sapp) return;

  try {
    if (w.console && console.log) {
      console.log(
        '%c⚡ powered by speedup.guru',
        'background:#0a0a0a;color:#39ff14;font-size:13px;font-weight:bold;padding:4px 10px;border-radius:4px;text-shadow:0 0 6px #39ff14;'
      );
    }
  } catch (e) {}

  w.asyncLoadArr = w.asyncLoadArr || [];
  w.asyncLoadArrLoaded = w.asyncLoadArrLoaded || [];

  var configEl = d.getElementById('sapp-config');
  if (!configEl) return;

  var cfg;
  try { cfg = JSON.parse(configEl.textContent); }
  catch (e) { return; }

  /* Tunable defaults kept as named constants instead of inline magic numbers.
     mobileBreakpoint can be overridden from the config; the rest are internal. */
  var MOBILE_BREAKPOINT = (typeof cfg.mobileBreakpoint === 'number') ? cfg.mobileBreakpoint : 768;
  var RIC_FALLBACK_DELAY = 1;     /* ms: setTimeout fallback when requestIdleCallback is unavailable */
  var RIC_BUDGET = 50;            /* ms: fake timeRemaining reported by that fallback */
  var SLICE_YIELD_TIMEOUT = 100;  /* ms: max wait before a sliced chunk resumes via rIC */
  var IO_ROOT_MARGIN = '0px';     /* default IntersectionObserver rootMargin for `visible` triggers */

  var listeners = {};
  var rIC = w.requestIdleCallback || function (fn) { return setTimeout(function () { fn({ timeRemaining: function () { return RIC_BUDGET; } }); }, RIC_FALLBACK_DELAY); };

  function emit(name) {
    var ls = listeners[name]; if (!ls) return;
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < ls.length; i++) { try { ls[i].apply(null, args); } catch (e) {} }
  }
  function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
  function off(name, fn) {
    var ls = listeners[name]; if (!ls) return;
    var i = ls.indexOf(fn); if (i >= 0) ls.splice(i, 1);
  }

  var isMobile = (function () {
    var ua = navigator.userAgent || '';
    return /android|iphone|ipad|ipod|mobile|blackberry|opera mini|iemobile/i.test(ua) || (w.innerWidth || 0) < MOBILE_BREAKPOINT;
  })();

  function escapeRe(s) { return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }
  /* Compiled glob patterns are cached: the same rule/exception pattern is tested
     against every scanned node, so without this a RegExp would be recompiled on
     each match. */
  var globCache = {};
  function globToRe(p) { return globCache[p] || (globCache[p] = new RegExp('^' + escapeRe(p).replace(/\*/g, '.*') + '$')); }

  function matchOne(value, pattern) {
    if (pattern == null) return false;
    if (typeof pattern === 'string') {
      if (pattern.indexOf('*') >= 0) return globToRe(pattern).test(String(value || ''));
      return String(value || '').indexOf(pattern) >= 0;
    }
    if (Array.isArray(pattern)) {
      for (var i = 0; i < pattern.length; i++) if (matchOne(value, pattern[i])) return true;
      return false;
    }
    return false;
  }

  /* innerHTML is the only expensive field to read (the browser serialises the
     node's markup). The same node is matched against isException + every rule,
     so we read it at most once per node and cache it. A script's content does
     not change between deferral and execution, so the cache can't go stale. */
  var ihCache = (typeof WeakMap === 'function') ? new WeakMap() : null;
  function innerHTMLOf(node) {
    if (!ihCache) return node.innerHTML || '';
    if (ihCache.has(node)) return ihCache.get(node);
    var v = node.innerHTML || '';
    ihCache.set(node, v);
    return v;
  }

  function nodeField(node, key) {
    switch (key) {
      case 'id': return node.id || '';
      case 'class': return node.getAttribute && (node.getAttribute('class') || '');
      case 'src': return node.src || (node.getAttribute && node.getAttribute('src')) || (node.dataset && node.dataset.src) || '';
      case 'dataSrc': return node.dataset && node.dataset.src || '';
      case 'innerHTML': return innerHTMLOf(node);
      case 'type': return node.getAttribute && (node.getAttribute('type') || '');
      default: return '';
    }
  }

  function matchNode(node, criteria) {
    if (!criteria) return false;
    for (var k in criteria) if (!matchOne(nodeField(node, k), criteria[k])) return false;
    return true;
  }

  function matchPage(criteria) {
    var ctx = { host: location.host, path: location.pathname, template: (w.Shopify && Shopify.template) || '' };
    for (var k in criteria) if (!matchOne(ctx[k], criteria[k])) return false;
    return true;
  }

  var excIndex = (function () {
    var idx = {}; var ex = cfg.exceptions || {};
    for (var k in ex) idx[k] = ex[k];
    return idx;
  })();

  function isException(node) {
    for (var k in excIndex) if (matchOne(nodeField(node, k), excIndex[k])) return true;
    return false;
  }

  function loadJS(url, opts) {
    opts = opts || {};
    if (loadJS._done[url]) { opts.success && opts.success(); return; }
    var s = d.createElement('script');
    s.src = url; s.async = opts.async !== false;
    if (opts.module) s.type = 'module';
    if (opts.nonce) s.nonce = opts.nonce;
    s.onload = function () { loadJS._done[url] = 1; opts.success && opts.success(); };
    s.onerror = function () { opts.error && opts.error(); };
    opts.before && opts.before(url, s);
    d.head.appendChild(s);
  }
  loadJS._done = {};

  /* The CSP nonce <meta> is static for the page; resolve it once instead of
     querying the DOM on every materialised script. */
  var cspNonce;
  function getCspNonce() {
    if (cspNonce === undefined) cspNonce = (d.querySelector('meta[name="csp-nonce"]') || {}).content || '';
    return cspNonce;
  }

  /* Build a fresh, executable <script> from a deferred placeholder node:
     copy attributes, restore data-src -> src and the original type, carry over
     inline content and the CSP nonce. The single source of truth for this
     reconstruction — used by execScript (runtime/sweep) and by the observer's
     script task (which adds its own load/error wiring around it). Does NOT
     insert or remove anything; the caller owns DOM placement. */
  function buildScript(node) {
    var s = d.createElement('script');
    var attrs = node.attributes || [];
    var origType = node.getAttribute('data-sapp-orig-type') || '';
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i];
      if (a.name === 'type') continue;
      if (a.name === 'data-src') { s.src = a.value; continue; }
      if (a.name === 'data-sapp-orig-type' || a.name === 'data-sapp-handled') continue;
      try { s.setAttribute(a.name, a.value); } catch (e) {}
    }
    if (origType) s.type = origType;
    if (!s.src && node.textContent) s.textContent = node.textContent;
    var nonce = node.nonce || getCspNonce();
    if (nonce) s.nonce = nonce;
    return s;
  }

  function execScript(node) {
    var s = buildScript(node);
    var parent = node.parentNode || d.head;
    parent.insertBefore(s, node);
    if (node.parentNode) node.parentNode.removeChild(node);
  }

  /* One IntersectionObserver per distinct rootMargin, created lazily and cached.
     A shared observer can't carry per-task rootMargins, and recreating it would
     drop every other element it was already watching — so each margin gets its
     own observer and observed targets are never disturbed. */
  var ioMap = {};
  function getIO(rootMargin) {
    if (!w.IntersectionObserver) return null;
    var key = rootMargin || IO_ROOT_MARGIN;
    if (ioMap[key]) return ioMap[key];
    var obs = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.isIntersecting && e.target.__sappTask) {
          var t = e.target.__sappTask; e.target.__sappTask = null; obs.unobserve(e.target); runTask(t);
        }
      }
    }, { rootMargin: key });
    ioMap[key] = obs;
    return obs;
  }

  function runTask(task) {
    if (task.done) return; task.done = true;
    try { task.fn(); emit('taskDone', task); } catch (e) { emit('taskError', task, e); }
  }

  function onTrigger(trigger, task, opts) {
    opts = opts || {};
    function isScrollLike(tr) {
      return tr === 'scroll' || tr === 'touchstart' || tr === 'touchmove' || tr === 'wheel' || tr === 'mousemove';
    }
    function passiveFor(tr) {
      if (isScrollLike(tr)) return true;
      return !task._preventDefaultOnTrigger && !task._onTriggerHandlerId;
    }
    function onTriggerEvent(ev) {
      task._triggerEvent = ev;
      var isClick = ev && ev.type === 'click';
      if (isClick && task._preventDefaultOnTrigger && ev.preventDefault) {
        try { ev.preventDefault(); } catch (e) {}
      }
      if (isClick && task._onTriggerHandlerId && w.__sapp.handlers[task._onTriggerHandlerId]) {
        try { w.__sapp.handlers[task._onTriggerHandlerId](ev); } catch (e) { debug.log('onTrigger handler failed', e); }
      }
    }

    if (Array.isArray(trigger)) {
      var cleanups = [];
      var fire = function (ev, source) {
        for (var i = 0; i < cleanups.length; i++) try { cleanups[i](); } catch (e) {}
        if (ev) onTriggerEvent(ev);
        /* Гонка click vs touchstart/mousemove: на тач-устройствах touchstart всегда
           опережает click того же тапа. Если задача завязана на клик (replay /
           preventDefault / onTrigger), а гонку выиграл другой триггер из списка,
           продолжаем ловить ближайший click, пока грузится цепочка: он перезапишет
           _triggerEvent (для replay) и получит preventDefault/onTrigger как обычно.
           Ловушку снимает observer по завершении цепочки (_cancelClickCapture) —
           иначе она перехватила бы первый клик после загрузки темы. */
        if ((task._replayOnDone || task._preventDefaultOnTrigger || task._onTriggerHandlerId) &&
            !(ev && ev.type === 'click') && trigger.indexOf('click') >= 0) {
          var clickCapture = function (cev) { onTriggerEvent(cev); };
          w.addEventListener('click', clickCapture, { passive: passiveFor('click'), capture: true });
          task._cancelClickCapture = function () { w.removeEventListener('click', clickCapture, true); };
          debug.log('click capture armed: trigger was', (ev && ev.type) || source);
        }
        if (debug.on) {
          try {
            var label = (task.node && (task.node.dataset && task.node.dataset.src || task.node.src)) || '<inline>';
            var src = source || (ev && ev.type) || 'unknown';
            var ts = Math.round((w.performance && performance.now && performance.now()) || 0);
            debug.log('trigger fired:', src, '@', ts + 'ms', '→', label);
          } catch (e) {}
        }
        runTask(task);
      };
      for (var i = 0; i < trigger.length; i++) {
        (function (tr) {
          if (tr === 'always') { cleanups.push(function () {}); fire(null, 'always'); return; }
          if (tr === 'idle') { var id = rIC(function () { if (!task.done) fire(null, 'idle'); }); cleanups.push(function () {}); return; }
          if (tr === 'visible' && task.node) {
            var aObs = getIO(opts.rootMargin);
            if (aObs) {
              task.node.__sappTask = { fn: function () { fire(null, 'visible'); }, node: task.node, done: false };
              aObs.observe(task.node);
              cleanups.push((function (o, n) { return function () { try { o.unobserve(n); } catch (e) {} }; })(aObs, task.node));
              return;
            }
            /* no IntersectionObserver support: fall through (best-effort) */
          }
          if (tr === 'manual' || tr === 'timeout') { return; }
          var h = function (ev) { fire(ev, tr); };
          w.addEventListener(tr, h, { passive: passiveFor(tr), capture: true, once: true });
          cleanups.push(function () { w.removeEventListener(tr, h, true); });
        })(trigger[i]);
      }
      if (task._fallbackTimeout != null && task._fallbackTimeout > 0) {
        var fallbackTo = setTimeout(function () { if (!task.done) fire(null, 'timeout'); }, task._fallbackTimeout);
        cleanups.push(function () { clearTimeout(fallbackTo); });
      }
      return;
    }
    if (trigger === 'always') { runTask(task); return; }
    if (trigger === 'idle') { rIC(function () { runTask(task); }); return; }
    if (trigger === 'visible' && task.node) {
      var sObs = getIO(opts.rootMargin);
      if (sObs) { task.node.__sappTask = task; sObs.observe(task.node); return; }
      /* no IntersectionObserver support: fall through (best-effort) */
    }
    if (trigger === 'manual') return;
    if (trigger === 'timeout') { task._pending = true; return; }
    var handler = function (ev) { w.removeEventListener(trigger, handler, true); onTriggerEvent(ev); runTask(task); };
    w.addEventListener(trigger, handler, { passive: passiveFor(trigger), capture: true, once: true });
  }

  var queues = { loaded: [], preload: [], scripts: [], other: [], async: [], event: [] };

  function pushTask(queueName, task) {
    var name = queues[queueName] ? queueName : 'event';
    task.queue = name;
    var q = queues[name];
    var p = task.priority || 0;
    var i = 0; while (i < q.length && (q[i].priority || 0) >= p) i++;
    q.splice(i, 0, task);
  }

  var nowMs = (w.performance && performance.now) ? function () { return performance.now(); } : function () { return Date.now(); };

  function runQueue(name) {
    var q = queues[name]; if (!q) return;
    emit('queueStart', name, q.length);
    var t0 = Date.now();
    var opts = (cfg.queueOptions && cfg.queueOptions[name]) || {};
    var stagger = opts.stagger || 0;
    var slice = opts.slice || 0;
    if (stagger > 0) {
      for (var i = 0; i < q.length; i++) {
        (function (task, delay) { setTimeout(function () { runTask(task); }, delay); })(q[i], i * stagger);
      }
      setTimeout(function () { emit('queueDone', name, Date.now() - t0, q.length); }, q.length * stagger);
    } else if (slice > 0 && q.length > 1) {
      var idx = 0;
      (function chunk() {
        var start = nowMs();
        while (idx < q.length) {
          runTask(q[idx++]);
          if (nowMs() - start >= slice) break;
        }
        if (idx < q.length) { rIC(chunk, { timeout: SLICE_YIELD_TIMEOUT }); }
        else { emit('queueDone', name, Date.now() - t0, q.length); }
      })();
    } else {
      for (var j = 0; j < q.length; j++) runTask(q[j]);
      emit('queueDone', name, Date.now() - t0, q.length);
    }
  }

  var debugOn = !!cfg.debug;
  var debug = {
    on: debugOn,
    log: function () { if (debugOn && w.console) console.log.apply(console, ['[__sapp]'].concat([].slice.call(arguments))); },
    tap: function (node, action) {
      if (!debugOn) return;
      console.log('[__sapp]', action, node.tagName || node.nodeType, '| src=', nodeField(node, 'src'), '| id=', nodeField(node, 'id'));
    },
    dump: function () {
      if (!w.console) return;
      console.group('[__sapp] state');
      for (var k in queues) console.log(k + ':', queues[k].length, 'tasks');
      console.log('config:', cfg);
      console.groupEnd();
    }
  };

  function licenseVerify() {
    try {
      var lic = cfg.license || {};
      var nowSec = Math.floor(Date.now() / 1000);
      if (lic.expiresAt && nowSec > lic.expiresAt) return false;
      if (!lic.token) return false;
      var expected = btoa(location.host + 'gt' + 'gtc' + 'LA' + '3@');
      return expected === lic.token;
    } catch (e) { return false; }
  }

  w.__sapp = {
    config: Object.freeze(cfg),
    state: { applied: new Set(), loaded: new Set(), isMobile: isMobile, started: false, failed: false },
    queues: queues,
    handlers: {},
    license: { verify: licenseVerify },
    match: matchOne,
    matchNode: matchNode,
    matchPage: matchPage,
    isException: isException,
    exec: { script: execScript, build: buildScript },
    util: { loadJS: loadJS, rIC: rIC, isMobile: isMobile, getCspNonce: getCspNonce },
    run: { queue: runQueue, task: runTask, onTrigger: onTrigger, push: pushTask },
    on: on, off: off, emit: emit,
    debug: debug
  };

  function unwrapEmbedTrap() {
    try {
      var head = d.getElementById('sapp-head-embed');
      var body = d.getElementById('sapp-body-embed');
      if (head && head.content) { d.head.appendChild(head.content); head.remove(); }
      if (body && body.content) { d.body && d.body.appendChild(body.content); body.remove(); }
      var marker = d.getElementById('sapp-init-embed');
      if (marker) marker.remove();
    } catch (e) {}
  }

  if (!licenseVerify()) {
    w.__sapp.state.failed = true;
    unwrapEmbedTrap();
    debug.log('license invalid — passthrough');
    emit('failsafe', 'license');
    return;
  }

  emit('beforeStart');
  debug.log('runtime ready, mobile=' + isMobile);
  w.__sapp.unwrapEmbedTrap = unwrapEmbedTrap;
})(window, document);
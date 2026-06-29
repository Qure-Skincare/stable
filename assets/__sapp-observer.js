(function (w, d) {
  var S = w.__sapp;
  if (!S || S.state.failed || S.state.started) return;

  var cfg = S.config;
  var rules = cfg.rules || [];
  var defaultMediaTrigger = cfg.defaultMediaTrigger || 'scroll';
  var BLOCKED = 'javascript/sapp-blocked';
  var DEFER = 'javascript/sapp-loading';
  var DEFER_INLINE = 'javascript/sapp-loading/inline';
  var DEFER_MODULE = 'javascript/sapp-loading/module';
  var HANDLED = 'data-sapp-handled';
  var MEDIA_TAGS = { IFRAME: 1, VIDEO: 1, AUDIO: 1 };
  var EXEC_TYPES = { '': 1, 'module': 1, 'text/javascript': 1, 'application/javascript': 1, 'application/ecmascript': 1, 'text/ecmascript': 1, 'javascript/sapp-loading': 1, 'javascript/sapp-loading/module': 1, 'javascript/sapp-loading/inline': 1 };

  function isExecutableType(t) { return EXEC_TYPES[(t || '').toLowerCase()] === 1; }

  /* Per-rule chain state lives in a WeakMap rather than on the rule object: cfg
     is frozen by the runtime (shallowly today, but this avoids depending on
     that) and keeping mutable bookkeeping off the logically-immutable config is
     cleaner. */
  var chainMap = (typeof WeakMap === 'function') ? new WeakMap() : null;
  function chainOf(rule) {
    if (!chainMap) return rule._chain || (rule._chain = []);
    var c = chainMap.get(rule);
    if (!c) { c = []; chainMap.set(rule, c); }
    return c;
  }

  function ruleAppliesToDevice(r) {
    if (!r.device || r.device === 'both' || r.device === 'all') return true;
    if (r.device === 'mobile') return S.state.isMobile === true;
    if (r.device === 'desktop') return S.state.isMobile === false;
    return true;
  }

  function findRule(node, tagName) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      var t = r.tag || 'script';
      if (t !== '*' && t.toUpperCase() !== tagName) continue;
      if (!ruleAppliesToDevice(r)) continue;
      if (S.matchNode(node, r.match)) return r;
    }
    return null;
  }

  function blockScript(node) {
    try {
      if (node.getAttribute('src')) {
        node.dataset.src = node.getAttribute('src');
        node.removeAttribute('src');
      }
      var currentType = node.getAttribute('type') || '';
      if (currentType && currentType.indexOf('javascript/sapp-loading') !== 0) {
        node.setAttribute('data-sapp-orig-type', currentType);
      }
      node.type = BLOCKED;
    } catch (e) {}
  }

  function blockMedia(node) {
    try {
      if (node.getAttribute('src')) {
        node.dataset.src = node.getAttribute('src');
        node.removeAttribute('src');
      }
    } catch (e) {}
  }

  function makeScriptTask(node, rule) {
    var isAsync = (rule && rule.queue === 'async') || node.getAttribute('data-sapp-from-async-load') === '1';
    var task = {
      node: node,
      priority: rule && rule.priority || 0
    };
    function replayTriggerEvent() {
      var head = task._chainHead || task;
      var orig = head._triggerEvent;
      if (!orig || !orig.target) return;
      /* Replay имеет смысл только для click: восстанавливаем «потерянное» нажатие пользователя
         после загрузки theme.js. Для scroll/touchstart/mousemove replay бесполезен (страница
         уже прокручена/касание завершено) и потенциально вреден — может зацепить чужие
         обработчики. Если гонку триггеров выиграл не клик, runtime продолжает ловить
         ближайший click до конца загрузки (click capture) и перезаписывает _triggerEvent —
         поэтому сюда не-click попадает только когда пользователь так и не кликнул.
         Тогда replay просто пропускаем: тема уже загружена и обработает клики сама. */
      if (orig.type !== 'click') {
        S.debug.log('replay skipped: trigger was', orig.type, '(not click)');
        return;
      }
      setTimeout(function () {
        try {
          var clone;
          try { clone = new orig.constructor(orig.type, orig); }
          catch (e) { clone = new Event(orig.type, { bubbles: true, cancelable: true }); }
          orig.target.dispatchEvent(clone);
          S.debug.log('trigger event replayed:', orig.type, '→', orig.target);
        } catch (e) { S.debug.log('replay failed', e); }
      }, 0);
    }
    function fireNext() {
      if (task._chainNext) {
        try { S.run.task(task._chainNext); } catch (e) { S.debug.log('chain next failed', e); }
        return;
      }
      /* Цепочка загружена: снимаем click capture ДО replay, чтобы переотправленный
         клон не был пойман заново и чтобы нативные клики дальше шли в тему напрямую. */
      var head = task._chainHead || task;
      if (head._cancelClickCapture) {
        try { head._cancelClickCapture(); } catch (e) {}
        head._cancelClickCapture = null;
      }
      if (rule && rule.replay) replayTriggerEvent();
    }
    task.fn = function () {
      try {
        /* Single source of truth for reconstructing the <script> node. */
        var nd = S.exec.build(node);
        if (isAsync) { try { nd.fetchPriority = 'low'; } catch (e) {} }
        /* Mark the materialized script as handled so MutationObserver doesn't
           re-match it against the same rule and re-block, which would create
           an infinite chain extension loop. */
        try { nd.setAttribute(HANDLED, '1'); } catch (e) {}
        var hasSrc = !!nd.src;
        if (hasSrc) {
          nd.addEventListener('load', function () {
            S.emit('scriptLoaded', nd, rule);
            if (rule && rule.onload && S.handlers[rule.onload]) {
              try { S.handlers[rule.onload](nd, rule); } catch (e) { S.debug.log('onload handler failed', e); }
            }
            fireNext();
          });
          nd.addEventListener('error', function (ev) {
            S.emit('scriptError', nd, rule, ev);
            if (rule && rule.onerror && S.handlers[rule.onerror]) {
              try { S.handlers[rule.onerror](nd, rule, ev); } catch (e) { S.debug.log('onerror handler failed', e); }
            }
            /* Идём дальше по цепочке даже при ошибке, иначе chain повиснет на 404. */
            fireNext();
          });
        }
        (node.parentNode || d.head).insertBefore(nd, node);
        if (node.parentNode) node.parentNode.removeChild(node);
        if (rule && rule.callback && S.handlers[rule.callback]) {
          try { S.handlers[rule.callback](nd, rule); } catch (e) {}
        }
        if (!hasSrc) {
          S.emit('scriptLoaded', nd, rule);
          if (rule && rule.onload && S.handlers[rule.onload]) {
            try { S.handlers[rule.onload](nd, rule); } catch (e) { S.debug.log('onload handler failed', e); }
          }
          fireNext();
        }
      } catch (e) { S.debug.log('exec script failed', e); fireNext(); }
    };
    return task;
  }

  function makeMediaTask(node, rule) {
    return {
      node: node,
      priority: rule && rule.priority || 0,
      fn: function () {
        try {
          var src = node.dataset && node.dataset.src;
          if (src) {
            node.addEventListener('load', function () {
              S.emit('mediaLoaded', node, rule);
              if (rule && rule.onload && S.handlers[rule.onload]) {
                try { S.handlers[rule.onload](node, rule); } catch (e) { S.debug.log('onload handler failed', e); }
              }
            });
            node.addEventListener('error', function (ev) {
              S.emit('mediaError', node, rule, ev);
              if (rule && rule.onerror && S.handlers[rule.onerror]) {
                try { S.handlers[rule.onerror](node, rule, ev); } catch (e) { S.debug.log('onerror handler failed', e); }
              }
            });
            node.src = src;
          }
          if (rule && rule.callback && S.handlers[rule.callback]) {
            try { S.handlers[rule.callback](node, rule); } catch (e) {}
          }
        } catch (e) {}
      }
    };
  }

  function processScript(node) {
    if (node.getAttribute(HANDLED)) return;
    var nodeType = node.getAttribute('type') || '';
    if (!isExecutableType(nodeType)) return;
    if (S.isException(node)) return;
    node.setAttribute(HANDLED, '1');
    var rule = findRule(node, 'SCRIPT');
    if (rule) {
      if (rule.queue === 'skip') {
        blockScript(node);
        S.emit('scriptSkipped', node, rule);
        S.debug.tap(node, 'skip');
        return;
      }
      blockScript(node);
      var task = makeScriptTask(node, rule);
      /* chain: каждый следующий task ждёт onload (или onerror) предыдущего.
         Триггер регистрируется только на голову цепочки; в очередь пушится тоже только голова —
         иначе runQueue запустит все task'ы параллельно по таймауту. */
      if (rule.chain) {
        var chain = chainOf(rule);
        if (chain.length > 0) {
          var prev = chain[chain.length - 1];
          prev._chainNext = task;
          task._chainHead = prev._chainHead || chain[0];
        } else {
          task._chainHead = task;
        }
        chain.push(task);
        if (chain.length === 1) {
          if (rule.replay) task._replayOnDone = true;
          if (rule.preventDefault) task._preventDefaultOnTrigger = true;
          if (rule.onTrigger) task._onTriggerHandlerId = rule.onTrigger;
          if (rule.fallbackTimeout != null) task._fallbackTimeout = rule.fallbackTimeout;
          S.run.onTrigger(rule.trigger || 'timeout', task, { rootMargin: rule.rootMargin });
          S.run.push(rule.queue || 'event', task);
        }
        S.emit('scriptIntercepted', node, rule);
        S.debug.tap(node, 'chain[' + chain.length + ']:' + (rule.queue || 'event') + '/' + (rule.trigger || 'timeout'));
      } else {
        if (rule.replay) task._replayOnDone = true;
        if (rule.preventDefault) task._preventDefaultOnTrigger = true;
        if (rule.onTrigger) task._onTriggerHandlerId = rule.onTrigger;
        if (rule.fallbackTimeout != null) task._fallbackTimeout = rule.fallbackTimeout;
        S.run.onTrigger(rule.trigger || 'timeout', task, { rootMargin: rule.rootMargin });
        S.run.push(rule.queue || 'event', task);
        S.emit('scriptIntercepted', node, rule);
        S.debug.tap(node, 'rule:' + (rule.queue || 'event') + '/' + (rule.trigger || 'timeout'));
      }
    } else {
      /* No rule matched. After the LCP point a script that was NOT pre-deferred
         by the server (it lacks the javascript/sapp-loading marker) is a runtime
         injection — loadScriptOnce, a late app, etc. The critical window is over,
         so queueing it only delays it pointlessly; leave it for the browser to
         run now. Pre-deferred placeholders and rule-matched scripts (e.g. wallets
         gated on interaction) still go through the queue as before. */
      var preDeferred = nodeType.indexOf('javascript/sapp-loading') === 0;
      if (!preDeferred && w.__sappLcpReady) {
        S.debug.tap(node, 'run-now:post-lcp');
        return;
      }
      blockScript(node);
      var defaultTask = makeScriptTask(node, null);
      var defaultQueue = node.getAttribute('data-sapp-from-embed') === '1' ? 'embeds'
        : node.getAttribute('data-sapp-from-async-load') === '1' ? 'async' : 'scripts';
      S.run.onTrigger('timeout', defaultTask);
      S.run.push(defaultQueue, defaultTask);
      S.debug.tap(node, 'defer-default:' + defaultQueue);
    }
  }

  function processMedia(node) {
    if (node.getAttribute(HANDLED)) return;
    if (S.isException(node)) return;
    if (!node.getAttribute('src')) return;
    node.setAttribute(HANDLED, '1');
    var rule = findRule(node, node.tagName);
    if (rule && rule.queue === 'skip') {
      blockMedia(node);
      S.emit('mediaSkipped', node, rule);
      S.debug.tap(node, 'skip');
      return;
    }
    blockMedia(node);
    var task = makeMediaTask(node, rule);
    var queue = rule && rule.queue || 'event';
    var trigger = rule && rule.trigger || defaultMediaTrigger;
    S.run.onTrigger(trigger, task, { rootMargin: rule && rule.rootMargin });
    S.run.push(queue, task);
    S.debug.tap(node, 'media:' + trigger);
  }

  function restoreEmbedApps() {
    try {
      var ids = ['sapp-head-embed', 'sapp-body-embed'];
      var movedScripts = [];
      for (var i = 0; i < ids.length; i++) {
        var tpl = d.getElementById(ids[i]);
        if (!tpl) continue;
        var dest = i === 0 ? d.head : d.body;
        var fragment = tpl.content;
        var scripts = fragment.querySelectorAll('script');
        for (var j = 0; j < scripts.length; j++) {
          var src = scripts[j].getAttribute('src');
          if (S.isException(scripts[j])) {
            movedScripts.push(scripts[j]);
            continue;
          }
          if (src) { scripts[j].setAttribute('data-src', src); scripts[j].removeAttribute('src'); }
          var origType = scripts[j].getAttribute('type') || '';
          if (origType && origType.indexOf('javascript/sapp-loading') !== 0) {
            scripts[j].setAttribute('data-sapp-orig-type', origType);
          }
          scripts[j].setAttribute('type', DEFER);
          scripts[j].setAttribute('data-sapp-from-embed', '1');
          movedScripts.push(scripts[j]);
        }
        dest.appendChild(fragment);
        tpl.remove();
      }
      for (var k = 0; k < movedScripts.length; k++) processNode(movedScripts[k]);
      S.emit('embedAppsRestored');
      S.debug.log('embed apps restored, scripts:', movedScripts.length);
    } catch (e) { S.debug.log('restoreEmbedApps failed', e); }
  }

  function processNode(node) {
    if (!node || node.nodeType !== 1) return;
    var tag = node.tagName;
    if (tag === 'SCRIPT') {
      if (node.id === 'sapp-init-embed') { restoreEmbedApps(); return; }
      processScript(node);
    } else if (MEDIA_TAGS[tag]) {
      processMedia(node);
    }
  }

  function materializeAsyncLoad() {
    try {
      if (typeof w.asyncLoad === 'function') {
        try { w.asyncLoad(); } catch (e) { S.debug.log('asyncLoad() threw', e); }
      }
      var urls = w.asyncLoadArr || [];
      var loaded = w.asyncLoadArrLoaded = w.asyncLoadArrLoaded || [];
      for (var i = 0; i < urls.length; i++) {
        var url = urls[i];
        if (!url || loaded.indexOf(url) !== -1) continue;
        loaded.push(url);
        var nd = d.createElement('script');
        nd.setAttribute('data-src', url);
        nd.setAttribute('type', DEFER);
        nd.setAttribute('data-sapp-from-async-load', '1');
        d.head.appendChild(nd);
        processNode(nd);
      }
      S.debug.log('materializeAsyncLoad: queued', urls.length, 'urls');
    } catch (e) { S.debug.log('materializeAsyncLoad failed', e); }
  }

  var mo = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) processNode(added[j]);
    }
  });

  function start() { try { mo.observe(d.documentElement, { childList: true, subtree: true }); S.state.started = true; S.debug.log('observer started'); } catch (e) {} }
  function stop() { try { mo.disconnect(); S.state.started = false; } catch (e) {} }

  S.observer = { start: start, stop: stop, restoreEmbedApps: restoreEmbedApps, processNode: processNode, materializeAsyncLoad: materializeAsyncLoad };

  try {
    var preNodes = d.querySelectorAll('script, iframe, video, audio');
    for (var k = 0; k < preNodes.length; k++) processNode(preNodes[k]);
  } catch (e) {}

  start();
})(window, document);
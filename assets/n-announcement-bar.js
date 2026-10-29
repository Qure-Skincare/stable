(function () {
    var TZ = 'America/Los_Angeles';
    var DAY_MS = 86400000;
    var SCOPE_SELECTOR = '#announcement-bar .e-countdown, .flyout-cart__bf-countdown .e-countdown';

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    // Writes only on change, so ticks don't generate mutations of their own.
    function setText(el, value) {
        if (el.textContent !== value) el.textContent = value;
    }

    // Returns the current LA wall-clock time as a "fake-UTC" timestamp
    // (Date.UTC built from LA Y/M/D h:m:s). Comparing this against another
    // value built the same way gives an accurate ms diff regardless of
    // the visitor's local timezone and DST.
    function nowLAMs() {
        var parts = new Intl.DateTimeFormat('en-US', {
            timeZone: TZ,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }).formatToParts(new Date());

        var get = function (type) {
            var p = parts.find(function (x) { return x.type === type; });
            return parseInt(p.value, 10);
        };

        var hour = get('hour');
        if (hour === 24) hour = 0;

        return Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
    }

    // Parses a YYYY-MM-DD start date as LA midnight, in the same
    // "fake-UTC" reference frame used by nowLAMs().
    function parseStartLAMs(str) {
        if (!str) return null;
        var m = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return null;
        return Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 0, 0, 0);
    }

    function updateCountdown(root) {
        var children = root.querySelectorAll(':scope > div[data-key]');
        if (children.length < 4) return false;

        var offerDays = parseInt(root.getAttribute('data-offer-days'), 10) || 0;
        if (offerDays <= 0) return false;

        var startMs = parseStartLAMs(root.getAttribute('data-deadline'));
        var fullMs = offerDays * DAY_MS;
        var nowMs = nowLAMs();
        var diffMs;

        if (startMs !== null) {
            if (nowMs < startMs) {
                // Promo has not started yet — freeze on full duration.
                diffMs = fullMs;
            } else {
                diffMs = (startMs + fullMs) - nowMs;
            }
        } else {
            // No start date configured — fall back to "now + N days" per element.
            if (typeof root._countdownEnd !== 'number') {
                root._countdownEnd = nowMs + fullMs;
            }
            diffMs = root._countdownEnd - nowMs;
        }

        if (diffMs < 0) diffMs = 0;

        var totalSeconds = Math.floor(diffMs / 1000);
        var d = Math.floor(totalSeconds / 86400);
        totalSeconds -= d * 86400;
        var h = Math.floor(totalSeconds / 3600);
        totalSeconds -= h * 3600;
        var mm = Math.floor(totalSeconds / 60);
        var s = totalSeconds - mm * 60;

        setText(children[0], pad2(d));
        setText(children[1], pad2(h));
        setText(children[2], pad2(mm));
        setText(children[3], pad2(s));

        return diffMs > 0;
    }

    function tick() {
        // Re-query each tick so Swiper-cloned slides (loop mode) update too.
        var roots = document.querySelectorAll(SCOPE_SELECTOR);
        roots.forEach(updateCountdown);
        // Drop the records of our own writes so they don't trigger a re-tick.
        if (observer) observer.takeRecords();
    }

    // The announcement bar and the cart drawer are re-rendered from section
    // HTML with "00" placeholders on every cart change. Mutation callbacks run
    // before the next paint, so re-ticking here keeps the reset invisible.
    function touchesCountdown(mutation) {
        var target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
        if (target && target.closest(SCOPE_SELECTOR)) return true;

        for (var i = 0; i < mutation.addedNodes.length; i++) {
            var node = mutation.addedNodes[i];
            if (node.nodeType === 1 && (node.matches(SCOPE_SELECTOR) || node.querySelector(SCOPE_SELECTOR))) {
                return true;
            }
        }
        return false;
    }

    var observer = null;

    function watchRerenders() {
        observer = new MutationObserver(function (mutations) {
            if (mutations.some(touchesCountdown)) tick();
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    function init() {
        tick();
        setInterval(tick, 1000);
        watchRerenders();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// Wistia builds a full player for every <wistia-player> on the page, which on
// video-heavy pages keeps the main thread busy for seconds and delays taps.
// Facades stay plain thumbnails until they near the viewport, then become the
// same popover player the sections used to render directly. The player has to
// exist before the tap: one created by the tap itself can't autoplay on iOS.
(function () {
    if (window.__wistiaFacade) return;
    window.__wistiaFacade = true;

    const SELECTOR = '[data-wistia-facade]';
    const PLAYER_SELECTOR = '[data-wistia-facade-player]';
    const OVERLAY_SELECTOR = '.c-wistia__play';
    const COMMON_ATTRS = {
        'wistia-popover': 'true',
        'end-video-behavior': 'loop',
        'controls-visible-on-load': 'false',
        'play-button': 'false'
    };
    // Facades with a theme thumbnail open from it; swatch facades stand in for
    // an inert player that draws its own thumbnail under a .c-wistia__play overlay.
    const LINK_ATTRS = { 'popover-content': 'link' };
    const SWATCH_ATTRS = { inert: '' };
    // Swatches are ~57x100 and rounded, so near-9:16 ones keep the exact default.
    const DEFAULT_ASPECT = 9 / 16;
    const ASPECT_TOLERANCE = 0.03;
    const SIZE_WAIT_FRAMES = 120;

    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1));
    const ready = new WeakSet();

    let observer = null;
    let sizeObserver = null;
    let pending = null;

    // The player collapses to zero height while Wistia sets it up, and an inert
    // one stays empty until it has sized itself to the video; the holder keeps
    // the facade's height until then.
    const releaseHeight = (player, frames = SIZE_WAIT_FRAMES) => {
        const holder = player.parentElement;
        if (!holder) return;
        if (player.offsetHeight > 0 || frames <= 0) holder.style.removeProperty('min-height');
        else requestAnimationFrame(() => releaseHeight(player, frames - 1));
    };

    const watchReady = (player) => {
        if (typeof player.whenApiReady !== 'function') return false;
        player.whenApiReady().then(() => {
            ready.add(player);
            requestAnimationFrame(() => releaseHeight(player));
        });
        return true;
    };

    const upgrade = (facade) => {
        if (!facade.isConnected || !facade.matches(SELECTOR)) return null;
        if (observer) observer.unobserve(facade);

        facade.parentElement.style.minHeight = `${facade.offsetHeight}px`;

        const swatch = facade.hasAttribute('data-wistia-swatch');
        const player = document.createElement('wistia-player');
        player.setAttribute('media-id', facade.getAttribute('data-wistia-facade'));
        Object.entries({ ...COMMON_ATTRS, ...(swatch ? SWATCH_ATTRS : LINK_ATTRS) })
            .forEach(([name, value]) => player.setAttribute(name, value));
        if (facade.hasAttribute('data-wistia-autoplay')) player.setAttribute('autoplay', 'true');
        if (!swatch) {
            // Wistia wraps the content in its own .wistia_click_to_play, which the
            // facade's content wrapper stands in for until now.
            const content = facade.querySelector(':scope > .c-wistia__facade-content') || facade;
            player.append(...content.childNodes);
        }
        player.setAttribute('data-wistia-facade-player', '');
        facade.replaceWith(player);

        if (!watchReady(player)) {
            // sapp parks player.js until the first interaction; ask for it now.
            if (window.__sappWistiaLoad) window.__sappWistiaLoad();
            customElements.whenDefined('wistia-player').then(() => watchReady(player));
        }

        return player;
    };

    const fitSwatch = (img) => {
        // sapp swaps in a 1x1 placeholder until the image nears the viewport.
        if (!/\/swatch/.test(img.currentSrc) || !img.naturalWidth || !img.naturalHeight) return;
        const aspect = img.naturalWidth / img.naturalHeight;
        if (Math.abs(aspect - DEFAULT_ASPECT) <= ASPECT_TOLERANCE) return;
        img.parentElement.style.setProperty('--wistia-aspect', `${img.naturalWidth} / ${img.naturalHeight}`);
    };

    const observe = (root) => {
        root.querySelectorAll(`${SELECTOR}[data-wistia-swatch] img`).forEach(img => img.complete && fitSwatch(img));

        const facades = root.querySelectorAll(SELECTOR);
        if (!facades.length) return;

        if (!observer) {
            if (!('IntersectionObserver' in window)) {
                facades.forEach(upgrade);
                return;
            }
            // Slider slides have no width until the swiper starts, so every one
            // of them "intersects" at the same spot. A zero-size facade waits
            // for a size and is then checked again, so only the slides that
            // actually come into view get a player.
            sizeObserver = new ResizeObserver((entries) => {
                entries.forEach(({ target }) => {
                    if (!target.offsetWidth) return;
                    sizeObserver.unobserve(target);
                    observer.unobserve(target);
                    observer.observe(target);
                });
            });
            observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    if (!entry.boundingClientRect.width) sizeObserver.observe(entry.target);
                    else idle(() => upgrade(entry.target), { timeout: 1000 });
                });
            }, { rootMargin: '300px 0px' });
        }

        facades.forEach(facade => observer.observe(facade));
    };

    document.addEventListener('load', (e) => {
        if (e.target.tagName === 'IMG' && e.target.closest(`${SELECTOR}[data-wistia-swatch]`)) fitSwatch(e.target);
    }, true);

    // The tap target is the facade or its player, or the .c-wistia__play overlay
    // next to an inert one.
    const tapTarget = (el) => {
        if (!el.closest) return null;
        const hit = el.closest(`${SELECTOR}, ${PLAYER_SELECTOR}`);
        if (hit) return hit;
        const overlay = el.closest(OVERLAY_SELECTOR);
        return overlay && overlay.parentElement.querySelector(`:scope > ${SELECTOR}, :scope > ${PLAYER_SELECTOR}`);
    };

    const TAP_SLOP = 10;
    let swallowClick = false;

    // A tap that beats the observer or Wistia's setup must not be lost. Wistia
    // moves the thumbnail into the player while setting it up, so the browser
    // drops the click; the tap is recognised on pointerup instead and the popover
    // opens once the player is ready (~250 ms after it is built).
    document.addEventListener('pointerdown', (e) => {
        pending = null;
        const hit = tapTarget(e.target);
        if (!hit) return;

        const player = hit.matches(SELECTOR) ? upgrade(hit) : hit;
        if (player && !ready.has(player)) pending = { player, x: e.clientX, y: e.clientY };
    }, true);

    document.addEventListener('pointerup', (e) => {
        const tap = pending;
        pending = null;
        // Before player.js is defined, the sapp click interceptor replays the tap.
        if (!tap || !tap.player.isConnected || typeof tap.player.whenApiReady !== 'function') return;
        if (Math.abs(e.clientX - tap.x) > TAP_SLOP || Math.abs(e.clientY - tap.y) > TAP_SLOP) return;

        swallowClick = true;
        setTimeout(() => { swallowClick = false; }, 500);
        // showPopover() doesn't start playback the way a click on the link does;
        // an inert player opens its popover on play(). iOS may refuse play() this
        // late after the tap; the popover's own play button is left for the
        // visitor then.
        tap.player.whenApiReady().then(() => {
            if (!tap.player.hasAttribute('inert')) tap.player.showPopover();
            Promise.resolve(tap.player.play()).catch(() => {});
        });
    }, true);

    document.addEventListener('click', (e) => {
        if (!swallowClick) return;
        swallowClick = false;
        e.preventDefault();
        e.stopPropagation();
    }, true);

    document.addEventListener('shopify:section:load', e => observe(e.target));

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => observe(document), { once: true });
    } else {
        observe(document);
    }
})();

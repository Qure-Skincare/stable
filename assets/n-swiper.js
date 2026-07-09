// Wrap in IIFE to avoid global identifier clashes when script loads multiple times
(function() {
// Initialize Swiper on a given element and handle responsive enable/disable
function setupBaseSlider(el) {
    if (!(el instanceof HTMLElement)) return;
    // Prevent double-binding on the same element
    if (el.hasAttribute('data-swiper-bound')) return;

    const config = JSON.parse(el.getAttribute('data-swiper'));

    // Responsive enablement: allow enabling only on mobile/desktop
    // Usage in data-swiper JSON:
    // { "enableOn": "mobile", "breakpoint": 768 }
    // - enableOn: "mobile" | "desktop" | "all" (default: "all")
    // - breakpoint: width in px that separates mobile/desktop (default: 767)
    const enableOn = (config.enableOn || "all").toLowerCase();
    const breakpoint = Number.isFinite(config.breakpoint) ? config.breakpoint : 767;

    const shouldEnableForWidth = (width) => {
        if (enableOn === "mobile") return width < breakpoint;
        if (enableOn === "desktop") return width >= breakpoint;
        return true; // "all"
    };

    const swiperEvents = {
        autoplayTimeLeft(swiper, time, progress) {
            const parentElement = swiper.el.closest('.expert-reviews').querySelector('.swiper-slide-thumb-active');
            parentElement.style.setProperty("--progress", 1 - progress);
        }
    };

    const eventsAttr = el.getAttribute("data-swiper-events");

    if (eventsAttr) {
        const eventNames = eventsAttr.split(",").map(e => e.trim());

        config.on = config.on || {};

        eventNames.forEach(name => {
            if (swiperEvents[name]) {
                config.on[name] = swiperEvents[name];
            }
        });
    }

    // Default custom pagination render
    if (config.pagination && config.pagination.type === "custom") {
        config.pagination.renderCustom = function (_, current, total) {
            return `<strong>${current}</strong> / <span>${total}</span>`;
        };
    }

    // Handle thumbs navigation slider
    const thumbsSelector = el.getAttribute("data-swiper-thumbs");
    let thumbSwiper = null;

    if (thumbsSelector) {
        const thumbsEl = document.querySelector(thumbsSelector);
        if (thumbsEl) {
            const thumbsConfig = thumbsEl.getAttribute("data-swiper");
            const thumbsOptions = thumbsConfig ? JSON.parse(thumbsConfig) : {};

            // Default thumbs configuration
            thumbsOptions.watchSlidesProgress = true;
            thumbsOptions.freeMode = thumbsOptions.freeMode !== false;
            thumbsOptions.slideToClickedSlide = true;

            thumbSwiper = new Swiper(thumbsEl, thumbsOptions);
            config.thumbs = { swiper: thumbSwiper };
        }
    }

    // Add c-swiper-nav-disabled class when navigation is disabled
    const updateNavClass = (swiper) => {
        if (swiper.isBeginning && swiper.isEnd) {
            swiper.el.classList.add("c-swiper-nav-disabled");
        } else {
            swiper.el.classList.remove("c-swiper-nav-disabled");
        }
    };

    // Steps
    const stepsSelector = config["steps-selector"];

    const updateSteps = (swiper) => {
        if (!stepsSelector) return;

        const stepsContainer = document.querySelector(stepsSelector);
        if (!stepsContainer) return;

        const steps = stepsContainer.querySelectorAll('li');

        const start = swiper.realIndex ?? swiper.activeIndex;

        const perView = Math.floor(swiper.params.slidesPerView);

        const end = start + perView - 1;

        steps.forEach((step, index) => {
            if (index <= end) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
    };

    config.on = {
        ...(config.on || {}),
        init(swiper) {
            updateNavClass(swiper);
            updateSteps(swiper);
        },
        resize: updateNavClass,
        slidesLengthChange: updateNavClass,
        slideChange: updateSteps
    };

    // Manage init/destroy based on viewport width
    let mainSwiper = null;

    const initSwiper = () => {
        if (!mainSwiper) {
            // When thumbs are configured, ensure config.thumbs is set before init
            mainSwiper = new Swiper(el, config);
            // Mark element as initialized to avoid duplicate bindings
            el.setAttribute('data-swiper-bound', 'true');
        }
    };

    const destroySwiper = () => {
        if (mainSwiper) {
            mainSwiper.destroy(true, true);
            mainSwiper = null;
            // Keep bound marker; we only manage lifecycle by viewport, not re-bind listeners
        }
    };

    const handleResponsive = () => {
        const width = window.innerWidth;
        if (shouldEnableForWidth(width)) {
            initSwiper();
        } else {
            destroySwiper();
        }
    };

    // Initialize appropriately and listen for resizes
    handleResponsive();
    window.addEventListener("resize", handleResponsive);
}

/* --- Lazy, spread-out initialization ---------------------------------------
   Initializing every [data-swiper] in one synchronous loop builds a single
   long main-thread task (each new Swiper() forces layout). Instead:
   - init a slider only when it nears the viewport (IntersectionObserver), so
     off-screen sliders cost nothing until scrolled to;
   - when several are visible at once, init them one-per-frame so each Swiper()
     is its own short task and input stays responsive. */

const initQueue = [];
let draining = false;
function drainInitQueue() {
    if (draining) return;
    draining = true;
    const step = () => {
        const el = initQueue.shift();
        if (el) setupBaseSlider(el);
        if (initQueue.length) requestAnimationFrame(step);
        else draining = false;
    };
    requestAnimationFrame(step);
}
function enqueueInit(el) {
    initQueue.push(el);
    drainInitQueue();
}

const sliderIO = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries, obs) => {
        for (const e of entries) {
            if (e.isIntersecting) { obs.unobserve(e.target); enqueueInit(e.target); }
        }
    }, { rootMargin: '200px 0px' })
    : null;

function queueSlider(el) {
    if (!(el instanceof HTMLElement)) return;
    if (el.hasAttribute('data-swiper-bound') || el.__swiperQueued) return;
    el.__swiperQueued = true;
    const notRendered = el.getClientRects().length === 0;
    if (sliderIO && !notRendered) sliderIO.observe(el);   // init when it nears the viewport
    else enqueueInit(el);                                  // hidden or no IO support → init now
}

// Queue existing sliders — only those in/near the viewport init now.
document.querySelectorAll('[data-swiper]').forEach(queueSlider);

// Observe DOM for dynamically added sliders (bundle templates, modals, AJAX).
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches && node.matches('[data-swiper]')) queueSlider(node);
            if (node.querySelectorAll) node.querySelectorAll('[data-swiper]').forEach(queueSlider);
        }
    }
});

observer.observe(document.documentElement, { childList: true, subtree: true });

})();

(function () {
    'use strict';

    var MAX_ATTEMPTS = 50;
    var RETRY_DELAY = 60;
    var VISUALS_BOUND_ATTRIBUTE = 'data-optional-subscription-bound';
    var ATC_BOUND_ATTRIBUTE = 'data-atc-upsell-bound';
    var PENDING_ATTRIBUTE = 'data-atc-upsell-pending';
    var FALLBACK_ATTRIBUTE = 'data-atc-upsell-fallback';

    function getSection(root) {
        var sectionId = root.getAttribute('data-section-id');
        var section = sectionId ? document.getElementById(sectionId) : null;
        return section || root.closest('.hero-product');
    }

    function initVisuals(root) {
        if (root.hasAttribute(VISUALS_BOUND_ATTRIBUTE)) return;

        var checkbox = root.querySelector('input[name="subscription"]');
        var section = getSection(root);
        if (!checkbox || !section) return;

        var gallery = section.querySelector('.hero-product__gallery');
        if (!gallery) return;

        var mainSlider = gallery.querySelector('.c-swiper:not(.c-swiper-thumbs)');
        var mainImage = mainSlider
            ? mainSlider.querySelector('.swiper-wrapper > .swiper-slide:first-child img')
            : gallery.querySelector(':scope > img');
        var firstThumb = gallery.querySelector('.c-swiper-thumbs .swiper-slide:first-child');
        var thumbImage = firstThumb ? firstThumb.querySelector('img') : null;
        var autoShips = root.querySelector('.e-auto-ships');

        var checkedImageInput = root.querySelector('input[name="checked-image"]');
        var uncheckedImageInput = root.querySelector('input[name="unchecked-image"]');
        var checkedImage = checkedImageInput ? checkedImageInput.value : '';
        var uncheckedImage = uncheckedImageInput ? uncheckedImageInput.value : '';
        var defaultMainImage = mainImage ? mainImage.getAttribute('src') : '';
        var defaultThumbImage = thumbImage ? thumbImage.getAttribute('src') : '';

        function getImageUrl(checked, fallback) {
            var configuredImage = checked ? checkedImage : uncheckedImage;
            return configuredImage || fallback;
        }

        function showFirstSlide() {
            if (mainSlider && mainSlider.swiper && typeof mainSlider.swiper.slideTo === 'function') {
                mainSlider.swiper.slideTo(0);
            } else if (firstThumb) {
                firstThumb.click();
            }
        }

        function update(checked, navigateToFirstSlide) {
            if (mainImage) mainImage.src = getImageUrl(checked, defaultMainImage);
            if (thumbImage) thumbImage.src = getImageUrl(checked, defaultThumbImage);

            if (autoShips) autoShips.hidden = !checked;
            if (navigateToFirstSlide) showFirstSlide();
        }

        checkbox.addEventListener('change', function () {
            update(checkbox.checked, true);
        });

        root.setAttribute(VISUALS_BOUND_ATTRIBUTE, 'true');
        update(checkbox.checked, false);
    }

    function isConnected(node) {
        if (typeof node.isConnected === 'boolean') {
            return node.isConnected;
        }
        return document.documentElement.contains(node);
    }

    function isValidQuantity(value) {
        return typeof value === 'number' && value >= 1 && value === value;
    }

    function getCartApi() {
        if (
            window.CartDrawer &&
            typeof window.CartDrawer.addToCartJson === 'function'
        ) {
            return window.CartDrawer.addToCartJson.bind(window.CartDrawer);
        }

        if (typeof window.addToCartJson === 'function') {
            return window.addToCartJson.bind(window);
        }

        return null;
    }

    function setPending(form, isPending) {
        var submitButton = form.querySelector('[type="submit"]');

        if (isPending) {
            form.setAttribute(PENDING_ATTRIBUTE, '1');
            form.setAttribute('aria-busy', 'true');
        } else {
            form.removeAttribute(PENDING_ATTRIBUTE);
            form.removeAttribute('aria-busy');
        }

        if (submitButton) {
            submitButton.disabled = isPending;
            submitButton.setAttribute('aria-disabled', isPending ? 'true' : 'false');
        }
    }

    function dispatchError(form, error) {
        var event;
        var detail = { error: error };

        try {
            if (typeof window.CustomEvent === 'function') {
                event = new CustomEvent('atc-upsell:error', {
                    bubbles: true,
                    cancelable: false,
                    detail: detail
                });
            } else {
                event = document.createEvent('CustomEvent');
                event.initCustomEvent('atc-upsell:error', true, false, detail);
            }
        } catch (eventError) {
            console.error('[atc-upsell] Failed to create error event:', eventError);
            return;
        }

        form.dispatchEvent(event);
    }

    function handleFailure(form, error) {
        console.error('[atc-upsell] Failed to add items to cart:', error);
        setPending(form, false);
        dispatchError(form, error);
    }

    function nativeSubmit(form) {
        setPending(form, false);
        form.setAttribute(FALLBACK_ATTRIBUTE, '1');

        try {
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit();
            } else {
                HTMLFormElement.prototype.submit.call(form);
            }
        } finally {
            form.removeAttribute(FALLBACK_ATTRIBUTE);
        }
    }

    function addDirectly(items, form) {
        if (typeof window.fetch !== 'function') {
            nativeSubmit(form);
            return;
        }

        var routesRoot = (
            window.Shopify &&
            window.Shopify.routes &&
            window.Shopify.routes.root
        ) || '/';

        window.fetch(routesRoot + 'cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
        })
            .then(function (response) {
                return response.json().then(function (payload) {
                    if (!response.ok) {
                        throw new Error(
                            payload.description ||
                            payload.message ||
                            'Cart request failed with status ' + response.status
                        );
                    }
                    return payload;
                });
            })
            .then(function () {
                setPending(form, false);
                window.location.assign(routesRoot + 'cart');
            })
            .catch(function (error) {
                handleFailure(form, error);
            });
    }

    function collectItems(root, form) {
        var idInput = form.querySelector('[name="id"]');
        var mainVariantId = idInput && idInput.value;
        if (!mainVariantId) return null;

        var quantityInput = form.querySelector('[name="quantity"]');
        var quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;
        if (!isValidQuantity(quantity)) quantity = 1;

        var items = [{ id: mainVariantId, quantity: quantity }];
        var subscriptionCheckbox = root.querySelector(
            '.c-optional-subscription input[name="subscription"]'
        );
        var serumVariantId = root.getAttribute('data-serum-variant-id');
        var sellingPlanId = root.getAttribute('data-selling-plan-id');

        if (subscriptionCheckbox && subscriptionCheckbox.checked && serumVariantId) {
            var serumItem = { id: serumVariantId, quantity: 1 };
            if (sellingPlanId) serumItem.selling_plan = sellingPlanId;
            items.push(serumItem);
        }

        return items;
    }

    function addWithRetry(items, form, attempt) {
        if (!isConnected(form)) {
            setPending(form, false);
            return;
        }

        var cartApi = getCartApi();

        if (!cartApi) {
            if (attempt >= MAX_ATTEMPTS) {
                console.warn('[atc-upsell] Cart drawer API did not load; using direct cart request.');
                addDirectly(items, form);
                return;
            }

            setTimeout(function () {
                addWithRetry(items, form, attempt + 1);
            }, RETRY_DELAY);
            return;
        }

        var result;

        try {
            result = cartApi(items);
        } catch (error) {
            handleFailure(form, error);
            return;
        }

        if (result && typeof result.then === 'function') {
            result.then(
                function () {
                    setPending(form, false);
                },
                function (error) {
                    handleFailure(form, error);
                }
            );
            return;
        }

        setPending(form, false);
    }

    function initAddToCart(root) {
        var section = getSection(root);
        var form = section && section.querySelector('.c-buy-block form');

        if (!form || form.getAttribute(ATC_BOUND_ATTRIBUTE) === '1') return;

        form.setAttribute(ATC_BOUND_ATTRIBUTE, '1');
        form.addEventListener('submit', function (event) {
            if (form.getAttribute(FALLBACK_ATTRIBUTE) === '1') return;

            if (form.getAttribute(PENDING_ATTRIBUTE) === '1') {
                event.preventDefault();
                return;
            }

            var items = collectItems(root, form);
            if (!items) return;

            event.preventDefault();
            setPending(form, true);
            addWithRetry(items, form, 0);
        });
    }

    function initOptionalSubscription(root) {
        if (!(root instanceof HTMLElement)) return;
        initVisuals(root);
        initAddToCart(root);
    }

    function initAll(scope) {
        if (scope.matches && scope.matches('[data-optional-subscription]')) {
            initOptionalSubscription(scope);
        }
        scope.querySelectorAll('[data-optional-subscription]').forEach(initOptionalSubscription);
    }

    initAll(document);

    document.addEventListener('shopify:section:load', function (event) {
        initAll(event.target);
    });
})();

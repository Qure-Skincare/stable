(function () {
    'use strict';

    var RETRY_DELAY = 60;
    var CART_BOUND_ATTRIBUTE = 'data-optional-subscription-cart-bound';
    var PENDING_ATTRIBUTE = 'data-optional-subscription-pending';

    function getSection(root) {
        return root.closest('.hero-product');
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

    function handleFailure(form, error) {
        console.error('[optional-subscription] Failed to add items to cart:', error);
        setPending(form, false);
    }

    function collectItems(root, form) {
        var idInput = form.querySelector('[name="id"]');
        var primaryVariantId = idInput && idInput.value;
        if (!primaryVariantId) return null;

        var quantityInput = form.querySelector('[name="quantity"]');
        var quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;
        if (!isValidQuantity(quantity)) quantity = 1;

        var items = [{ id: primaryVariantId, quantity: quantity }];
        var subscriptionCheckbox = root.querySelector(
            '.c-optional-subscription input[name="subscription"]'
        );

        if (subscriptionCheckbox && subscriptionCheckbox.checked) {
            var subscriptionVariantId = root.getAttribute('data-subscription-variant-id');
            var subscriptionSellingPlanId = root.getAttribute('data-subscription-selling-plan-id');

            if (!subscriptionVariantId || !subscriptionSellingPlanId) {
                throw new Error('Subscription variant or selling plan is not configured.');
            }

            items.push({
                id: subscriptionVariantId,
                quantity: 1,
                selling_plan: subscriptionSellingPlanId
            });
        }

        return items;
    }

    function addWithRetry(items, form) {
        if (!isConnected(form)) {
            setPending(form, false);
            return;
        }

        var cartApi = getCartApi();

        if (!cartApi) {
            setTimeout(function () {
                addWithRetry(items, form);
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

    function initCart(root) {
        if (!(root instanceof HTMLElement)) return;

        var section = getSection(root);
        var form = section && section.querySelector('.c-buy-block form');

        if (!form) return;
        if (form.getAttribute(CART_BOUND_ATTRIBUTE) === '1') return;

        form.setAttribute(CART_BOUND_ATTRIBUTE, '1');
        form.addEventListener('submit', function (event) {
            if (form.getAttribute(PENDING_ATTRIBUTE) === '1') {
                event.preventDefault();
                return;
            }

            var items;

            try {
                items = collectItems(root, form);
            } catch (error) {
                event.preventDefault();
                handleFailure(form, error);
                return;
            }

            if (!items) return;

            event.preventDefault();
            setPending(form, true);
            addWithRetry(items, form);
        });
    }

    function initAll(scope) {
        if (scope.matches && scope.matches('[data-optional-subscription]')) {
            initCart(scope);
        }
        scope.querySelectorAll('[data-optional-subscription]').forEach(initCart);
    }

    initAll(document);

    document.addEventListener('shopify:section:load', function (event) {
        initAll(event.target);
    });
})();

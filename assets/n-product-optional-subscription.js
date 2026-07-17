(function () {
    'use strict';

    const RETRY_DELAY = 200;
    const MAX_RETRIES = 25;

    const pendingForms = new WeakSet();
    const bypassForms = new WeakSet();

    const getCartApi = () => {
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
    };

    const setPending = (form, isPending) => {
        if (isPending) {
            pendingForms.add(form);
            form.setAttribute('aria-busy', 'true');
        } else {
            pendingForms.delete(form);
            form.removeAttribute('aria-busy');
        }

        form.querySelectorAll('[type="submit"]').forEach((submitButton) => {
            submitButton.disabled = isPending;
            submitButton.setAttribute('aria-disabled', isPending ? 'true' : 'false');
        });
    };

    const handleFailure = (form, error) => {
        console.error('[optional-subscription] Failed to add items to cart:', error);
        setPending(form, false);
    };

    const submitNative = (form) => {
        bypassForms.add(form);
        try {
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit();
            } else {
                HTMLFormElement.prototype.submit.call(form);
            }
        } finally {
            bypassForms.delete(form);
        }
    };

    const collectItems = (root, form) => {
        const formData = new FormData(form);
        const primaryVariantId = formData.get('id');
        if (!primaryVariantId) return null;

        let quantity = parseInt(formData.get('quantity'), 10);
        if (!Number.isInteger(quantity) || quantity < 1) quantity = 1;

        const primaryItem = { id: primaryVariantId, quantity: quantity };

        const sellingPlan = formData.get('selling_plan');
        if (sellingPlan) {
            primaryItem.selling_plan = sellingPlan;
        }

        const properties = {};
        let hasProperties = false;
        formData.forEach((value, key) => {
            const match = key.match(/^properties\[(.+)\]$/);
            if (match) {
                properties[match[1]] = value;
                hasProperties = true;
            }
        });
        if (hasProperties) {
            primaryItem.properties = properties;
        }

        const items = [primaryItem];
        const subscriptionCheckbox = root.querySelector(
            '.c-optional-subscription input[name="subscription"]'
        );

        if (subscriptionCheckbox && subscriptionCheckbox.checked) {
            const subscriptionVariantId = root.getAttribute('data-subscription-variant-id');
            const subscriptionSellingPlanId = root.getAttribute('data-subscription-selling-plan-id');

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
    };

    const addWithRetry = (items, form, attempt) => {
        if (!form.isConnected) {
            setPending(form, false);
            return;
        }

        const cartApi = getCartApi();

        if (!cartApi) {
            if (attempt >= MAX_RETRIES) {
                setPending(form, false);
                submitNative(form);
                return;
            }

            setTimeout(() => {
                addWithRetry(items, form, attempt + 1);
            }, RETRY_DELAY);
            return;
        }

        let result;

        try {
            result = cartApi(items);
        } catch (error) {
            handleFailure(form, error);
            return;
        }

        if (result && typeof result.then === 'function') {
            result.then(
                () => {
                    setPending(form, false);
                },
                (error) => {
                    handleFailure(form, error);
                }
            );
            return;
        }

        setPending(form, false);
    };

    const handleSubmit = (event) => {
        const form = event.target;

        if (!(form instanceof HTMLFormElement)) return;
        if (bypassForms.has(form)) return;
        if (!form.matches('.c-buy-block form[action$="/cart/add"]')) return;

        const section = form.closest('.hero-product, .shopify-section');
        const root = section && section.querySelector('[data-optional-subscription]');
        if (!root) return;

        const isStatic = form.getAttribute('data-static') === 'true';

        if (pendingForms.has(form)) {
            event.preventDefault();
            if (!isStatic) event.stopImmediatePropagation();
            return;
        }

        let items;

        try {
            items = collectItems(root, form);
        } catch (error) {
            event.preventDefault();
            if (!isStatic) event.stopImmediatePropagation();
            handleFailure(form, error);
            return;
        }

        if (!items) return;

        event.preventDefault();
        if (!isStatic) event.stopImmediatePropagation();
        setPending(form, true);
        addWithRetry(items, form, 0);
    };

    if (!window.__optionalSubscriptionSubmitBound) {
        window.__optionalSubscriptionSubmitBound = true;
        document.addEventListener('submit', handleSubmit, true);
    }
})();

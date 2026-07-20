(function () {
    'use strict';

    const GLOBAL_FLAG = '__optionalSubscriptionSubmitBound';
    const PENDING_ATTRIBUTE = 'data-optional-subscription-pending';
    const WAS_DISABLED_ATTRIBUTE = 'data-optional-subscription-was-disabled';

    const FORM_SELECTOR = 'form[action$="/cart/add"]';
    const SECTION_SELECTOR = '.shopify-section, .hero-product';
    const WIDGET_SELECTOR = '[data-optional-subscription]';
    const CHECKBOX_SELECTOR =
        '.c-optional-subscription input[name="subscription"]';

    const getCartApi = () => {
        if (
            window.CartDrawer &&
            typeof window.CartDrawer.addToCartJson === 'function'
        ) {
            return window.CartDrawer.addToCartJson.bind(window.CartDrawer);
        }
        if (typeof addToCartJson === 'function') {
            return addToCartJson;
        }
        return null;
    };

    const setPending = (form, isPending) => {
        const submitButton = form.querySelector('[type="submit"]');

        if (isPending) {
            form.setAttribute(PENDING_ATTRIBUTE, '1');
            form.setAttribute('aria-busy', 'true');
        } else {
            form.removeAttribute(PENDING_ATTRIBUTE);
            form.removeAttribute('aria-busy');
        }

        if (!submitButton) return;

        if (isPending) {
            if (submitButton.disabled) {
                submitButton.setAttribute(WAS_DISABLED_ATTRIBUTE, '1');
            }
            submitButton.disabled = true;
            submitButton.setAttribute('aria-disabled', 'true');
            return;
        }

        const wasDisabled = submitButton.hasAttribute(WAS_DISABLED_ATTRIBUTE);

        submitButton.disabled = wasDisabled;
        submitButton.removeAttribute(WAS_DISABLED_ATTRIBUTE);

        if (wasDisabled) {
            submitButton.setAttribute('aria-disabled', 'true');
        } else {
            submitButton.removeAttribute('aria-disabled');
        }
    };

    const findWidget = (form) => {
        const section = form.closest(SECTION_SELECTOR);
        if (!section) return null;

        const widgets = section.querySelectorAll(WIDGET_SELECTOR);
        if (widgets.length === 0) return null;
        if (widgets.length === 1) return widgets[0];

        for (const widget of widgets) {
            if (widget.contains(form) || form.contains(widget)) {
                return widget;
            }
        }

        return null;
    };

    const getPrimaryItem = (formData) => {
        const id = formData.get('id');
        if (!id) return null;

        let quantity = parseInt(formData.get('quantity'), 10);
        if (!Number.isInteger(quantity) || quantity < 1) quantity = 1;

        const item = { id, quantity };

        const sellingPlan = formData.get('selling_plan');
        if (sellingPlan) item.selling_plan = sellingPlan;

        const properties = {};
        let hasProperties = false;
        formData.forEach((value, key) => {
            const match = key.match(/^properties\[(.+)\]$/);
            if (match) {
                properties[match[1]] = value;
                hasProperties = true;
            }
        });
        if (hasProperties) item.properties = properties;

        return item;
    };

    const getSubscriptionItem = (widget) => {
        const checkbox = widget.querySelector(CHECKBOX_SELECTOR);
        if (!checkbox || !checkbox.checked) return null;

        const id = widget.getAttribute('data-subscription-variant-id');
        const sellingPlan = widget.getAttribute(
            'data-subscription-selling-plan-id'
        );

        if (!id || !sellingPlan) {
            console.warn(
                '[optional-subscription] Subscription variant or selling plan is not configured. Adding primary product only.'
            );
            return null;
        }

        return { id, quantity: 1, selling_plan: sellingPlan };
    };

    const handleSubmit = (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.matches(FORM_SELECTOR)) return;

        if (form.hasAttribute(PENDING_ATTRIBUTE)) {
            event.preventDefault();
            return;
        }

        const widget = findWidget(form);
        if (!widget) return;

        const cartApi = getCartApi();
        if (!cartApi) return;

        const primaryItem = getPrimaryItem(new FormData(form));
        if (!primaryItem) return;

        const items = [primaryItem];
        const subscriptionItem = getSubscriptionItem(widget);
        if (subscriptionItem) items.push(subscriptionItem);

        event.preventDefault();
        setPending(form, true);

        let result;

        try {
            result = cartApi(items);
        } catch (error) {
            console.error(
                '[optional-subscription] Cart API threw synchronously, falling back to native submit:',
                error
            );
            setPending(form, false);
            if (form.isConnected) form.submit();
            return;
        }

        Promise.resolve(result).then(
            () => setPending(form, false),
            () => setPending(form, false)
        );
    };

    if (!window[GLOBAL_FLAG]) {
        window[GLOBAL_FLAG] = true;
        document.addEventListener('submit', handleSubmit, true);
    }
})();

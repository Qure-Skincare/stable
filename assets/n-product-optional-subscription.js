(function () {
    'use strict';

    const GLOBAL_FLAG = '__optionalSubscriptionClickBound';
    const FORM_SELECTOR = 'form[action$="/cart/add"]';
    const SUBMIT_SELECTOR = '[type="submit"]';
    const SECTION_SELECTOR = '.shopify-section, .hero-product';
    const WIDGET_SELECTOR = '[data-optional-subscription]';
    const CHECKBOX_SELECTOR =
        '.c-optional-subscription input[name="subscription"]';

    const getAddToCart = () => {
        if (
            window.CartDrawer &&
            typeof window.CartDrawer.addToCart === 'function'
        ) {
            return window.CartDrawer.addToCart;
        }
        if (typeof addToCart === 'function') {
            return addToCart;
        }
        return null;
    };

    const getAddToCartJson = () => {
        if (
            window.CartDrawer &&
            typeof window.CartDrawer.addToCartJson === 'function'
        ) {
            return window.CartDrawer.addToCartJson;
        }
        if (typeof addToCartJson === 'function') {
            return addToCartJson;
        }
        return null;
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

    const handleClick = (event) => {
        const button = event.target.closest(SUBMIT_SELECTOR);
        if (!button) return;

        const form = button.closest(FORM_SELECTOR);
        if (!form) return;

        const widget = findWidget(form);
        if (!widget) return;

        const checkbox = widget.querySelector(CHECKBOX_SELECTOR);
        const subscriptionId = widget.getAttribute(
            'data-subscription-variant-id'
        );
        const subscriptionSellingPlan = widget.getAttribute(
            'data-subscription-selling-plan-id'
        );

        // Stop the event entirely: other delegated cart handlers listen for the
        // same click and would add the items a second time (duplicates in cart).
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const formData = new FormData(form);

        if (!checkbox || !checkbox.checked || !subscriptionId || !subscriptionSellingPlan) {
            const addToCartFn = getAddToCart();
            if (addToCartFn) {
                addToCartFn(formData);
            } else if (form.isConnected) {
                form.submit();
            }
            return;
        }

        const id = formData.get('id');
        if (!id) return;

        let quantity = parseInt(formData.get('quantity'), 10);
        if (!Number.isInteger(quantity) || quantity < 1) quantity = 1;

        const primaryItem = { id, quantity };
        const sellingPlan = formData.get('selling_plan');
        if (sellingPlan) primaryItem.selling_plan = sellingPlan;

        const subscriptionItem = {
            id: subscriptionId,
            quantity: 1,
            selling_plan: subscriptionSellingPlan
        };

        const addToCartJsonFn = getAddToCartJson();
        if (!addToCartJsonFn) {
            if (form.isConnected) form.submit();
            return;
        }

        addToCartJsonFn([primaryItem, subscriptionItem]);
    };

    const syncSubscriptionLabel = (widget) => {
        const section = widget.closest(SECTION_SELECTOR);
        if (!section) return;

        const checkbox = widget.querySelector(CHECKBOX_SELECTOR);
        const button = section.querySelector('.add-cart-button[data-label-alt]');
        if (!checkbox || !button) return;

        const defaultLabel = button.getAttribute('data-label-default');
        const altLabel = button.getAttribute('data-label-alt');
        if (defaultLabel == null || altLabel == null) return;

        button.innerHTML = checkbox.checked ? defaultLabel : altLabel;
    };

    const initLabelSync = () => {
        document.querySelectorAll(WIDGET_SELECTOR).forEach((widget) => {
            const checkbox = widget.querySelector(CHECKBOX_SELECTOR);
            if (!checkbox) return;
            syncSubscriptionLabel(widget);
            checkbox.addEventListener('change', () =>
                syncSubscriptionLabel(widget)
            );
        });
    };

    if (!window[GLOBAL_FLAG]) {
        window[GLOBAL_FLAG] = true;
        // Capture phase: runs before any bubble-phase cart handlers, so
        // stopPropagation() reliably prevents duplicate add-to-cart calls.
        document.addEventListener('click', handleClick, true);

        if (document.readyState !== 'loading') {
            initLabelSync();
        } else {
            document.addEventListener('DOMContentLoaded', initLabelSync);
        }
    }
})();

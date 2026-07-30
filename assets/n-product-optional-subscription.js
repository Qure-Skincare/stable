(function () {
    'use strict';

    const GLOBAL_FLAG = '__optionalSubscriptionClickBound';
    const FORM_SELECTOR = 'form[action$="/cart/add"]';
    const SUBMIT_SELECTOR = '[type="submit"]';
    const SECTION_SELECTOR = '.shopify-section, .hero-product';
    const WIDGET_SELECTOR = '[data-optional-subscription]';
    const CHECKBOX_SELECTOR =
        '.c-optional-subscription input[name="subscription"]';
    const BUTTON_SELECTOR =
        '.add-cart-button[data-label-alt], .add-cart-button[data-label-offer-alt]';

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
        const button = section.querySelector(BUTTON_SELECTOR);
        if (!checkbox || !button) return;

        // With data-label-offer-alt the selected-state label is whatever ends up on the
        // button (an offer script rewrites it), so it is captured instead of rendered.
        const altLabel =
            button.getAttribute('data-label-offer-alt') ||
            button.getAttribute('data-label-alt');
        if (altLabel == null) return;

        if (checkbox.checked) {
            const defaultLabel = button.getAttribute('data-label-default');
            if (defaultLabel != null) {
                button.innerHTML = defaultLabel;
            }
            return;
        }

        if (button.getAttribute('data-label-default') == null) {
            button.setAttribute('data-label-default', button.innerHTML);
            // Offer scripts skip [data-label-alt], so the captured label is not
            // overwritten if one of them runs after the checkbox was cleared.
            button.setAttribute('data-label-alt', altLabel);
        }

        button.innerHTML = altLabel;
    };

    const syncAllSubscriptionLabels = () => {
        document.querySelectorAll(WIDGET_SELECTOR).forEach((widget) => {
            syncSubscriptionLabel(widget);
        });
    };

    const handleCheckboxChange = (event) => {
        if (!event.target.matches(CHECKBOX_SELECTOR)) return;

        // subscription-option.js mirrors the checkbox into every other widget on the
        // page without firing change on the copies, and it may run after this handler,
        // so every label is re-synced once the mirroring has settled.
        syncAllSubscriptionLabels();
        setTimeout(syncAllSubscriptionLabels, 0);
    };

    const initLabelSync = () => {
        syncAllSubscriptionLabels();
        document.addEventListener('change', handleCheckboxChange);
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

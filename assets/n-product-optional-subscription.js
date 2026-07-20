(function () {
    'use strict';

    const GLOBAL_FLAG = '__optionalSubscriptionSubmitBound';
    const FORM_SELECTOR = 'form[action$="/cart/add"]';
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

    const handleSubmit = (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.matches(FORM_SELECTOR)) return;

        const widget = findWidget(form);
        if (!widget) return;

        const checkbox = widget.querySelector(CHECKBOX_SELECTOR);
        const subscriptionId = widget.getAttribute(
            'data-subscription-variant-id'
        );
        const subscriptionSellingPlan = widget.getAttribute(
            'data-subscription-selling-plan-id'
        );

        event.preventDefault();
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

    if (!window[GLOBAL_FLAG]) {
        window[GLOBAL_FLAG] = true;
        document.addEventListener('submit', handleSubmit, true);
    }
})();

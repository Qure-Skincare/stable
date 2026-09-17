(function () {
    'use strict';

    const GLOBAL_FLAG = '__optionalSubscriptionClickBound';
    const FORM_SELECTOR = 'form[action$="/cart/add"]';
    // Opt-in narrowing for widgets carrying [data-main-form-only]: only a section's
    // main buy form is intercepted (.c-buy-block wraps both the buy button and the
    // sticky CTA), so sibling /cart/add forms in the same section - cross-sell,
    // upsells - keep adding just their own product. Widgets without the attribute
    // are matched against FORM_SELECTOR exactly as before.
    const MAIN_FORM_SELECTOR = '.c-buy-block form[action$="/cart/add"]';
    const SUBMIT_SELECTOR = '[type="submit"]';
    const SECTION_SELECTOR = '.shopify-section, .hero-product';
    const WIDGET_SELECTOR = '[data-optional-subscription]';
    const CHECKBOX_SELECTOR =
        '.c-optional-subscription input[name="subscription"]';
    const BUTTON_SELECTOR =
        '.add-cart-button[data-label-alt], .add-cart-button[data-label-offer-alt]';
    // purchase-form-landing only: its delivery switcher lets a widget opt out of
    // the one-time tab. Absent on pages without the switcher, so this is inert there.
    const DELIVERY_RADIO_SELECTOR =
        'input[type="radio"][name="delivery-type-landing"]';
    const SUPPRESSED_FLAG = 'optionalSubscriptionSuppressed';

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

    // Line-item properties the purchase form writes into the add-to-cart form
    // (properties[_gift], properties[_discount_code]) as a plain object.
    const readFormProperties = (formData) => {
        const properties = {};

        formData.forEach((value, key) => {
            const match = /^properties\[(.+)\]$/.exec(key);
            if (match) properties[match[1]] = value;
        });

        return properties;
    };

    const handleClick = async (event) => {
        const button = event.target.closest(SUBMIT_SELECTOR);
        if (!button) return;

        const form = button.closest(FORM_SELECTOR);
        if (!form) return;

        const widget = findWidget(form);
        if (!widget) return;

        if (
            widget.hasAttribute('data-main-form-only') &&
            !form.matches(MAIN_FORM_SELECTOR)
        ) {
            return;
        }

        const checkbox = widget.querySelector(CHECKBOX_SELECTOR);
        const suppressed = widget.dataset[SUPPRESSED_FLAG] === 'true';
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

        if (suppressed || !checkbox || !checkbox.checked || !subscriptionId || !subscriptionSellingPlan) {
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

        // Carried over so the primary line keeps the properties the FormData path
        // would have set - the cart drawer's orphan-gift cleanup matches a gift
        // against properties[_gift] on its parent line.
        const properties = readFormProperties(formData);
        if (Object.keys(properties).length > 0) primaryItem.properties = properties;

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

        await addToCartJsonFn([primaryItem, subscriptionItem]);

        // addToCartJson applies only the site-wide discount, so a form-level gift
        // and discount code are handed to the drawer's own routine - the same
        // contract the FormData path uses - and the drawer is re-rendered after.
        const needsProductGift = properties._gift || properties._discount_code;
        if (needsProductGift && window.CartDrawer) {
            if (typeof window.CartDrawer.addProductGift === 'function') {
                await window.CartDrawer.addProductGift(formData);
            }
            if (typeof window.CartDrawer.refreshDrawer === 'function') {
                await window.CartDrawer.refreshDrawer();
            }
        }
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

    // Widgets flagged with data-hide-on-onetime are taken out of the page while the
    // landing form's delivery switcher sits on "one-time". Hidden inline because the
    // component's own display rule would win over a class, and flagged on the dataset
    // so handleClick treats a hidden widget as opted out.
    const syncOnetimeVisibility = () => {
        const checked = document.querySelector(DELIVERY_RADIO_SELECTOR + ':checked');
        const onetime = checked ? checked.value === 'onetime' : false;

        document
            .querySelectorAll(WIDGET_SELECTOR + '[data-hide-on-onetime="true"]')
            .forEach((widget) => {
                widget.style.display = onetime ? 'none' : '';
                widget.dataset[SUPPRESSED_FLAG] = onetime ? 'true' : 'false';
            });
    };

    const handleDeliveryChange = (event) => {
        if (!event.target.matches(DELIVERY_RADIO_SELECTOR)) return;
        syncOnetimeVisibility();
    };

    const initLabelSync = () => {
        syncAllSubscriptionLabels();
        syncOnetimeVisibility();
        document.addEventListener('change', handleCheckboxChange);
        document.addEventListener('change', handleDeliveryChange);
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

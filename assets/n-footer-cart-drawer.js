/* events */

document.addEventListener('DOMContentLoaded', () => {
    bindForms();
});

document.addEventListener('cart.requestComplete', (event) => {
    scheduleReload(event.detail || {});
});



/*  render  */

// Section Rendering API ids: theme section filenames (verified to resolve
// both in GET /?sections= and in bundled Cart API responses).
const SECTION_ID = 'n-footer-cart-drawer';
const CART_SECTION_ID = 'cart';

const sectionsList = () => {
    return footer_cart_drawer_template == 'cart'
        ? SECTION_ID + ',' + CART_SECTION_ID
        : SECTION_ID;
};

// Coalesce overlapping cart.requestComplete events into a single reload at a
// time; the freshest detail wins, so concurrent morphs never interleave.
let pendingReloadDetail = null;
let reloadRunning = false;

const scheduleReload = (detail) => {
    pendingReloadDetail = detail;
    if (reloadRunning) return;
    reloadRunning = true;

    (async () => {
        while (pendingReloadDetail) {
            const current = pendingReloadDetail;
            pendingReloadDetail = null;
            try {
                await reloadDrawer(current);
            } catch (error) {
                console.error(error);
            }
        }
        reloadRunning = false;
    })();
};

const reloadDrawer = async (detail) => {
    const source = detail.source;

    if (detail.sections && detail.sections[SECTION_ID]) {
        await applySections(detail.sections);
    }
    else {
        if (detail.sections) warnSectionsFallback();
        await fetchSectionsGET();
    }

    if (source === 'addToCart' || source === 'addToCartJson') {
        showCart();
    }

    if (detail.cart && typeof detail.cart.item_count === 'number') {
        setCartCount(detail.cart.item_count);
    }
    else {
        getCartState().then(cart => {
            if (cart) setCartCount(cart.item_count);
        });
    }

    bindForms();

    loadScriptOnce('footer-cart-drawer-swiper', 'https://qureskincaredns-stable.com/assets/js/swiper.js');
};

const refreshDrawer = () => {
    return fetchSectionsGET().then(() => {
        bindForms();
        loadScriptOnce('footer-cart-drawer-swiper', 'https://qureskincaredns-stable.com/assets/js/swiper.js');
    });
};

const setCartCount = (count) => {
    const counter = document.querySelector('.cart-count');
    if (counter) counter.textContent = count;
};

let sectionsFallbackWarned = false;
const warnSectionsFallback = () => {
    if (sectionsFallbackWarned) return;
    sectionsFallbackWarned = true;
    console.warn('Cart drawer: bundled sections missing in response, falling back to section fetch');
};

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

const morphSectionHtml = (html, targetId) => {
    const current = document.getElementById(targetId);
    if (!current) return;

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const next = temp.querySelector('#' + targetId);
    if (!next) return;

    morphdom(current, next, {
        getNodeKey(node) {
            return node.nodeType === Node.ELEMENT_NODE ? node.getAttribute('id') : undefined;
        }
    });
};

const applySections = async (sectionsObj, { allowGetFallback = true } = {}) => {
    const drawerHtml = sectionsObj ? sectionsObj[SECTION_ID] : null;

    if (drawerHtml == null) {
        warnSectionsFallback();
        if (allowGetFallback) {
            await fetchSectionsGET();
        }
        else {
            await legacyReload();
        }
        return;
    }

    morphSectionHtml(drawerHtml, 'cart-dynamic-content');

    if (footer_cart_drawer_template == 'cart') {
        const cartHtml = sectionsObj[CART_SECTION_ID];
        if (cartHtml == null) {
            await updateSection(CART_SECTION_ID, 'main-cart-dynamic-content');
        }
        else {
            morphSectionHtml(cartHtml, 'main-cart-dynamic-content');
        }
    }

    await nextFrame();
};

const fetchSectionsGET = () => {
    return fetch(location.pathname + '/?sections=' + sectionsList(), { priority: 'high' })
        .then(res => res.json())
        .then(sections => applySections(sections, { allowGetFallback: false }))
        .catch(async (error) => {
            console.error('Error fetching cart sections:', error);
            await legacyReload();
        });
};

const legacyReload = async () => {
    if (footer_cart_drawer_template == 'cart') {
        await updateSection(CART_SECTION_ID, 'main-cart-dynamic-content');
    }
    await updateSection(SECTION_ID, 'cart-dynamic-content');
};

const updateSection = (section_id, targetElement) => {
    const currentDrawer = document.getElementById(targetElement);
    if (!currentDrawer) return;

    return fetch(location.pathname + '/?section_id=' + section_id, { priority: 'high' })
            .then(res => res.text())
            .then(html => {
                morphSectionHtml(html, targetElement);
                return nextFrame();
            });
};

const bindForms = () => {
    //clear all binds before if they are exist
    document.querySelectorAll('form[action$="/cart/add"]').forEach((form) => {
        if (form.getAttribute('data-static') === 'true') {
            return;
        }
        form.replaceWith(form.cloneNode(true));
    });

    toogleInsurance();

    document.querySelectorAll('form[action$="/cart/add"]').forEach((form) => {
        if (form.getAttribute('data-static') === 'true') {
            return;
        }
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            addToCart(formData);
        });
    });

    //clear all binds before if they are exist
    document.querySelectorAll('form[action$="/cart/change"]').forEach((form) => {
        form.replaceWith(form.cloneNode(true));
    });

    document.querySelectorAll('form[action$="/cart/change"]').forEach((form) => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            changeCart(formData);
        });
    });
}

const showCart = () => {
    if(footer_cart_drawer_template != 'cart') {
        const cartDrawer = document.querySelector('.offcanvas-end');
        if (cartDrawer && !cartDrawer.classList.contains('show')) {
            document.getElementById('cartCanvasBtn')?.click();
        }
    }
};

// `adding` shows the skeleton row for an incoming item (add flows only);
// plain loading just dims the current content (change/clear flows).
const setLoading = (state, adding = false) => {
    const content = document.getElementById('cart-dynamic-content');
    if (!content) return;
    content.classList.toggle('is-loading', state);
    content.classList.toggle('is-adding', state && adding);
};



/*  request helpers  */

const cartPost = (path, body) => {
    const isFormData = body instanceof FormData;

    return fetch((window.Shopify?.routes?.root || '/') + path, {
        method: 'POST',
        priority: 'high',
        headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        body: isFormData ? body : JSON.stringify(body)
    })
    .then(response => response.json());
};

// Ask the Cart API to render the drawer (and cart page) sections in the same
// response as the mutation, so no follow-up render request is needed.
const withSections = (body) => {
    if (body instanceof FormData) {
        body.set('sections', sectionsList());
        body.set('sections_url', window.location.pathname);
        return body;
    }
    return Object.assign({}, body, {
        sections: sectionsList(),
        sections_url: window.location.pathname
    });
};

const parseDiscountCodes = (value) => {
    return String(value || '')
        .split(',')
        .map(code => code.trim())
        .filter(Boolean);
};

const siteDiscount = () => {
    return typeof footer_cart_drawer_discount !== 'undefined' ? footer_cart_drawer_discount : null;
};

// Threshold-gift decisions extracted from toogleGift: which gifts must be
// added or removed given the current cart totals and the gift forms on page.
const computeGiftOps = (cart) => {
    const gifts_adding = [];
    const gift_updating = {};

    document.querySelectorAll('form.footer-cart-drawer-gift[action$="/cart/add"]').forEach((form) => {
        const formData = new FormData(form);
        const price_limit = formData.get('properties[_price_limit]');

        const giftItem = cart.items.find(item =>
            item.id === +(formData.get('id')) &&
            item.properties &&
            item.properties['_required_validation']
        );

        if (!giftItem) {
            if (cart.total_price >= price_limit) {
                gifts_adding.push({
                    id: +(formData.get('id')),
                    properties: {
                        _required_validation: formData.get('properties[_required_validation]')
                    },
                    quantity: 1
                });
            }
        }
        else if (cart.total_price < price_limit) {
            gift_updating[formData.get('id')] = 0;
        }
    });

    return { gifts_adding, gift_updating };
};

// A product gift may stay in the cart only while its parent line (the one
// whose properties[_gift] points at it) is present. When the parent is
// removed, its conditional discount no longer applies and the "gift" would
// linger as a paid line - so orphaned gifts are removed by line key.
const computeOrphanGiftOps = (cart) => {
    const updates = {};

    cart.items.forEach(item => {
        const giftRef = item.properties && item.properties['_product_gift'];
        if (!giftRef) return;

        const parentExists = cart.items.some(parent =>
            parent.properties && parent.properties['_gift'] == giftRef
        );

        if (!parentExists) {
            updates[item.key] = 0;
        }
    });

    return updates;
};

// Apply pending gift mutations with the minimum number of requests; the last
// mutating request carries the sections payload. Does not dispatch
// intermediate events - the caller dispatches a single terminal event.
const finishMutations = async (cart, giftOps, sectionsAlready) => {
    const { gifts_adding, gift_updating } = giftOps;
    const hasAdditions = gifts_adding.length > 0;
    const hasRemovals = Object.keys(gift_updating).length > 0;

    let sections = sectionsAlready || null;

    if (hasAdditions && hasRemovals) {
        await cartPost('cart/add.js', { items: gifts_adding });
        const res = await cartPost('cart/update.js', withSections({ updates: gift_updating }));
        cart = res;
        sections = res.sections || sections;
    }
    else if (hasAdditions) {
        const res = await cartPost('cart/add.js', withSections({ items: gifts_adding }));
        sections = res.sections || sections;
        // add.js returns only the added lines, so patch the count locally
        cart = Object.assign({}, cart, {
            item_count: cart.item_count + gifts_adding.reduce((total, item) => total + item.quantity, 0)
        });
    }
    else if (hasRemovals) {
        const res = await cartPost('cart/update.js', withSections({ updates: gift_updating }));
        cart = res;
        sections = res.sections || sections;
    }

    return { cart, sections };
};

const dispatchComplete = (source, extra) => {
    const detail = Object.assign({ source }, extra || {});
    const event = new CustomEvent('cart.requestComplete', { detail });
    document.dispatchEvent(event);
};

// Paint the drawer as soon as a mutating response arrives, before the
// gift/discount follow-ups finish. Later bundled sections re-morph on top.
// The drawer stays in loading mode (dimmed, clicks blocked - including
// checkout) until the caller ends the whole chain with setLoading(false);
// here only the skeleton row is dropped since real content is painted.
const earlyPaint = (sections) => {
    if (!sections || !sections[SECTION_ID]) return;

    try {
        morphSectionHtml(sections[SECTION_ID], 'cart-dynamic-content');

        if (footer_cart_drawer_template == 'cart' && sections[CART_SECTION_ID]) {
            morphSectionHtml(sections[CART_SECTION_ID], 'main-cart-dynamic-content');
        }

        setLoading(true, false);
        bindForms();
    }
    catch (error) {
        console.error(error);
    }
};



/*  default functions   */

const applyDiscounts = (discount_code) => {
    // Accepts a single code or a comma-separated list ("CODE1,CODE2");
    // entries are trimmed and empty ones are dropped.
    const codes = parseDiscountCodes(discount_code);

    if (codes.length === 0) return Promise.resolve();

    return cartPost('cart/update.js', { discount: codes.join(',') });
};

const addToCart = async (input) => {
    // Optimistic UI: open the drawer immediately, morph content on arrival.
    showCart();
    setLoading(true, true);

    try {
        const added = await cartPost('cart/add.js', withSections(input));
        earlyPaint(added.sections);

        // Single state fetch that drives all follow-up decisions.
        let cart = await getCartState();
        if (!cart) throw new Error('Unable to fetch cart state');

        const gift = typeof input.get === 'function' ? input.get('properties[_gift]') : null;
        const form_discount = typeof input.get === 'function' ? input.get('properties[_discount_code]') : null;

        let sections = added.sections || null;

        // Product gift (addProductGift semantics): add once, never duplicate.
        // Skeleton row signals the incoming gift while it loads.
        if (gift) {
            const alreadyAdded = cart.items.some(item =>
                item.properties && item.properties['_product_gift'] == gift
            );

            if (!alreadyAdded) {
                setLoading(true, true);
                const giftRes = await cartPost('cart/add.js', withSections({
                    items: [{
                        id: gift,
                        properties: { _product_gift: gift },
                        quantity: 1
                    }]
                }));
                cart.item_count += 1;
                if (giftRes.sections) {
                    sections = giftRes.sections;
                    earlyPaint(sections);
                }
            }
        }

        // Form-level and site-wide discounts merged into one update.js call;
        // its response (post-discount totals) drives the gift threshold check.
        const codes = [...new Set([
            ...parseDiscountCodes(form_discount),
            ...parseDiscountCodes(siteDiscount())
        ])];

        if (codes.length > 0) {
            const res = await cartPost('cart/update.js', withSections({ discount: codes.join(',') }));
            cart = res;
            sections = res.sections || sections;
            earlyPaint(res.sections);
        }

        const ops = computeGiftOps(cart);
        Object.assign(ops.gift_updating, computeOrphanGiftOps(cart));
        if (ops.gifts_adding.length > 0) {
            setLoading(true, true);
        }

        const result = await finishMutations(cart, ops, sections);

        setLoading(false);
        dispatchComplete('addToCart', result);
    }
    catch (error) {
        setLoading(false);
        console.error('Error cart adding:', error);
    }
};

const addToCartJson = async (input) => {
    showCart();
    setLoading(true, true);

    try {
        const added = await cartPost('cart/add.js', withSections({ items: input }));
        earlyPaint(added.sections);

        let cart = await getCartState();
        if (!cart) throw new Error('Unable to fetch cart state');

        const codes = parseDiscountCodes(siteDiscount());

        let sections = added.sections || null;
        if (codes.length > 0) {
            const res = await cartPost('cart/update.js', withSections({ discount: codes.join(',') }));
            cart = res;
            sections = res.sections || sections;
            earlyPaint(res.sections);
        }

        const ops = computeGiftOps(cart);
        Object.assign(ops.gift_updating, computeOrphanGiftOps(cart));
        if (ops.gifts_adding.length > 0) {
            setLoading(true, true);
        }

        const result = await finishMutations(cart, ops, sections);

        setLoading(false);
        dispatchComplete('addToCartJson', result);
    }
    catch (error) {
        setLoading(false);
        console.error('Error cart adding:', error);
    }
};

// Guard against a "free-only" cart: when the qualifying paid product is removed,
// its auto-added gift can linger, leaving item_count > 0 with total_price 0.
// A cart that holds items but has zero value must be emptied entirely.
const clearCartIfOnlyFreeItems = async () => {
    const cart = await getCartState();
    if (cart && cart.item_count > 0 && cart.total_price === 0) {
        await clearCart();
        return true;
    }
    return false;
};

const changeCart = async (input) => {
    setLoading(true);

    try {
        // change.js returns the full cart JSON plus rendered sections in one
        // round-trip - typically the only request of the whole flow.
        const res = await cartPost('cart/change.js', withSections(input));
        earlyPaint(res.sections);

        // Free-only cleanup from the response already in hand: if only
        // zero-value items remain, wipe the cart and stop the normal flow.
        if (res.item_count > 0 && res.total_price === 0) {
            const cleared = await cartPost('cart/clear.js', withSections({}));
            setLoading(false);
            dispatchComplete('clearCart', { cart: cleared, sections: cleared.sections });
            return;
        }

        const ops = computeGiftOps(res);
        Object.assign(ops.gift_updating, computeOrphanGiftOps(res));
        if (ops.gifts_adding.length > 0) {
            setLoading(true, true);
        }

        const result = await finishMutations(res, ops, res.sections);

        setLoading(false);

        if (typeof syncCart === 'function') {
            // syncCart may mutate the cart, so drop the pre-fetched sections
            // and let the reload fetch a fresh render.
            await syncCart(input);
            dispatchComplete('syncCart', {});
        }
        else {
            dispatchComplete('changeCart', result);
        }
    }
    catch (error) {
        setLoading(false);
        console.error('Error cart changing:', error);
    }
};

const clearCart = () => {
    return cartPost('cart/clear.js', withSections({}))
        .then(cart => {
            dispatchComplete('clearCart', { cart, sections: cart.sections });
        })
        .catch(error => {
            console.error('Error clearing cart:', error);
        });
}

const getCartState = () => {
    return fetch((window.Shopify?.routes?.root || '/') + 'cart.js', { priority: 'high' })
            .then(response => response.json())
            .catch(error => {
                console.error('Error fetching cart:', error);
                return null;
            });
}



/*  special functions   */

const toogleInsurance = () => {
    document.querySelectorAll('form[action$="/cart/add"]:has(input[type="checkbox"]#insurance)').forEach((form) => {
        const checkbox = form.querySelector('input[type="checkbox"]#insurance');

        if (!checkbox) return;

        checkbox.addEventListener('change', () => {
            getCartState().then(cart => {
                const insuranceItem = cart.items.find(item => item.title.includes('Shipping Insurance'));

                if(insuranceItem)
                {
                    const formData = new FormData();
                    formData.set('id', insuranceItem.id);
                    formData.set('quantity', 0);

                    changeCart(formData)
                    .then((cart) => {
                        if (checkbox.checked) {
                            const formData = new FormData(form);
                            addToCart(formData);
                        }
                    });
                }
                else {
                    const formData = new FormData(form);
                    if (checkbox.checked) {
                        addToCart(formData);
                    }
                }
            });
        });
    });
};

// Public API kept behavior-compatible for external callers: dispatches its
// own addToCartMany/updateCartMany events. Internal add/change flows use
// computeGiftOps + finishMutations instead.
const toogleGift = async () => {
    const cart = await getCartState();
    if (!cart) return;

    const { gifts_adding, gift_updating } = computeGiftOps(cart);

    if (gifts_adding.length > 0) {
        await addToCartMany(gifts_adding);
    }

    if (Object.keys(gift_updating).length > 0) {
        await updateCartMany(gift_updating);
    }
};

const addProductGift = async (input) => {
    // Only forms carrying both properties trigger the product gift (see n-purchase-form-landing.js).
    if (!input || typeof input.get !== 'function') return;

    const gift = input.get('properties[_gift]');
    const discount_code = input.get('properties[_discount_code]');

    const cart = await getCartState();
    if (!cart) return;

    if(gift) {
        // Add the gift once — do not duplicate it on repeated add-to-cart calls.
        const alreadyAdded = cart.items.some(item =>
            item.properties && item.properties['_product_gift'] == gift
        );

        if (!alreadyAdded) {
            await addToCartMany([{
                id: gift,
                properties: {
                    _product_gift: gift
                },
                quantity: 1
            }]);
        }
    }

    if(discount_code) {
        // Apply the accompanying discount code.
        await applyDiscounts(discount_code);
    }
};

const updateCart = async (input) => {
    return cartPost('cart/update.js', input)
        .catch((error) => {
            console.error('Error cart updating:', error);
            return null;
        });
};

const addToCartMany = (input) => {
    return cartPost('cart/add.js', { items: input })
        .then(() => {
            dispatchComplete('addToCartMany');
        })
        .catch((error) => {
            console.error('Error cart adding:', error);
        });
};

const updateCartMany = (updates) => {
    return cartPost('cart/update.js', { updates })
        .then(() => {
            dispatchComplete('updateCartMany');
        })
        .catch((error) => {
            console.error('Error updating cart:', error);
        });
};

window.CartDrawer = {
    applyDiscounts,
    toogleGift,
    addProductGift,
    addToCartJson,
    getCartState,
    refreshDrawer
};

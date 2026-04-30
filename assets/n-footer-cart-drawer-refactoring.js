const SECTION_ID = 'n-footer-cart-drawer';
const SECTION_TARGET = 'cart-dynamic-content';


/* events */

bindForms();

let queuedDetail = null;
let isReloading = false;

const scheduleReload = async () => {
    if (isReloading) return;
    isReloading = true;
    while (queuedDetail) {
        const detail = queuedDetail;
        queuedDetail = null;
        try {
            if (footer_cart_drawer_template == 'cart') {
                await updateSection('cart', 'main-cart-dynamic-content');
            }
            await reloadDrawer(detail);
        } catch (e) {
            console.error(e);
        }
    }
    isReloading = false;
};

document.addEventListener('cart.requestComplete', (event) => {
    queuedDetail = event.detail || {};
    scheduleReload();
});


/* render */

const reloadDrawer = async (detail) => {
    if (detail.drawerHTML) {
        applyDrawerHTML(detail.drawerHTML);
    } else {
        await updateSection(SECTION_ID, SECTION_TARGET);
    }

    if (detail.source === 'addToCart' || detail.source === 'addToCartJson') {
        showCart();
    }

    let itemCount = detail.itemCount;
    if (typeof itemCount !== 'number') {
        const cart = await getCartState();
        itemCount = cart?.item_count;
    }
    if (typeof itemCount === 'number') {
        const counter = document.querySelector('.cart-count');
        if (counter) counter.textContent = itemCount;
    }

    loadScriptOnce(`footer-cart-drawer-swiper.js?v=${Date.now()}`, 'https://qureskincaredns-stable.com/assets/js-new/swiper.js');
};

function bindForms() {
    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form.getAttribute('data-static') === 'true') return;
        const action = form.getAttribute('action') || '';
        if (action.endsWith('/cart/add')) {
            e.preventDefault();
            addToCart(new FormData(form));
        } else if (action.endsWith('/cart/change')) {
            e.preventDefault();
            changeCart(new FormData(form));
        }
    });

    document.addEventListener('change', (e) => {
        const cb = e.target;
        if (!(cb instanceof HTMLInputElement) || cb.type !== 'checkbox' || cb.id !== 'insurance') return;
        const form = cb.closest('form[action$="/cart/add"]');
        if (form) handleInsuranceToggle(cb, form);
    });
}

const applyDrawerHTML = (html) => {
    const current = document.getElementById(SECTION_TARGET);
    if (!current || !html) return;
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const next = temp.querySelector('#' + SECTION_TARGET);
    if (next) morphdom(current, next);
};

const updateSection = (section_id, targetElement) => {
    const current = document.getElementById(targetElement);
    if (!current) return Promise.resolve();

    return fetch(location.pathname + '/?section_id=' + section_id)
        .then((res) => res.text())
        .then((html) => {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const next = temp.querySelector('#' + targetElement);
            if (next) morphdom(current, next);
        })
        .then(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
};

const showCart = () => {
    if (footer_cart_drawer_template == 'cart') return;
    const drawer = document.querySelector('.offcanvas-end');
    if (drawer && !drawer.classList.contains('show')) {
        document.getElementById('cartCanvasBtn')?.click();
    }
};


/* cart api */

const cartURL = (path) => (window.Shopify?.routes?.root || '/') + path;

const cartPostForm = async (path, formData) => {
    formData.append('sections', SECTION_ID);
    formData.append('sections_url', location.pathname);
    const res = await fetch(cartURL(path), { method: 'POST', body: formData });
    return res.json();
};

const cartPostJson = async (path, body) => {
    const res = await fetch(cartURL(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, sections: SECTION_ID, sections_url: location.pathname }),
    });
    return res.json();
};

const getCartState = () =>
    fetch(cartURL('cart.js'))
        .then((r) => r.json())
        .catch((e) => {
            console.error('Error fetching cart:', e);
            return null;
        });

const dispatchComplete = (source, data = {}) => {
    document.dispatchEvent(new CustomEvent('cart.requestComplete', { detail: { source, ...data } }));
};

const applyDiscount = async () => {
    if (typeof footer_cart_drawer_discount !== 'undefined' && footer_cart_drawer_discount) {
        try { await fetch('/discount/' + footer_cart_drawer_discount); } catch (_) {}
    }
};


/* cart mutations */

const addToCart = async (input) => {
    try {
        const r1 = await cartPostForm('cart/add.js', input);
        const r2 = await cartPostJson('cart/update.js', { updates: {} });
        const fallbackHTML = r2?.sections?.[SECTION_ID] || r1?.sections?.[SECTION_ID];
        const { drawerHTML, itemCount } = await runGifts(r2, fallbackHTML);
        await applyDiscount();
        dispatchComplete('addToCart', { drawerHTML, itemCount });
    } catch (e) {
        console.error('Error cart adding:', e);
    }
};

const addToCartJson = async (items) => {
    try {
        const r1 = await cartPostJson('cart/add.js', { items });
        const r2 = await cartPostJson('cart/update.js', { updates: {} });
        const fallbackHTML = r2?.sections?.[SECTION_ID] || r1?.sections?.[SECTION_ID];
        const { drawerHTML, itemCount } = await runGifts(r2, fallbackHTML);
        await applyDiscount();
        dispatchComplete('addToCartJson', { drawerHTML, itemCount });
    } catch (e) {
        console.error('Error cart adding:', e);
    }
};

const changeCart = async (input) => {
    try {
        const r1 = await cartPostForm('cart/change.js', input);
        const { drawerHTML, itemCount } = await runGifts(r1, r1?.sections?.[SECTION_ID]);
        if (typeof syncCart === 'function') {
            await syncCart(input);
            dispatchComplete('syncCart', { drawerHTML, itemCount });
        } else {
            dispatchComplete('changeCart', { drawerHTML, itemCount });
        }
    } catch (e) {
        console.error('Error cart changing:', e);
    }
};

const clearCart = async () => {
    try {
        const r = await cartPostJson('cart/clear.js', {});
        dispatchComplete('clearCart', { drawerHTML: r?.sections?.[SECTION_ID], itemCount: 0 });
    } catch (e) {
        console.error('Error clearing cart:', e);
    }
};


/* gifts + insurance */

const runGifts = async (cart, fallbackHTML) => {
    let drawerHTML = fallbackHTML || null;
    let itemCount = cart?.item_count;

    const forms = document.querySelectorAll('form.footer-cart-drawer-gift[action$="/cart/add"]');
    if (forms.length === 0 || !cart) return { drawerHTML, itemCount };

    const gifts_adding = [];
    const gift_updating = {};

    for (const form of forms) {
        const fd = new FormData(form);
        const price_limit = +fd.get('properties[_price_limit]');
        const id = +fd.get('id');
        const giftItem = cart.items.find(
            (i) => i.id === id && i.properties && i.properties['_required_validation']
        );

        if (!giftItem) {
            if (cart.total_price >= price_limit) {
                gifts_adding.push({
                    id,
                    properties: { _required_validation: fd.get('properties[_required_validation]') },
                    quantity: 1,
                });
            }
        } else if (cart.total_price < price_limit) {
            gift_updating[id] = 0;
        }
    }

    if (gifts_adding.length > 0) {
        const r = await cartPostJson('cart/add.js', { items: gifts_adding });
        if (r?.sections?.[SECTION_ID]) drawerHTML = r.sections[SECTION_ID];
        itemCount = (itemCount ?? 0) + gifts_adding.length;
    }

    if (Object.keys(gift_updating).length > 0) {
        const r = await cartPostJson('cart/update.js', { updates: gift_updating });
        if (r?.sections?.[SECTION_ID]) drawerHTML = r.sections[SECTION_ID];
        if (typeof r?.item_count === 'number') itemCount = r.item_count;
    }

    return { drawerHTML, itemCount };
};

const toogleGift = async (dispatchOwn = true) => {
    const cart = await getCartState();
    if (!cart) return;
    const { drawerHTML, itemCount } = await runGifts(cart, null);
    if (dispatchOwn) dispatchComplete('addToCartMany', { drawerHTML, itemCount });
};

const handleInsuranceToggle = async (checkbox, form) => {
    const cart = await getCartState();
    if (!cart) return;
    const insuranceItem = cart.items.find((item) => item.title.includes('Shipping Insurance'));

    if (insuranceItem) {
        const fd = new FormData();
        fd.set('id', insuranceItem.id);
        fd.set('quantity', 0);
        await changeCart(fd);
        if (checkbox.checked) await addToCart(new FormData(form));
    } else if (checkbox.checked) {
        await addToCart(new FormData(form));
    }
};


window.CartDrawer = { toogleGift, addToCartJson, getCartState };
/**
 * Bundle Selection (n-)
 * Synchronizes [data-bundle-button] product cards with the
 * .bundle-cta-bar sticky bar (4 slots, tiered discounts 15/20/25/30).
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'nSkincarePlanBundle';
  const MAX_SLOTS = 4;
  const DISCOUNT_TIERS = {
    1: { percent: 15, code: 'BUNDLE15' },
    2: { percent: 20, code: 'BUNDLE20' },
    3: { percent: 25, code: 'BUNDLE25' },
    4: { percent: 30, code: 'BUNDLE30' },
  };

  let selectedProducts = [];

  async function init() {
    bindEvents();
    await restoreFromCart();
    updateUI();
  }

  function getButtonsMap() {
    const buttons = document.querySelectorAll('[data-bundle-button]');
    const map = {};
    buttons.forEach((button) => {
      const variantId = parseInt(button.dataset.variantId, 10);
      if (!variantId) return;
      map[variantId] = {
        variantId,
        handle: button.dataset.handle,
        title: button.dataset.title,
        price: parseFloat(button.dataset.price) || 0,
        image: button.dataset.image,
      };
    });
    return map;
  }

  async function restoreFromCart() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      const buttonDataMap = getButtonsMap();
      const pageVariantIds = new Set(Object.keys(buttonDataMap).map(Number));

      selectedProducts = [];
      cart.items.forEach((item) => {
        if (pageVariantIds.has(item.variant_id) && buttonDataMap[item.variant_id]) {
          selectedProducts.push(buttonDataMap[item.variant_id]);
        }
      });

      if (selectedProducts.length > MAX_SLOTS) {
        selectedProducts = selectedProducts.slice(0, MAX_SLOTS);
      }

      saveToStorage();
    } catch (e) {
      console.warn('n-bundle-selection: restoreFromCart failed', e);
      selectedProducts = [];
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProducts));
    } catch (e) {
      console.warn('n-bundle-selection: saveToStorage failed', e);
    }
  }

  function isProductSelected(variantId) {
    return selectedProducts.some((p) => p.variantId === variantId);
  }

  function toggleProduct(productData) {
    const variantId = productData.variantId;
    const index = selectedProducts.findIndex((p) => p.variantId === variantId);
    if (index > -1) {
      selectedProducts.splice(index, 1);
    } else if (selectedProducts.length < MAX_SLOTS) {
      selectedProducts.push({
        variantId: productData.variantId,
        handle: productData.handle,
        title: productData.title,
        price: parseFloat(productData.price) || 0,
        image: productData.image,
      });
    }
    saveToStorage();
    updateUI();
  }

  function removeProductByVariantId(variantId) {
    const index = selectedProducts.findIndex((p) => p.variantId === variantId);
    if (index > -1) {
      selectedProducts.splice(index, 1);
      saveToStorage();
      updateUI();
    }
  }

  function getCurrentTier() {
    const count = selectedProducts.length;
    if (count === 0) return null;
    return DISCOUNT_TIERS[Math.min(count, MAX_SLOTS)];
  }

  function calculateSubtotal() {
    return selectedProducts.reduce((sum, p) => sum + p.price, 0);
  }

  function calculateDiscountedPrice() {
    const subtotal = calculateSubtotal();
    const tier = getCurrentTier();
    if (!tier) return subtotal;
    return subtotal * (1 - tier.percent / 100);
  }

  function formatNumber(value, decimals, thousandsSep, decimalSep) {
    const fixed = decimals === 0 ? Math.round(value).toString() : value.toFixed(decimals);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
    return parts.length === 2 ? parts.join(decimalSep) : parts[0];
  }

  function formatPrice(cents) {
    const cfg = window.NBundleSelectionConfig || {};
    const fmt = cfg.moneyFormatNoTrailing || cfg.moneyFormat || '${{amount}}';
    const stripTrailing = !cfg.moneyFormatNoTrailing;
    const value = (Number(cents) || 0) / 100;
    return fmt.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, token) => {
      const isComma = token.indexOf('with_comma_separator') !== -1;
      const isApostrophe = token.indexOf('with_apostrophe_separator') !== -1;
      const noDecimals = token.indexOf('no_decimals') !== -1;
      const thousandsSep = isComma ? '.' : isApostrophe ? "'" : ',';
      const decimalSep = isComma ? ',' : '.';
      let out = formatNumber(value, noDecimals ? 0 : 2, thousandsSep, decimalSep);
      if (stripTrailing && !noDecimals) {
        const escapedSep = decimalSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(escapedSep + '?0+$'), '');
      }
      return out;
    });
  }

  function updateUI() {
    updateButtons();
    updateStickyBar();
  }

  function updateButtons() {
    const buttons = document.querySelectorAll('[data-bundle-button]');
    buttons.forEach((button) => {
      const variantId = parseInt(button.dataset.variantId, 10);
      const isSelected = isProductSelected(variantId);
      button.classList.toggle('bundle-selected', isSelected);
      const defaultText = button.dataset.defaultText || 'Add to Bundle';
      const selectedText = button.dataset.selectedText || 'Added!';
      button.textContent = isSelected ? selectedText : defaultText;
    });
  }

  function updateStickyBar() {
    const count = selectedProducts.length;
    const subtotal = calculateSubtotal();
    const discounted = calculateDiscountedPrice();

    document.querySelectorAll('[data-bundle-slot]').forEach((slot) => {
      const step = parseInt(slot.dataset.bundleSlot, 10);
      const productIndex = step - 1;
      const product = selectedProducts[productIndex];
      const filled = !!product;
      slot.classList.toggle('is-filled', filled);

      const img = slot.querySelector('[data-bundle-slot-image]');
      const removeBtn = slot.querySelector('[data-bundle-remove]');

      if (img) {
        if (filled) {
          img.src = product.image || '';
          img.alt = product.title || '';
        } else {
          img.removeAttribute('src');
          img.alt = '';
        }
      }
      if (removeBtn) {
        if (filled) {
          removeBtn.dataset.variantId = String(product.variantId);
        } else {
          delete removeBtn.dataset.variantId;
        }
      }
    });

    document.querySelectorAll('[data-bundle-progress]').forEach((el) => {
      const percent = count > 0 ? (count / MAX_SLOTS) * 100 : 0;
      el.style.setProperty('--bundle-progress', percent + '%');
      el.classList.toggle('has-selection', count > 0);
    });

    document.querySelectorAll('[data-bundle-amount]').forEach((el) => {
      el.classList.toggle('is-visible', count > 0);
    });

    document.querySelectorAll('[data-bundle-original]').forEach((el) => {
      el.textContent = formatPrice(subtotal);
    });
    document.querySelectorAll('[data-bundle-current]').forEach((el) => {
      el.textContent = formatPrice(discounted);
    });

    document.querySelectorAll('[data-bundle-cta]').forEach((btn) => {
      btn.disabled = count === 0;
    });
  }

  async function addToCartWithDiscount() {
    if (selectedProducts.length === 0) {
      const productsSection = document.querySelector('#skincare_goals');
      if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const tier = getCurrentTier();
    if (!tier) return;

    try {
      const cartResponse = await fetch('/cart.js');
      const cart = await cartResponse.json();
      const cartVariantIds = cart.items.map((i) => i.variant_id);

      const itemsToAdd = selectedProducts
        .filter((p) => !cartVariantIds.includes(p.variantId))
        .map((p) => ({ id: p.variantId, quantity: 1 }));

      if (itemsToAdd.length > 0) {
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToAdd }),
        });
        if (!response.ok) throw new Error('Failed to add to cart');
      }

      await fetch('/discount/' + tier.code);

      if (window.CartDrawer && typeof window.CartDrawer.toogleGift === 'function') {
        await window.CartDrawer.toogleGift();
      }

      const event = new CustomEvent('cart.requestComplete', {
        detail: { source: 'addToCartJson' },
      });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('n-bundle-selection: addToCartWithDiscount failed', error);
      alert('Error adding items to cart. Please try again.');
    }
  }

  async function syncWithCart() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      const cartVariantIds = cart.items.map((i) => i.variant_id);
      const previousCount = selectedProducts.length;
      selectedProducts = selectedProducts.filter((p) => cartVariantIds.includes(p.variantId));
      if (selectedProducts.length !== previousCount) {
        saveToStorage();
        updateUI();
        const tier = getCurrentTier();
        if (tier) await fetch('/discount/' + tier.code);

        //refresh slide cart
        if (window.CartDrawer && typeof window.CartDrawer.refreshDrawer === 'function') {
          window.CartDrawer.refreshDrawer();
        }
      }
    } catch (e) {
      console.warn('n-bundle-selection: syncWithCart failed', e);
    }
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      const removeBtn = e.target.closest('[data-bundle-remove]');
      if (removeBtn && removeBtn.dataset.variantId) {
        e.preventDefault();
        removeProductByVariantId(parseInt(removeBtn.dataset.variantId, 10));
        return;
      }

      const button = e.target.closest('[data-bundle-button]');
      if (button) {
        e.preventDefault();
        toggleProduct({
          buttonId: button.dataset.buttonId,
          variantId: parseInt(button.dataset.variantId, 10),
          handle: button.dataset.handle,
          title: button.dataset.title,
          price: parseFloat(button.dataset.price),
          image: button.dataset.image,
        });
        return;
      }

      const cta = e.target.closest('[data-bundle-cta], .skincare_plan_cta .btn_wrap .btn');
      if (cta) {
        e.preventDefault();
        addToCartWithDiscount();
      }
    });

    document.addEventListener('cart.requestComplete', function (e) {
      const source = e.detail && e.detail.source;
      if (source === 'changeCart' || source === 'syncCart' || source === 'updateCartMany') {
        syncWithCart();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.NBundleSelection = {
    getSelectedProducts: () => [...selectedProducts],
    getCurrentTier,
    clearSelection: () => {
      selectedProducts = [];
      saveToStorage();
      updateUI();
    },
  };
})();

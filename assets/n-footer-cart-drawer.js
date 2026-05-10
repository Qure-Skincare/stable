/* events */

document.addEventListener('DOMContentLoaded', () => {
    bindForms();
});

document.addEventListener('cart.requestComplete', (event) => {
    if(footer_cart_drawer_template == 'cart') {
        updateSection('cart', 'main-cart-dynamic-content')
        .then(() => {
            reloadDrawer(event);
        })
        .catch(console.error);
    }
    else {
        reloadDrawer(event);
    }
});



/*  render  */

const reloadDrawer = (array) => {
    const source = array.detail.source;

    updateSection('n-footer-cart-drawer', 'cart-dynamic-content').then(() => {
        if (source === 'addToCart' || source === 'addToCartJson') {
            showCart();
            //toogleGift();
        }

        getCartState().then(cart => {
            document.querySelector('.cart-count').textContent = cart.item_count;
        });

        bindForms();

        loadScriptOnce(`footer-cart-drawer-swiper.js?v=${Date.now()}`, 'https://qureskincaredns-stable.com/assets/js-new/swiper.js')
    })
    .catch(console.error);
}

const refreshDrawer = () => {
     updateSection('n-footer-cart-drawer', 'cart-dynamic-content').then(() => {
        loadScriptOnce(`footer-cart-drawer-swiper.js?v=${Date.now()}`, 'https://qureskincaredns-stable.com/assets/js-new/swiper.js')
     });
}

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

const updateSection = (section_id, targetElement) => {
    const currentDrawer = document.getElementById(targetElement);
    if (!currentDrawer) return;

    return fetch(location.pathname + '/?section_id=' + section_id)
            .then(res => res.text())
            .then(html => {
                const temp = document.createElement('div');
                temp.innerHTML = html;

                const newDrawer = temp.querySelector('#' + targetElement);
                if (!newDrawer) return;

                morphdom(currentDrawer, newDrawer);
                return;
            })    
            .then(result => {
                if (!result) return result;
                return new Promise(resolve => {
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            requestAnimationFrame(() => resolve(result));
                        }, 0);
                    });
                });
            });
};

const showCart = () => {
    if(footer_cart_drawer_template != 'cart') {
        const cartDrawer = document.querySelector('.offcanvas-end');
        if (cartDrawer && !cartDrawer.classList.contains('show')) {
            document.getElementById('cartCanvasBtn')?.click();
        }
    }
};



/*  default functions   */

const addToCart = (input) => {
    return fetch((window.Shopify?.routes?.root || '/') + 'cart/add.js', {
        method: 'POST',
        body: input
    })
    .then(response => response.json())
    .then(() => {
        toogleGift().then(() => {
            if (typeof footer_cart_drawer_discount !== 'undefined' && footer_cart_drawer_discount) {
                fetch('/discount/' + footer_cart_drawer_discount).then(async () => {
                    const event = new CustomEvent('cart.requestComplete', { detail: { source: 'addToCart' } });
                    document.dispatchEvent(event);
                });
            }
            else {
                const event = new CustomEvent('cart.requestComplete', { detail: { source: 'addToCart' } });
                document.dispatchEvent(event);
            }
        });
    })
    .catch((error) => {
        console.error('Error cart adding:', error);
    });
};

const addToCartJson = (input) => {
    return fetch((window.Shopify?.routes?.root || '/') + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: input })
    })
    .then(response => response.json())
    .then(() => {
        toogleGift().then(() => {
            if (typeof footer_cart_drawer_discount !== 'undefined' && footer_cart_drawer_discount) {
                fetch('/discount/' + footer_cart_drawer_discount).then(async () => {
                    const event = new CustomEvent('cart.requestComplete', { detail: { source: 'addToCartJson' } });
                    document.dispatchEvent(event);
                });
            }
            else {
                const event = new CustomEvent('cart.requestComplete', { detail: { source: 'addToCartJson' } });
                document.dispatchEvent(event);
            }
        })
    })
    .catch((error) => {
        console.error('Error cart adding:', error);
    });
};

const changeCart = (input) => {
    return fetch((window.Shopify?.routes?.root || '/') + 'cart/change.js', {
        method: 'POST',
        body: input
    })
    .then(response => response.json())
    .then(() => {
        toogleGift().then(() => {
            if (typeof syncCart === 'function') {
                syncCart(input).then(() => {
                    const event = new CustomEvent('cart.requestComplete', { detail: { source: 'syncCart' } });
                    document.dispatchEvent(event);
                });
            }
            else {
                const event = new CustomEvent('cart.requestComplete', { detail: { source: 'changeCart' } });
                document.dispatchEvent(event);
            }
        })
    })
    .catch((error) => {
        console.error('Error cart changing:', error);
    });
};

const clearCart = () => {
    fetch((window.Shopify?.routes?.root || '/') + 'cart/clear.js', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    })
    .then(response => response.json())
    .then(cart => {
        const event = new CustomEvent('cart.requestComplete', { detail: { source: 'clearCart' } });
        document.dispatchEvent(event);
    })
    .catch(error => {
        console.error('Error clearing cart:', error);
    });
}

const getCartState = () => {
    return fetch((window.Shopify?.routes?.root || '/') + 'cart.js')
            .then(response => response.json())
            .then(cart => {
                console.log('Cart state:', cart);
                return cart; 
            })
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

const toogleGift = async () => {
    const forms = document.querySelectorAll('form.footer-cart-drawer-gift[action$="/cart/add"]');

    if (forms.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
    };

    const gifts_adding = [];
    const gift_updating = {};

    const cart = await getCartState();

    for (const form of forms) {
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
        } else {
            if (cart.total_price < price_limit) {
                gift_updating[formData.get('id')] = 0;
            }
        }
    }

    if (gifts_adding.length > 0) {
        await addToCartMany(gifts_adding);
    }

    if (Object.keys(gift_updating).length > 0) {
        await updateCartMany(gift_updating);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
};

const updateCart = async (input) => {
    return fetch((window.Shopify?.routes?.root || '/') + 'cart/update.js', {
        method: 'POST',
        body: input
    })
    .then(response => {
        return response.json();
    })
    .catch((error) => {
        console.error('Error cart updating:', error);
        return null;
    });
};

const addToCartMany = (input) => {
    return fetch((window.Shopify?.routes?.root || '/') + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: input })
    })
    .then(response => response.json())
    .then(() => {
        const event = new CustomEvent('cart.requestComplete', { detail: { source: 'addToCartMany' } });
        document.dispatchEvent(event);
    })
    .catch((error) => {
        console.error('Error cart adding:', error);
    });
};

const updateCartMany = (updates) => {
    return fetch(window.Shopify.routes.root + 'cart/update.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updates })
      })
      .then(() => {
        const event = new CustomEvent('cart.requestComplete', { detail: { source: 'updateCartMany' } });
        document.dispatchEvent(event);
      })
      .catch((error) => {
        console.error('Error updating cart:', error);
      });
};

window.CartDrawer = {
    toogleGift,
    addToCartJson,
    getCartState,
    refreshDrawer
};

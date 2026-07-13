function money_without_trailing_zeros(amount, symbol) {
    const price = (Number(amount) / 100).toFixed(2);
    return symbol + price.replace(/\.?0+$/, "");
}

function get_discount(price, sum) {
    const discount = Math.floor((price / sum) * 100);
    return discount;
}

const replaceTextOnPage = (search, replacement) => {
  const regex = new RegExp(search, "g");
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

  let node;
  while ((node = walker.nextNode())) {
    if (regex.test(node.nodeValue)) {
      node.nodeValue = node.nodeValue.replace(regex, replacement);
    }
  }
};

/* init — consume the data the section exposed on window (never a lexical const
   from the inline liquid script: under the LCP proxy that script may run after
   this file and the binding would be undefined here). */

const shower = window.shower;
const faucet = window.faucet;
const button_text = window.button_text;
const button_text_subscribe = window.button_text_subscribe;

const syncCart = async (input) => {
    const cart = await getCartState();

    const is_exist = cart.items.some(item => item.key == input.get('id'));

    if(!is_exist) {
        const formData = new FormData();
        const variant = document.querySelector('.qure__variant-item input[type="radio"]:checked').id

        if(variant == 'white') {
            formData.append('updates[' + faucet.variants.White + ']', 0);
        }
        else {
            formData.append('updates[' + faucet.variants.Black + ']', 0);
        }

        await updateCart(formData);
    }
}


if (shower && faucet) {
    const sum = (shower.price_original || 0) + (faucet.price_original || 0);
    const symbol = shower.price.replace(/[0-9.,\s-]/g, "");
    const formattedSum = money_without_trailing_zeros(sum, symbol);

    document.querySelectorAll(".e-price__old").forEach((el) => {
        el.textContent = formattedSum;
    });

    const discount = get_discount(faucet.price_original, sum);

    window.discount = discount;

    replaceTextOnPage("\\$149", shower.price);
    replaceTextOnPage("\\$129", faucet.price);
    replaceTextOnPage("50%", discount + '%');
}

if (shower) {
    document.querySelectorAll(".e-price__current, .price__subscription").forEach((el) => {
        el.textContent = shower.sale_price || 0;
    });
}

if (shower) {
    document.querySelectorAll(".price_faucet__regular").forEach((el) => {
        el.textContent = faucet.sale_price || 0;
    });
}

document.querySelectorAll('.c-subscribe-selector__item').forEach(collapseEl => {
    collapseEl.addEventListener('click', function () {
        let isSubscribe = document.getElementById('subscribe').checked;
        const button = document.querySelector('.n-form-inside-button');
        button.textContent = isSubscribe ? button_text_subscribe + ' ' + window.discount + '%' : button_text;
    });
});

/* The add-to-cart submit handler now lives in a class="__init" script inside
   sections/n-form-inside.liquid, so the button is wired immediately at parse
   (not after the LCP window). This file only handles the (non-critical) price
   cosmetics and button-label toggle above; binding the submit here too would
   double-add on click. */
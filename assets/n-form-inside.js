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




/* init */

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

document.querySelector('.c-buy-block form').addEventListener('submit', function (e) {
    e.preventDefault();

    const isSubscribe = document.getElementById('subscribe').checked;
    const variant = document.querySelector('.qure__variant-item input[type="radio"]:checked').id;

    if(!variant)  return;

    let input;

    if(variant == 'white') {
        input = [
            { id: shower.variants.White, quantity: 1 },
            { id: faucet.variants.White, quantity: 1 }
        ]
    }
    else {
        input = [
            { id: shower.variants.Black, quantity: 1 },
            { id: faucet.variants.Black, quantity: 1 }
        ]
    }

    if (isSubscribe) {
        input[0].selling_plan = shower_selling_plan;
        input[1].selling_plan = faucet_selling_plan;

        addToCartJson(input);
    }
    else {
        __discount = 'FAUCET100';

        fetch('/discount/' + __discount).then(async () => {
            addToCartJson(input);
        });

    }
});
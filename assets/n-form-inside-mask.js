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


/* init */

if (mask && neck) {
    const sum = (mask.price_original || 0) + (neck.price_original || 0);
    const symbol = mask.price.replace(/[0-9.,\s-]/g, "");
    const formattedSum = money_without_trailing_zeros(sum, symbol);

    document.querySelectorAll(".e-price__full").forEach((el) => {
        el.textContent = formattedSum;
    });

    const discount = get_discount(neck.price_original, sum);

    document.querySelectorAll(".price__discount").forEach((el) => {
        el.textContent = discount + discount_text;
    });

    replaceTextOnPage("\\$399", mask.price);
    replaceTextOnPage("\\$299", neck.price);
}

document.querySelector('.c-buy-block form').addEventListener('submit', function (e) {
    e.preventDefault();

    __discount = 'FREEN&DOFFER';

    input = [
        { id: mask.variant_id, quantity: 1 },
        { id: neck.variant_id, quantity: 1 }
    ]

    fetch('/discount/' + __discount).then(async () => {
        addToCartJson(input);
    });
});
(function() {
    function customRound(value) {
        let integerPart = Math.floor(value);
        let firstDecimalDigit = Math.floor((value - integerPart) * 10);
        let remainingDecimals = (value - integerPart) * 10 - firstDecimalDigit;

        if (remainingDecimals >= 0.5) {
            return integerPart + (firstDecimalDigit + 1) / 10;
        } else {
            return integerPart + firstDecimalDigit / 10;
        }
    }

    let ratingElement = document.getElementById('rating');
    if (ratingElement) {
        ratingElement.textContent = customRound(product_rating);
    }
})(); 
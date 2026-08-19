if (!customElements.get('cart-notification')) {
  const TIMER_STORAGE_KEY = 'cart-reservation-timer-end';

  // A fresh timer starts on the next add once the cart has been emptied.
  document.addEventListener('cart.requestComplete', (event) => {
    const cart = event.detail && event.detail.cart;
    if (cart && cart.item_count === 0) {
      sessionStorage.removeItem(TIMER_STORAGE_KEY);
    }
  });

  class CartNotification extends HTMLElement {
    constructor() {
      super();

      this.cartCountDown = this.querySelector('.cart-countdown-time');
      if (!this.cartCountDown) return;

      this.countdownTimer();
    }

    // The deadline persists in sessionStorage, so a page reload resumes the
    // countdown instead of restarting it from the full duration.
    resolveCountdownEnd(countdownTime) {
      const stored = Number(sessionStorage.getItem(TIMER_STORAGE_KEY)) || 0;
      if (stored > Date.now()) {
        return stored;
      }

      const end = Date.now() + countdownTime * 60 * 1000;
      sessionStorage.setItem(TIMER_STORAGE_KEY, end);
      return end;
    }

    countdownTimer() {
      const countdownTime = Number(this.cartCountDown.dataset.countdownTime) || 5;
      const timeoutMessage = this.cartCountDown.dataset.timeoutMessage || 'Time is up!';
      const countdownEnd = this.resolveCountdownEnd(countdownTime);

      const tick = () => {
        const messageEl = this.cartCountDown.querySelector(".countdown-message");
        const minuteEl = this.cartCountDown.querySelector(".countdown-timer-minute");
        const secondEl = this.cartCountDown.querySelector(".countdown-timer-sec");

        if (!messageEl || !minuteEl || !secondEl) {
          clearInterval(interval);
          return;
        }

        const now = Date.now();

        if (now >= countdownEnd) {
          messageEl.textContent = timeoutMessage;
          clearInterval(interval);
        } else {
          const remaining = countdownEnd - now;
          const minutes = Math.floor((remaining % 3600000) / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);

          minuteEl.textContent = String(minutes).padStart(2, '0');
          secondEl.textContent = String(seconds).padStart(2, '0');
        }
      };

      const interval = setInterval(tick, 1000);
      tick();
    }
  }

  customElements.define('cart-notification', CartNotification);
}

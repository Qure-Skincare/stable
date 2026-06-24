if (!customElements.get('cart-notification')) {
  class CartNotification extends HTMLElement {
    constructor() {
      super();

      this.cartCountDown = this.querySelector('.cart-countdown-time');
      if (!this.cartCountDown) return;

      this.startTime = Date.now();
      this.countdownTimer();
    }

    countdownTimer() {
      const countdownTime = Number(this.cartCountDown.dataset.countdownTime) || 5;
      const timeoutMessage = this.cartCountDown.dataset.timeoutMessage || 'Time is up!';
      const countdownEnd = this.startTime + countdownTime * 60 * 1000;

      const interval = setInterval(() => {
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
      }, 1000);
    }
  }

  customElements.define('cart-notification', CartNotification);
}
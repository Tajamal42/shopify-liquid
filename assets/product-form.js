if (!customElements.get('product-form')) {
  customElements.define('product-form', class ProductForm extends HTMLElement {
    constructor() {
      super();

      this.form = this.querySelector('form');
      this.form.querySelector('[name=id]').disabled = false;
      this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
      this.cartNotification = document.querySelector('cart-notification');
      this.helpBar = document.querySelector('help-bar');
      this.giftWithPurchase = document.querySelector('gift-with-purchase');
      this.missingItems = document.querySelector('missing-items');
    }

    onSubmitHandler(evt) {
      evt.preventDefault();
      const submitButton = this.querySelector('[type="submit"]');
      if (submitButton.classList.contains('loading')) return;

      this.handleErrorMessage();
      this.cartNotification.setActiveElement(document.activeElement);

      submitButton.setAttribute('aria-disabled', true);
      submitButton.classList.add('loading');
      this.querySelector('.loading-overlay__spinner').classList.remove('hidden');

      const config = fetchConfig('javascript');
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      delete config.headers['Content-Type'];

      const formData = new FormData(this.form);
      formData.append('sections', this.cartNotification.getSectionsToRender().map((section) => section.id));
      formData.append('sections_url', window.location.pathname);

      config.body = formData;

      fetch(`${routes.cart_add_url}`, config)
        .then(response => response.json())
        .then(response => {
          if (response.status) {
            this.handleErrorMessage(response.description);
            return;
          }

          this.cartNotification.renderContents(response);
          this.trackAddToCartEvent(response, formData);
          if (this.giftWithPurchase) this.giftWithPurchase.checkCart();
          if (this.missingItems) this.missingItems.checkCart();
        })
        .catch(e => {
          console.error(e);
        })
        .finally(() => {
          submitButton.classList.remove('loading');
          submitButton.removeAttribute('aria-disabled');
          this.querySelector('.loading-overlay__spinner').classList.add('hidden');
        });
    }
    
    trackAddToCartEvent(response, formData) {
      if (typeof window.fbq === 'undefined' && typeof window.ttq === 'undefined' && typeof window.pintrk === 'undefined') return;

      const customer_email = this.form.dataset.customer;
      const store_country = this.form.dataset.storeCountry;
      const currency = Shopify.currency.active;
      const quantity = !formData.get('quantity') ? 1 : parseInt(formData.get('quantity'));

      const { final_price, id, variant_id, product_type, sku, title, product_title, variant_title, vendor } = response;
      const product_id = `shopify_${ store_country }_${ id }_${ variant_id }`;
      const product_category = product_type.split(' - ').pop();

      const priceFormat = new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        currency: currency,
        useGrouping: false
      });
      
      const product_price = parseFloat(priceFormat.format(final_price / 100));
      const value = parseFloat(priceFormat.format((final_price * quantity) / 100));

      if (typeof window.fbq !== 'undefined') {
        fbq('track', 'AddToCart', {
          content_ids: [ sku ],
          content_type: 'product',
          content_name: title,
          contents: [ { 'id': sku, 'quantity': quantity } ],
          value: value,
          currency: currency
        });
      }

      if (typeof window.ttq !== 'undefined') {
        ttq.track('AddToCart', {
          content_id: product_id,
          content_type: 'product',
          content_name: title,
          content_category: product_category,
          quantity: quantity,
          price: product_price,
          value: value,
          currency: currency
        });
      }

      if (typeof window.pintrk !== 'undefined') {
        pintrk('track', 'addtocart', {
          user_email: customer_email,
          currency: currency,
          value: value,
          order_quantity: quantity,
          line_items: [
            {
              product_name: product_title,
              product_id: product_id,
              product_price: product_price,
              product_category: product_category,     
              product_brand: vendor,
              product_variant: variant_title,
              product_variant_id: sku,
              product_quantity: quantity
            }
          ]
        });
      }

      if (typeof window.uetq !== 'undefined') {
        window.uetq = window.uetq || [];
        window.uetq.push('event', 'add_to_cart', {
          ecomm_prodid: [ product_id ],
          ecomm_pagetype: 'product',
          ecomm_totalvalue: value,
          revenue_value: value,
          currency: currency,
          items: [
            {
              id: product_id,
              quantity: quantity,
              price: product_price
            }
          ]
        });
      }
    }

    handleErrorMessage(errorMessage = false) {
      this.errorMessageWrapper = this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
      this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

      this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

      if (errorMessage) {
        this.errorMessage.textContent = errorMessage;
      }
    }
  });
}

(function($) {
  if (typeof window.fbq === 'undefined') return;

  function getCustomer() {
    const data = document.querySelector('[data-customer-info]');
    if (!data) return;
    
    return JSON.parse(data.innerHTML);
  }

  async function getCart() {
    return await fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        if (cart.status) {
          this.handleErrorMessage(cart.description);
          return;
        }
        return cart;
      })
      .catch(e => {
        console.error(e);
      });
  }

  function trackInitiateCheckoutEvent(cart) {
    const { currency, total_price, items, items_subtotal_price } = cart;
    const content_ids = [];
    const contents = [];

    const priceFormat = new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      currency: currency,
      useGrouping: false
    });

    const value = parseFloat(priceFormat.format((items_subtotal_price) / 100));

    let num_items = 0;
    
    items.forEach(item => {
      content_ids.push(item.sku);
      contents.push({ id: item.sku, quantity: item.quantity });
      num_items += item.quantity;
    });

    if (typeof window.fbq !== 'undefined') {
      fbq('track', 'InitiateCheckout', {
        content_category: 'Checkout',
        content_ids,
        contents,
        currency,
        num_items,
        value
      });
    }
  }  

  $(document).on("page:load", function() {
    let token = sessionStorage.getItem('checkoutToken');
    if (token === Shopify.Checkout.token) return;
    sessionStorage.setItem('checkoutToken', Shopify.Checkout.token);

    getCart().then(cart => {
      trackInitiateCheckoutEvent(cart);
    });
  });
})(Checkout.$);
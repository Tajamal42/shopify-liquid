class MissingItems extends HTMLElement {
  constructor() {
    super();
    
    this.form = this.querySelector('form');
    if (!this.form) return;

    this.miaTagPrefix = this.dataset.miaTagPrefix;
    this.miaProduct = parseInt(this.dataset.miaProduct)
    this.miaVariant = parseInt(this.dataset.miaVariant);
    this.miaQuantity = parseInt(this.dataset.miaQuantity);
    this.miaIsAvailable = this.hasAttribute('data-mia-is-available');
    this.miaIsExclusive = this.hasAttribute('data-mia-is-exclusive');

    this.miaOfferSection = document.querySelector('.missing-items');

    this.cartItems = document.querySelector('cart-items');
    if (!this.cartItems) return;

    this.checkCart();
  }

  hasMiaItem(cart_items, mia_variant_id) {
    return cart_items.find(line_item => line_item.id == mia_variant_id) ? true : false;
  }

  hasValidItems(cart_items, mia_variant_id) {
    const other_items = cart_items.filter(line_item => line_item.id !== mia_variant_id);
    if (other_items.length === 0) return false;

    return other_items.every(line_item =>
      line_item.final_line_price !== 0
      || !line_item.product_type.toLowerCase().trim().includes('donation')
    )
  }

  getMiaItem(cart_items, mia_variant_id) {
    return cart_items.find(line_item => line_item.id == mia_variant_id && line_item.final_line_price === 0);
  }

  getMiaItemIndex(cart_items, mia_variant_id) {
    if (!this.hasMiaItem(cart_items, mia_variant_id)) return null;
    return cart_items.findIndex(line_item => line_item.id == mia_variant_id && line_item.final_line_price === 0) + 1;
  }

  getOtherItems(cart_items, mia_variant_id) {
    return cart_items.filter(line_item => {
      if (line_item.id === mia_variant_id) return;
      if (line_item.final_line_price === 0) return;
      if (line_item.product_type.toLowerCase().trim().includes('donation')) return;
      return line_item;
    });
  } 
 
  checkCart() {
    if (!this.form) return;

    if (!this.miaIsAvailable) {
      console.warn('MIA CAMPAIGN: The gift is not available - item is not in stock and inventory management is set to "deny". Aborting.');
      this.updateSection('hide');
      return;
    }

    console.info('MIA CAMPAIGN: Checking cart...');

    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        if (cart.status) {
          this.handleErrorMessage(cart.description);
          return;
        }

        const miaItem = this.getMiaItem(cart.items, this.miaVariant);
        const hasMiaItem = this.hasMiaItem(cart.items, this.miaVariant);
        const hasValidItems = this.hasValidItems(cart.items, this.miaVariant);
        const hasValidCart = cart.total_price > 0;

        const fulfillsRequirements = hasValidItems && hasValidCart;

        if (!hasMiaItem) {
          if (fulfillsRequirements) {
            console.info('MIA CAMPAIGN: Requirements met. The MIA product will be added to cart!');
            this.addMiaToCart();
            this.updateSection('hide');

          } else {
            console.info('MIA CAMPAIGN: Requirements not met yet.', { hasValidItems, hasValidCart });
            this.updateSection('show');
          }
          return;
        }

        if (hasMiaItem) {
          if (fulfillsRequirements) {
            if (this.miaIsExclusive && miaItem.quantity !== this.miaQuantity) {
              console.warn('MIA CAMPAIGN: miaIsExclusive - MIA quantity is different than the offer. The MIA quantity will be updated!', { hasMiaItem, hasValidItems });

              const miaItemIndex = this.getMiaItemIndex(cart.items, this.miaVariant);
              this.cartItems ? this.cartItems.updateQuantity(miaItemIndex, this.miaQuantity) : this.updateQuantity(miaItemIndex, this.miaQuantity);

            } else {
              console.info('MIA CAMPAIGN:MIA product found in cart and requirements met! Discounts should be applied.');
            }

            this.updateSection('hide');
            return;

          } else {
            if (this.miaIsExclusive) {
              console.warn('GIFT WITH PURCHASE: miaIsExclusive - MIA product cannot be purchased if requirements are not met. The gift will be removed from cart.', { hasValidItems, hasValidCart });

              const miaItemIndex = this.getMiaItemIndex(cart.items, this.miaVariant);
              this.cartItems ? this.cartItems.updateQuantity(miaItemIndex, 0) : this.updateQuantity(miaItemIndex, 0);
              this.updateSection('show');

            } else {
              console.info('MIA CAMPAIGN:MIA product found in cart, but requirements are not met - discounts will not be applied.', { hasValidItems, hasValidCart });
              this.updateSection('show');
            }
            return;
          }          
        }
      })
      .catch(e => {
        console.error(e);
      });
  }

  updateSection(action) {
    if (!this.miaOfferSection) return;
    if (action === 'hide') this.miaOfferSection.classList.add('mia-offer--in-cart');
    if (action === 'show') this.miaOfferSection.classList.remove('mia-offer--in-cart');
  }

  updateQuantity(line, quantity) {
    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getCartIconBubbleSectionToRender().map((section) => section.section),
      sections_url: window.location.pathname
    });

    fetch(`${routes.cart_change_url}`, {...fetchConfig(), ...{ body }})
      .then(response => {
        return response.text();
      })
      .then(state => {
        const parsedState = JSON.parse(state);
        this.updateCartIconBubble(parsedState);
      })
      .catch(e => {
        console.error(e);
      });
  }

  addMiaToCart() {
    if (!this.form) return;
    if (!this.miaIsAvailable) return;

    const config = fetchConfig('javascript');
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    delete config.headers['Content-Type'];

    const formData = new FormData(this.form);
    config.body = formData;

    if (this.cartItems) {
      formData.append('sections', this.cartItems.getSectionsToRender().map((section) => section.id));
      formData.append('sections_url', window.location.pathname);
    } else {
      formData.append('sections', this.getCartIconBubbleSectionToRender().map((section) => section.id));
      formData.append('sections_url', window.location.pathname);
    }

    fetch(`${routes.cart_add_url}`, config)
      .then(response => {
        return response.text();
      })
      .then(state => {
        const parsedState = JSON.parse(state);

        if (!this.cartItems) {
          this.updateCartIconBubble(parsedState);
          return;
        }

        this.cartItems.getSectionsToRender().forEach((section => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);

          elementToReplace.innerHTML =
            this.cartItems.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
        }));

        this.cartItems.disableLoading();
      })
      .catch(e => {
        console.error(e);

        if (!this.cartItems) return;
        this.cartItems.querySelectorAll('.loading-overlay').forEach((overlay) => overlay.classList.add('hidden'));
        document.getElementById('cart-errors').textContent = window.cartStrings.error;
        this.cartItems.disableLoading();
      });
  }

  updateCartIconBubble(parsedState) {
    const elementToReplace = document.getElementById('cart-icon-bubble');
    const newHTML = new DOMParser().parseFromString(parsedState.sections['cart-icon-bubble'], 'text/html').querySelector('.shopify-section').innerHTML;
    elementToReplace.innerHTML = newHTML;
  }

  getCartIconBubbleSectionToRender() {
    return [
      {
        id: 'cart-icon-bubble'
      }
    ];
  }
}

customElements.define('missing-items', MissingItems);

class GiftWithPurchase extends HTMLElement {
  constructor() {
    super();
    
    this.form = this.querySelector('form');
    if (!this.form) return;

    this.minSpend = parseInt(this.dataset.minSpend);
    this.requiredVariants = this.hasAttribute('data-required-variants') ? this.dataset.requiredVariants.split(',').map(Number) : null;
    this.requiredQuantity = this.hasAttribute('data-required-quantity') ? parseInt(this.dataset.requiredQuantity) : null;

    this.giftVariant = parseInt(this.dataset.giftVariant);
    this.giftQuantity = parseInt(this.dataset.giftQuantity);
    this.giftIsBogo = this.hasAttribute('data-gift-is-bogo');
    this.giftIsAvailable = this.hasAttribute('data-gift-is-available');
    this.giftIsExclusive = this.hasAttribute('data-gift-is-exclusive');
    this.giftWasClaimed = this.hasAttribute('data-gift-was-claimed');

    this.gwpOfferSection = document.querySelector('.gift-with-purchase');

    this.cartItems = document.querySelector('cart-items');
    if (!this.cartItems) return;

    this.checkCart();
  }

  validateMinSpend(cart, min_spend = 0, extraGiftItems = null) {
    if (!extraGiftItems) return cart.items_subtotal_price >= min_spend;

    let extra_price = extraGiftItems.reduce((prevTotal, item) => prevTotal + item.original_price, 0) || 0;
    return cart.items_subtotal_price >= min_spend + extra_price;
  }

  validateRequiredItem(cart_items, required_variant_ids) {
    if (this.requiredVariants === null) return true;
    return cart_items.some(line_item => required_variant_ids.includes(line_item.variant_id));
  }

  validateRequiredQuantity(required_items, required_quantity) {
    if (this.requiredVariants === null) return true;

    let total_quantity = required_items.reduce((prevQty, line_item) => prevQty + line_item.quantity, 0);
    return total_quantity >= required_quantity ? true : false;
  }

  validateGiftItem(cart_items, gift_variant_id) {
    return cart_items.find(line_item => line_item.id == gift_variant_id) ? true : false;
  }

  getGiftItem(cart_items, gift_variant_id) {
    return cart_items.find(line_item => line_item.id == gift_variant_id && line_item.final_line_price === 0);
  }

  getExtraGiftItems(cart_items, gift_variant_id) {
    return cart_items.filter(line_item => line_item.id == gift_variant_id && line_item.final_line_price !== 0);
  }

  getGiftItemIndex(cart_items, gift_variant_id) {
    if (!this.validateGiftItem(cart_items, gift_variant_id)) return null;
    return cart_items.findIndex(line_item => line_item.id == gift_variant_id && line_item.final_line_price === 0) + 1;
  }

  getRequiredItems(cart_items, required_variant_ids) {
    if (this.requiredVariants === null) return null;
    return cart_items.filter(line_item => required_variant_ids.includes(line_item.variant_id));
  }

  getRequiredItemsQuantity(required_items) {
    if (this.requiredVariants === null) return true;

    let total_quantity = required_items.reduce((prevQty, line_item) => prevQty + line_item.quantity, 0);
    return total_quantity;
  }

  updateMinBogoQuantity(cart_items, required_items, gift_item, gift_is_exclusive) {
    if (!this.giftIsBogo) return;
    if (!required_items || !gift_item) return;
    
    const giftBogoQuantity = this.getRequiredItemsQuantity(required_items);
    const giftItemIndex = this.getGiftItemIndex(cart_items, this.giftVariant);

    if (gift_item.quantity >= giftBogoQuantity) return;
    this.cartItems ? this.cartItems.updateQuantity(giftItemIndex, giftBogoQuantity) : this.updateQuantity(giftItemIndex, giftBogoQuantity);
  }
 
  checkCart() {
    if (!this.form) return;

    if (!this.giftIsAvailable) {
      console.warn('GWP CAMPAIGN: The gift is not available - item is not in stock and inventory management is set to "deny". Aborting.');
      this.updateGWPOfferSection('hide');
      return;
    }

    console.info('GWP CAMPAIGN: Checking cart...');

    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        if (cart.status) {
          this.handleErrorMessage(cart.description);
          return;
        }

        const hasGift = this.validateGiftItem(cart.items, this.giftVariant);
        const hasRequired = this.validateRequiredItem(cart.items, this.requiredVariants);
        const giftItem = this.getGiftItem(cart.items, this.giftVariant);
        const extraGiftItems = this.getExtraGiftItems(cart.items, this.giftVariant);
        const hasMinSpend = this.validateMinSpend(cart, this.minSpend, extraGiftItems);
        const requiredItems = this.getRequiredItems(cart.items, this.requiredVariants);
        const hasRequiredQuantity = this.validateRequiredQuantity(requiredItems, this.requiredQuantity);

        const fulfillsRequirements = hasRequired && hasRequiredQuantity && hasMinSpend;

        if (!hasGift) {
          if (this.giftWasClaimed && this.giftIsExclusive) {
            console.warn('GWP CAMPAIGN: giftWasClaimed, giftIsExclusive - The offer can only be claimed once per customer (was claimed in a previous order) - GWP product will not be automatically added to cart.');
      
            this.updateGWPOfferSection('hide');
            return;
          }
          
          if (fulfillsRequirements) {
            console.info('GWP CAMPAIGN: Requirements met. The GWP product will be added to cart!');
            this.addGiftToCart();

            if (this.giftIsBogo && requiredItems.length > 0) {
              console.info('GWP CAMPAIGN: giftIsBogo - If the cart has fewer gifts than required buy products quantity, the GWP product quantity will be adjusted to match the minimum.');
              this.updateMinBogoQuantity(cart.items, requiredItems, giftItem, this.giftIsExclusive);
            }

            this.updateGWPOfferSection('hide');
          } else {
            console.info('GWP CAMPAIGN: Requirements not met yet.', { hasRequired, hasRequiredQuantity, hasMinSpend });
            this.updateGWPOfferSection('show');
          }
          return;
        }

        if (hasGift) {
          if (fulfillsRequirements) {
            if (this.giftWasClaimed && this.giftIsExclusive) {
              console.warn('GWP CAMPAIGN: giftWasClaimed, giftIsExclusive - The offer can only be claimed once per customer (was claimed in a previous order) - GWP product will be removed from cart.');
        
              this.cartItems ? this.cartItems.updateQuantity(giftItemIndex, 0) : this.updateQuantity(giftItemIndex, 0);
              this.updateGWPOfferSection('hide');
              return;
            }

            if (!this.giftIsBogo && this.giftIsExclusive && giftItem.quantity !== this.giftQuantity) {
              console.warn('GWP CAMPAIGN: giftIsExclusive - GWP quantity is different than the offer. The gift quantity will be updated!', { hasRequired, hasRequiredQuantity, hasMinSpend });

              const giftItemIndex = this.getGiftItemIndex(cart.items, this.giftVariant);
              this.cartItems ? this.cartItems.updateQuantity(giftItemIndex, this.giftQuantity) : this.updateQuantity(giftItemIndex, this.giftQuantity);

            } else {
              console.info('GWP CAMPAIGN: GWP product found in cart and requirements met! Discounts should be applied.');
            }

            if (this.giftIsBogo && requiredItems.length > 0) {
              console.info('GWP CAMPAIGN: giftIsBogo - If the cart has fewer GWP products than required buy products quantity, the GWP quantity will be adjusted to match the minimum.');
              this.updateMinBogoQuantity(cart.items, requiredItems, giftItem, this.giftIsExclusive);
            }

            this.updateGWPOfferSection('hide');
            return;
          } else {
            if (this.giftIsExclusive) {
              console.warn('GWP CAMPAIGN: giftIsExclusive - GWP product cannot be purchased if requirements are not met. The product will be removed from cart.', { hasRequired, hasRequiredQuantity, hasMinSpend });

              const giftItemIndex = this.getGiftItemIndex(cart.items, this.giftVariant);
              this.cartItems ? this.cartItems.updateQuantity(giftItemIndex, 0) : this.updateQuantity(giftItemIndex, 0);
              this.updateGWPOfferSection('show');
            } else {
              console.info('GWP CAMPAIGN: Gift product found in cart, but requirements are not met - discounts will not be applied.', { hasRequired, hasRequiredQuantity, hasMinSpend });
              this.updateGWPOfferSection('show');
            }
            return;
          }          
        }
      })
      .catch(e => {
        console.error(e);
      });
  }

  updateGWPOfferSection(action) {
    if (!this.gwpOfferSection) return;
    if (action === 'hide') this.gwpOfferSection.classList.add('gwp-offer--in-cart');
    if (action === 'show') this.gwpOfferSection.classList.remove('gwp-offer--in-cart');
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

  addGiftToCart() {
    if (!this.form) return;
    if (!this.giftIsAvailable) return;

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

customElements.define('gift-with-purchase', GiftWithPurchase);

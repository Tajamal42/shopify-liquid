class HelpBar extends HTMLElement {
  constructor() {
    super();
    
    this.chatBtn = this.querySelector('[data-button="chat"]');
    this.rewardsBtn = this.querySelector('[data-button="rewards"]');
    this.freeShipping = this.querySelector('[data-free-shipping-helper]');

    this.CLASS_LOADING = 'loading';
    this.CLASS_ONLINE = 'is-online';
    this.CLASS_OFFLINE = 'is-offline';
    
    this.CLASS_CHAT_IS_OPEN = 'chat-is-open';
    this.CLASS_REWARDS_IS_OPEN = 'rewards-is-open';

    if (this.freeShipping) this.initFreeShipping();
    if (this.chatBtn) this.initGorgias();
    if (this.rewardsBtn) this.initSmile();
  }

  initGorgias() {
    if (!window.GorgiasChat) return;
    this.chatBtn.classList.add(this.CLASS_LOADING);

    GorgiasChat.init()
      .then(GorgiasChat => {
        GorgiasChat.hidePoweredBy(true);
        GorgiasChat.hideOutsideBusinessHours(true);
        GorgiasChat.setPosition({ alignment: 'bottom-right', offsetX: 0, offsetY: -10 });

        return GorgiasChat;
      })
      .then(GorgiasChat => {
        this.chatBtn.addEventListener('click', this.toggleChat.bind(this));

        this.updateChatCampaigns();
        this.updateChatButton(GorgiasChat);

        return GorgiasChat;
      })
      .then(GorgiasChat => {
        this.getCart().then(cart => GorgiasChat.captureShopifyCart(cart));
      })
      .catch(err => {
        console.log(err);
      });
  }

  initFreeShipping() {
    if (this.freeShipping.classList.contains('free-shipping--not-available')) return;
    
    if (!this.freeShipping.dataset.allowedCountries) {
      this.freeShipping.classList.add('is-ready');
      this.freeShipping.classList.add('free-shipping--not-available');
      return;
    }

    const allowed_countries = this.freeShipping.dataset.allowedCountries.split(',');
    if (!allowed_countries) {
      this.freeShipping.classList.add('is-ready');
      this.freeShipping.classList.add('free-shipping--not-available');
      return;
    }

    const customer_country = this.freeShipping.dataset.customerCountry;
    if (customer_country && !allowed_countries.includes(customer_country)) {
      this.freeShipping.classList.add('is-ready');
      this.freeShipping.classList.add('free-shipping--not-available');
      return;
    }

    if (Shopify.designMode) {
      console.log('Design Mode On');
      this.freeShipping.classList.add('is-ready');
      this.freeShipping.classList.add('free-shipping--available');
    } else {
      const getGeolocation = new Promise((resolve, reject) => {
        if (localStorage.getItem('geoloc')) {
          resolve(JSON.parse(localStorage.getItem('geoloc')));
          return;
        }
        
        fetch('//api.ipbase.com/v2/info/', { headers: { 'apikey': '425e73a0-4cc3-11ec-8013-3f58ddbf2fe5' }})
          .then(response => response.json())
          .then(responseJson => {
            localStorage.setItem('geoloc', JSON.stringify(responseJson.data));
            resolve(responseJson.data);
            return;
          });
      });

      getGeolocation.then(result => {
        this.freeShipping.classList.add('is-ready');

        if (!allowed_countries.includes(result.location.country.alpha2)) {
          this.freeShipping.classList.add('free-shipping--not-available');
          return;
        };

        this.freeShipping.classList.add('free-shipping--available');
      });
    }
  }

  async getGeolocationData() {
    return await fetch('//api.ipbase.com/v2/info/', { headers: { 'apikey': '425e73a0-4cc3-11ec-8013-3f58ddbf2fe5' }})
      .then(response => response.json())
      .then(responseJson => {
        localStorage.setItem('geoloc', JSON.stringify(responseJson.data));
        return responseJson.data;
      });
  }

  closeRewards() {
    SmileUI.closePanel();
    document.body.classList.remove(this.CLASS_REWARDS_IS_OPEN);
  }

  openRewards() {
    if (this.chatBtn && GorgiasChat.isOpen()) this.closeChat();
    SmileUI.openPanel();
    document.body.classList.add(this.CLASS_REWARDS_IS_OPEN);
  }

  toggleRewards(event) {
    event.preventDefault();
    if (this.rewardsBtn.classList.contains(this.CLASS_LOADING)) return;
    document.body.classList.contains(this.CLASS_REWARDS_IS_OPEN) ? this.closeRewards() : this.openRewards();
  }

  initSmile() {
    this.rewardsBtn.classList.add(this.CLASS_LOADING);

    document.addEventListener('smile-ui-loaded', () => {
      Smile.ready()
        .then(smileInstance => {
          this.rewardsBtn.classList.remove(this.CLASS_LOADING);
          this.rewardsBtn.addEventListener('click', this.toggleRewards.bind(this));
        })
        .catch(err => {
          this.rewardsBtn.classList.add(this.CLASS_OFFLINE);
          console.log(err);
        });
    });
  }

  setCookie(cookieName, cookieValue, expDays) {
    let date = new Date();
    date.setTime(date.getTime() + (expDays * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = cookieName + "=" + cookieValue + "; " + expires + "; path=/";
  }

  getCookie(cookieName) {
    const name = cookieName + "=";
    const cookieDecoded = decodeURIComponent(document.cookie);
    const cookieArray = cookieDecoded .split('; ');
    let result;
    cookieArray.forEach(value => {
      if (value.indexOf(name) === 0) result = value.substring(name.length);
    })
    return result;
  }

  async getCart() {
    const response = await fetch('/cart.json', { method: 'GET' });
    return response.json();
  }

  updateChatCampaigns() {
    if (this.getCookie('hideChatCampaigns') == 'true') {
      document.body.classList.add('hide-chat-campaigns');
    }
  }

  updateChatButton(GorgiasChat) {
    if (!GorgiasChat || !this.chatBtn) return;
    this.chatBtn.classList.remove(this.CLASS_LOADING);

    const btnLabel = this.chatBtn.querySelector('.help-bar__button-label');

    if (!GorgiasChat.isBusinessHours()) {
      this.chatBtn.classList.add(this.CLASS_OFFLINE);
      btnLabel.textContent = this.chatBtn.dataset.chatOfflineLabel;
      return;
    }

    this.chatBtn.classList.add(this.CLASS_ONLINE);
    btnLabel.textContent = this.chatBtn.dataset.chatOnlineLabel;
  }

  openChat() {
    if (this.rewardsBtn && document.body.classList.contains(this.CLASS_REWARDS_IS_OPEN)) this.closeRewards();
    GorgiasChat.open();
    this.updateChatCampaigns();
    document.body.classList.add(this.CLASS_CHAT_IS_OPEN);
  }

  closeChat() {
    document.body.classList.remove(this.CLASS_CHAT_IS_OPEN);
    GorgiasChat.close();
  }

  toggleChat(event) {
    event.preventDefault();
    if (!GorgiasChat || !this.chatBtn) return;
    if (this.chatBtn.classList.contains(this.CLASS_LOADING)) return;

    const chatCampaigns = document.querySelector('#chat-campaigns');
    if (chatCampaigns && !this.getCookie('hideChatCampaigns')) {
      this.closeChat();
      this.setCookie('hideChatCampaigns', 'true', 0.15);
    }

    GorgiasChat.isOpen() ? this.closeChat() : this.openChat();
  }
}

customElements.define('help-bar', HelpBar);

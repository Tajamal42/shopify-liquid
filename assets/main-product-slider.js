class MainProductSlider extends HTMLElement {
  constructor() {
    super();
    this.slider = this.querySelector('ul');
    this.sliderProduct = this.dataset.productHandle;
    this.sliderItems = this.querySelectorAll('.slider__slide');
    this.sliderVideos = this.querySelectorAll('video');
    this.pageCount = this.querySelector('.slider-counter--current');
    this.pageTotal = this.querySelector('.slider-counter--total');
    this.prevButton = this.querySelector('button[name="previous"]');
    this.nextButton = this.querySelector('button[name="next"]');

    this.variantSelector = document.querySelector('variant-radios') || document.querySelector('variant-selects');
    if (this.variantSelector) this.variantSelector.addEventListener('change', event => this.updateVariantImages(event.target.name, event.target.value));
    
    if (!this.slider || !this.nextButton) return;

    const resizeObserver = new ResizeObserver(entries => this.initPages());
    resizeObserver.observe(this.slider);

    this.slider.addEventListener('scroll', this.update.bind(this));
    this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
    this.nextButton.addEventListener('click', this.onButtonClick.bind(this));
  }

  initPages() {
    const sliderItemsToShow = Array.from(this.sliderItems).filter(element => element.clientWidth > 0);
    this.sliderLastItem = sliderItemsToShow[sliderItemsToShow.length - 1];
    if (sliderItemsToShow.length === 0) return;
    this.slidesPerPage = Math.floor(this.slider.clientWidth / sliderItemsToShow[0].clientWidth);
    this.totalPages = sliderItemsToShow.length - this.slidesPerPage + 1;
    this.update();
  }

  update() {
    if (!this.pageCount || !this.pageTotal) return;
    // this.currentPage = Math.round(this.slider.scrollLeft / this.sliderItems[0].clientWidth) + 1;
    this.currentPage = Math.round(this.slider.scrollLeft / this.sliderLastItem.clientWidth) + 1;

    if (this.currentPage === 1) {
      this.prevButton.setAttribute('disabled', true);
    } else {
      this.prevButton.removeAttribute('disabled');
    }

    if (this.currentPage === this.totalPages) {
      this.nextButton.setAttribute('disabled', true);
    } else {
      this.nextButton.removeAttribute('disabled');
    }

    if (this.pageCount) this.pageCount.textContent = this.currentPage;
    if (this.pageTotal) this.pageTotal.textContent = this.totalPages;

    if (!this.sliderVideos) return;
    if (this.slider.scrollLeft > Math.round(((this.currentPage - 1) * this.sliderItems[0].clientWidth)) + 100) this.pauseSliderMedia();
  }

  pauseSliderMedia() {
    this.slider.querySelectorAll('.js-youtube').forEach((video) => {
      video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
    });
    this.slider.querySelectorAll('.js-vimeo').forEach((video) => {
      video.contentWindow.postMessage('{"method":"pause"}', '*');
    });
    this.slider.querySelectorAll('video').forEach((video) => video.pause());
    this.slider.querySelectorAll('product-model').forEach((model) => model.modelViewerUI?.pause());
  }

  onButtonClick(event) {
    event.preventDefault();
    // const slideScrollPosition = event.currentTarget.name === 'next' ? this.slider.scrollLeft + this.sliderItems[0].clientWidth : this.slider.scrollLeft - this.sliderItems[0].clientWidth;
    const slideScrollPosition = event.currentTarget.name === 'next' ? this.slider.scrollLeft + this.sliderLastItem.clientWidth : this.slider.scrollLeft - this.sliderLastItem.clientWidth;
    this.slider.scrollTo({
      left: slideScrollPosition
    });
  }

  async updateVariantImages(optionName, optionValue) {
    if (!optionName || !optionValue) return;
    
    const productData = await this.fetchProductData(`/products/${this.sliderProduct}?view=media-json`);

    const option = {
      name: encodeURIComponent(optionName).replaceAll('%20','-').toLowerCase(),
      value: encodeURIComponent(optionValue).replaceAll('%20','-').toLowerCase()
    }

    const filter = `__${option.name}-${option.value}`;
    const filtered = productData.images.filter(image => image.src.includes(filter));

    if (filtered.length === 0) return;
    
    const promises = [];

    filtered.forEach((imageObject, index) => {
      promises.push(new Promise(resolve => {
        resolve(this.fetchMedia(imageObject, index + 1));
      }));
    });

    Promise.all(promises).then(values => {
      // console.log(`3 - Populating the list...`);
      
      const imageObjects = values;
      const listItems = this.querySelectorAll('li');
      
      imageObjects.forEach((imageObject, index) => {
        if (!imageObject) return;

        const imageElement = listItems[index].querySelector('.product__media img');
        const modalButton = listItems[index].querySelector('modal-opener button');

        imageElement.src = imageObject.url;
        imageElement.alt = imageObject.alt;
        imageElement.srcset = imageObject.srcset ? imageObject.srcset : '';

        modalButton.dataset.mediaId = imageObject.id;
      });
    })
    .catch(error => console.log(error));
    // .finally(() => {
    //   console.log('... Done!');
    // });
  }

  async fetchMedia(imageObject, index) {
    if (!imageObject) return;
    // console.log(`2.${index} - Getting variant image...`);

    return fetch(imageObject.src)
      .then(response => {
        if(!response.ok) {
          throw new Error(`HTTP error status: ${response.status}!`);
        } else {
          let newSrcset = this.buildSrcset(imageObject.srcset);
          
          const newImageObject = {
            url: response.url,
            alt: imageObject.alt,
            id: imageObject.id,
            srcset: newSrcset
          }

          return newImageObject;
        }
      })
      .catch(error => {
        console.log(`There has been a problem with your fetch operations for resource "${imageObject.src}": ${error.message}`);
      });
      // .finally(() => {
      //   console.log(`... Image ${index} is ready!`);
      // });
  }

  async fetchProductData(url) {
    if (!url) return;
    // console.log('1 - Getting product json data...');
    
    return fetch(url)
      .then(response => {
        if(!response.ok) {
          throw new Error(`HTTP error status: ${response.status}!`)
        } else {
          return response.json();
        }
      })
      .catch(error => {
        console.log(`There has been a problem with your fetch operations for resource "${url}": ${error.message}`);
      });
      // .finally(() => {
      //   console.log('... Retrieved product data!');
      // });
  }

  buildSrcset(srcset) {
    if (!srcset) return null;
    
    let srcset_str = '';

    srcset.forEach((image, index, array) => {
      srcset_str = srcset_str + `${image.src} ${image.size}w`;
      if (index < array.length - 1) srcset_str = srcset_str + `, `;
    });

    return srcset_str;
  }
  
}

customElements.define('main-product-slider', MainProductSlider); 

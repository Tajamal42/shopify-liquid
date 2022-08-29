class VideoHosted extends HTMLElement {
  constructor() {
    super();

    this.videoWrapper = this.querySelector('.video-section__media.no-js-hidden');
    this.videoElement = this.videoWrapper.querySelector('video');

    this.videos = {
      mobile: {
        url: this.videoElement.dataset.videoUrl,
        poster: this.videoElement.dataset.poster
      },
      desktop: {
        url: this.videoElement.dataset.desktopVideoUrl,
        poster: this.videoElement.dataset.desktopPoster
      }
    }

    let mediaQueryList = window.matchMedia('(min-width: 600px)');
    mediaQueryList.matches ? this.updateVideo(this.videos.desktop) : this.updateVideo(this.videos.mobile);

    mediaQueryList.addEventListener('change', this.handleWindowResize.bind(this));
  }

  handleWindowResize(e) {
    e.matches ? this.updateVideo(this.videos.desktop) : this.updateVideo(this.videos.mobile);
  }

  updateVideo(newVideo) {
    this.videoElement.pause();
    
    let { url, poster } = newVideo;
    if (this.videoElement.src == url) return;

    this.videoElement.poster = poster;
    this.videoElement.src = url;
  }
}

customElements.define('video-hosted', VideoHosted);

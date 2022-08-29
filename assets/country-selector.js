class CountrySelector extends HTMLElement {
  constructor() {
    super();

    this.panels = this.querySelectorAll('.selector-panel');
    if (!this.panels) return;
  
    this.panels.forEach(panel => {
      panel.addEventListener('click', this.openPanel.bind(this, panel.id));

      const backBtn = panel.querySelector('.selector-panel__button--back');
      if (!backBtn) return;

      backBtn.addEventListener('click', this.closePanel.bind(this, panel.id));
    });
  }

  openPanel(panelId) {
    this.classList.add(`${panelId}--is-open`);
  }

  closePanel(panelId) {
    setTimeout(() => this.classList.remove(`${panelId}--is-open`), 100);
  }
}
customElements.define('country-selector', CountrySelector);
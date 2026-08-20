// Modulo de animaciones
const Animations = {
    config: {
        exitDelay: 30,
        enterDelay: 40,
        exitDuration: 400
    },

    // Salida de elementos
    exit(elements, callback) {
        if (!elements || elements.length === 0) {
            if (callback) callback();
            return;
        }
        const items = Array.from(elements);
        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('project-exit');
            }, index * this.config.exitDelay);
        });
        setTimeout(() => {
            if (callback) callback();
        }, items.length * this.config.exitDelay + this.config.exitDuration);
    },

    // Entrada de elementos
    enter(elements) {
        if (!elements || elements.length === 0) return;
        const items = Array.from(elements);
        items.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px) scale(0.95)';
            item.classList.add('project-enter');
            setTimeout(() => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0) scale(1)';
            }, index * this.config.enterDelay);
        });
    },

    // Filtrado con animacion
    filterAndAnimate(container, filteredItems, renderCallback) {
        const currentItems = container.querySelectorAll('.project-item');
        this.exit(currentItems, () => {
            container.innerHTML = '';
            renderCallback();
            const newItems = container.querySelectorAll('.project-item');
            this.enter(newItems);
        });
    },

    // Abrir dropdown
    openDropdown(dropdown) {
        if (!dropdown) return;
        dropdown.classList.remove('closing');
        dropdown.style.display = 'block';
        void dropdown.offsetWidth;
        dropdown.classList.add('show');
    },

    // Cerrar dropdown
    closeDropdown(dropdown, callback) {
        if (!dropdown) return;
        dropdown.classList.remove('show');
        dropdown.classList.add('closing');
        setTimeout(() => {
            dropdown.style.display = 'none';
            dropdown.classList.remove('closing');
            if (callback) callback();
        }, 300);
    },

    // Abrir modal QR (misma animación que dropdown)
    openModal(modal) {
        if (!modal) return;
        modal.classList.remove('closing');
        modal.style.display = 'flex';
        void modal.offsetWidth;
        modal.classList.add('show');
    },

    // Cerrar modal QR (misma animación que dropdown)
    closeModal(modal, callback) {
        if (!modal) return;
        modal.classList.remove('show');
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
            if (callback) callback();
        }, 300);
    }
};

window.Animations = Animations;
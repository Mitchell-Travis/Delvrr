// #ef8c31;
document.addEventListener('DOMContentLoaded', function() {
    const sections = ['menuSection', 'ordersSection', 'userSection']; // Only existing sections
    const navIcons = ['ourDishIcon', 'ordersIcon', 'userIcon']; // Navigation icon IDs

    function hideAllSections() {
        sections.forEach(section => {
            const el = document.getElementById(section);
            if (el) el.style.display = 'none';
        });
    }

    function showSection(sectionId) {
        hideAllSections();
        const section = document.getElementById(sectionId);
        if (section) section.style.display = 'block';
    }

    function resetActiveStates() {
        navIcons.forEach(iconId => {
            const icon = document.getElementById(iconId);
            if (icon) {
                icon.classList.remove('active');
                const label = icon.querySelector('.nav-label');
                if (label) label.classList.remove('active');
            }
        });
    }

    // Set initial state - show menu section
    showSection('menuSection');
    document.getElementById('ourDishIcon').classList.add('active');
    document.querySelector('#ourDishIcon .nav-label').classList.add('active');

    // Navigation click handlers
    navIcons.forEach(iconId => {
        document.getElementById(iconId).addEventListener('click', function() {
            const targetSection = this.getAttribute('data-target') || 'menuSection';
            resetActiveStates();
            showSection(targetSection);
            this.classList.add('active');
            this.querySelector('.nav-label').classList.add('active');
        });
    });

    // Set data-target attributes in HTML (Add these to your icon elements)
    document.getElementById('ourDishIcon').setAttribute('data-target', 'menuSection');
    document.getElementById('ordersIcon').setAttribute('data-target', 'ordersSection');
    document.getElementById('userIcon').setAttribute('data-target', 'userSection');
});
// Lazy loading images
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
});

// Smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Add to cart functionality
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function() {
        // Add to cart logic here
        this.classList.add('added-to-cart');
    });
});

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize menu sections
    const sections = document.querySelectorAll('.menu-section');
    const navIcons = document.querySelectorAll('.nav-icon');
    
    // Function to hide all sections
    function hideAllSections() {
        sections.forEach(section => {
            section.style.display = 'none';
        });
    }
    
    // Function to show a specific section
    function showSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'block';
        }
    }
    
    // Function to reset active states
    function resetActiveStates() {
        navIcons.forEach(icon => {
            icon.classList.remove('active');
        });
    }
    
    // Set initial state
    hideAllSections();
    showSection('menu');
    resetActiveStates();
    document.querySelector('[data-target="menu"]').classList.add('active');
    
    // Add click event listeners to navigation icons
    navIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            hideAllSections();
            showSection(target);
            resetActiveStates();
            this.classList.add('active');
        });
    });
    
    // Set data-target attributes for navigation icons
    navIcons.forEach(icon => {
        const target = icon.getAttribute('data-target');
        if (target) {
            icon.setAttribute('data-target', target);
        }
    });
}); 
// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize app
    const App = {
        // State management
        state: {
            cart: JSON.parse(localStorage.getItem('cart')) || {},
            currentSection: 'menuSection',
            isLoading: false,
            categories: new Set()
        },

        // DOM Elements
        elements: {
            menuSection: document.getElementById('menuSection'),
            ordersSection: document.getElementById('ordersSection'),
            profileSection: document.getElementById('profileSection'),
            cartItems: document.getElementById('cartItems'),
            cartCount: document.getElementById('cartCount'),
            cartTotal: document.getElementById('cartTotal'),
            cartIconCount: document.getElementById('cartIconCount'),
            checkoutButton: document.getElementById('checkoutButton'),
            navItems: document.querySelectorAll('.nav-item'),
            categoryNav: document.querySelector('.category-nav'),
            menuItems: document.querySelectorAll('.menu-item-card'),
            loadingOverlay: document.getElementById('loading-overlay')
        },

        // Initialize the application
        init() {
            this.initializeNavigation();
            this.initializeCart();
            this.initializeCategories();
            this.attachEventListeners();
            this.updateCartUI();
        },

        // Initialize navigation
        initializeNavigation() {
            this.elements.navItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = item.getAttribute('href')?.substring(1) || item.dataset.target;
                    if (targetId) {
                        this.navigateToSection(targetId);
                    }
                });
            });
        },

        // Navigate to different sections
        navigateToSection(sectionId) {
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });

            // Show target section
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                this.state.currentSection = sectionId;

                // Update navigation state
                this.elements.navItems.forEach(item => {
                    const itemTarget = item.getAttribute('href')?.substring(1) || item.dataset.target;
                    item.classList.toggle('active', itemTarget === sectionId);
                });
            }
        },

        // Initialize categories
        initializeCategories() {
            // Collect all unique categories
            this.elements.menuItems.forEach(item => {
                const category = item.dataset.category;
                if (category) {
                    this.state.categories.add(category);
                }
            });

            // Create category pills
            const categoryHtml = Array.from(this.state.categories).map(category => `
                <button class="category-pill" data-category="${category}">
                    ${category}
                </button>
            `).join('');

            this.elements.categoryNav.innerHTML = `
                <button class="category-pill active" data-category="all">All</button>
                ${categoryHtml}
            `;

            // Add category filter functionality
            this.elements.categoryNav.addEventListener('click', (e) => {
                const pill = e.target.closest('.category-pill');
                if (pill) {
                    this.filterByCategory(pill.dataset.category);
                    
                    // Update active state
                    document.querySelectorAll('.category-pill').forEach(p => 
                        p.classList.toggle('active', p === pill));
                }
            });
        },

        // Filter menu items by category
        filterByCategory(category) {
            this.elements.menuItems.forEach(item => {
                if (category === 'all' || item.dataset.category === category) {
                    item.style.display = '';
                    item.animate([
                        { opacity: 0, transform: 'translateY(20px)' },
                        { opacity: 1, transform: 'translateY(0)' }
                    ], {
                        duration: 300,
                        easing: 'ease-out',
                        fill: 'forwards'
                    });
                } else {
                    item.style.display = 'none';
                }
            });
        },

        // Initialize cart functionality
        initializeCart() {
            // Attach event listeners to cart buttons
            document.querySelectorAll('.cart').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const productId = button.dataset.productId;
                    this.addToCart(productId);
                    this.animateCartButton(button);
                });
            });

            // Initialize checkout button
            this.elements.checkoutButton?.addEventListener('click', () => {
                if (Object.keys(this.state.cart).length === 0) {
                    this.showToast('Your cart is empty!', 'warning');
                    return;
                }
                this.processCheckout();
            });
        },

        // Add item to cart
        addToCart(productId) {
            const productCard = document.querySelector(`.menu-item-card [data-product-id="${productId}"]`)
                .closest('.menu-item-card');
            const productName = productCard.querySelector('.item-name').textContent;
            const productPrice = parseFloat(productCard.querySelector('.current-price').textContent.replace(/[^\d.-]/g, ''));
            const productImage = productCard.querySelector('img').src;

            if (this.state.cart[productId]) {
                this.state.cart[productId][0]++;
            } else {
                this.state.cart[productId] = [1, productName, productPrice, productImage];
            }

            this.updateCartUI();
            this.saveCartToStorage();
            this.showToast('Item added to cart', 'success');
        },

        // Update cart UI
        updateCart() {
            let totalItems = 0;
            let subtotal = 0;
            let cartHtml = '';

            if (Object.keys(this.state.cart).length === 0) {
                cartHtml = `
                    <div class="empty-state">
                        <i class="fas fa-shopping-cart"></i>
                        <p>Your cart is empty</p>
                    </div>
                `;
            } else {
                Object.entries(this.state.cart).forEach(([id, [quantity, name, price, image]]) => {
                    totalItems += quantity;
                    subtotal += quantity * price;

                    cartHtml += `
                        <div class="cart-item">
                            <img src="${image}" alt="${name}" class="cart-item-image">
                            <div class="cart-item-details">
                                <h3 class="cart-item-name">${name}</h3>
                                <div class="cart-item-price">$${price.toFixed(2)}</div>
                                <div class="quantity-controls">
                                    <button class="quantity-btn decrement" data-product-id="${id}">-</button>
                                    <span>${quantity}</span>
                                    <button class="quantity-btn increment" data-product-id="${id}">+</button>
                                </div>
                            </div>
                            <button class="remove-item" data-product-id="${id}">&times;</button>
                        </div>
                    `;
                });
            }

            this.elements.cartItems.innerHTML = cartHtml;
            this.elements.cartCount.textContent = totalItems;
            this.elements.cartTotal.textContent = `$${subtotal.toFixed(2)}`;
            this.elements.cartIconCount.textContent = totalItems;
            
            // Toggle badge visibility
            [this.elements.cartCount, this.elements.cartIconCount].forEach(element => {
                element?.classList.toggle('d-none', totalItems === 0);
            });
        },

        // Save cart to localStorage
        saveCartToStorage() {
            localStorage.setItem('cart', JSON.stringify(this.state.cart));
        },

        // Process checkout
        async processCheckout() {
            this.setLoading(true);
            
            try {
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const restaurantId = this.elements.checkoutButton.dataset.restaurantId;
                window.location.href = `/dashboard/${restaurantId}/checkout/`;
            } catch (error) {
                this.showToast('Checkout failed. Please try again.', 'error');
            } finally {
                this.setLoading(false);
            }
        },

        // Loading state management
        setLoading(isLoading) {
            this.state.isLoading = isLoading;
            this.elements.loadingOverlay?.classList.toggle('active', isLoading);
        },

        // Animation helpers
        animateCartButton(button) {
            const card = button.closest('.menu-item-card');
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 500);

            if (navigator.vibrate) {
                navigator.vibrate(200);
            }
        },

        // Toast notifications
        showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <div class="toast-content">
                    ${message}
                </div>
            `;
            
            document.body.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('show'));

            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },

        // Attach event listeners
        attachEventListeners() {
            // Cart item quantity controls
            this.elements.cartItems.addEventListener('click', (e) => {
                const button = e.target.closest('.quantity-btn, .remove-item');
                if (!button) return;

                const productId = button.dataset.productId;
                
                if (button.classList.contains('increment')) {
                    this.state.cart[productId][0]++;
                } else if (button.classList.contains('decrement')) {
                    if (this.state.cart[productId][0] > 1) {
                        this.state.cart[productId][0]--;
                    }
                } else if (button.classList.contains('remove-item')) {
                    delete this.state.cart[productId];
                }

                this.updateCartUI();
                this.saveCartToStorage();
            });

            // Handle guest user toast
            if (!document.querySelector('[data-user-authenticated]')) {
                this.showToast('You are viewing as a guest. Some features may be limited.', 'info');
            }
        }
    };

    // Initialize the app
    App.init();
});
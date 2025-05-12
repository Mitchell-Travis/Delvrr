// Constants
const SERVICE_FEE = 0.25;
const DELIVERY_FEE = 0.00;
const THRESHOLD_DISTANCE = 500; // Increased from 300 to 500 meters for better detection
const ADMIN_CONFIRMATION_TIMEOUT = 60000; // 60 seconds
const LOCATION_TIMEOUT = 5000; // Reduced for faster experience
const LOCATION_MAX_AGE = 60000; // Increased to reduce unnecessary location checks
const AVERAGE_SPEED_KMH = 30; // km/h
const MIN_LOADING_DURATION = 1500; // Reduced for faster perceived loading
const LOCATION_CACHE_DURATION = 180000; // 3 minutes

// Global cart for backward compatibility
let cart = {};

// State management
const state = {
    map: null,
    restaurantMarker: null,
    userMarker: null,
    isMapInitialized: false,
    distanceToRestaurant: 0,
    userLocation: null,
    restaurantLocation: null,
    selectedPaymentMethod: '',
    deliveryType: 'unknown',
    deliveryTypeUserOverride: null, // Allow user to override automatic selection
    homeDeliveryAddress: {},
    paymentVerified: false,
    adminConfirmed: false,
    adminConfirmationInProgress: false,
    orderReferenceId: null,
    tableNumber: '1',
    locationLoading: false,
    locationAttempts: 0,
    lastLocationUpdateTime: 0,
    locationPromise: null, // To store the ongoing location promise
    mapBoundsAdjusted: false, // Track if map bounds have been adjusted
    locationUpdateQueued: false, // Prevent multiple simultaneous updates
    distanceCache: {} // Cache for distance calculations
};

// DOM Elements cache
let elements;
let loadingOverlayShownAt = 0;
const DEBUG_MODE = false;

// Toast notification styles
$('<style>').text(`
    .toast-container {
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
    }
    .toast {
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        margin-bottom: 10px;
        transition: opacity 0.3s ease-out;
    }
    .toast i { font-size: 16px; }
    .toast.loading i { color: #2196F3; animation: spin 1s linear infinite; }
    .toast.nearby i { color: #4CAF50; }
    .toast.far i { color: #FF9800; }
    .toast.error i { color: #f44336; }
    .toast.fade-out { opacity: 0; }
    .delivery-switch-label.manual-override {
        border: 2px solid #4CAF50 !important;
    }
    .shimmer {
        background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite linear;
    }
    .pulse {
        animation: pulse 2s infinite ease-in-out;
    }
    .shake {
        animation: shake 0.5s ease-in-out;
    }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
    @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
    
    /* Map improvements */
    #map { transition: opacity 0.5s ease-in-out; }
    #map.loading { opacity: 0.7; }
    .user-marker {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #03a9f4;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        box-shadow: 0 0 0 rgba(3, 169, 244, 0.4);
        animation: pulse-blue 2s infinite;
    }
    @keyframes pulse-blue {
        0% { box-shadow: 0 0 0 0 rgba(3, 169, 244, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(3, 169, 244, 0); }
        100% { box-shadow: 0 0 0 0 rgba(3, 169, 244, 0); }
    }
`).appendTo('head');

// Toast container
let toastContainer = null;
let activeToasts = {};
let toastCounter = 0;

function initializeToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

function showToast(message, type = 'info', duration = 3000) {
    const container = initializeToastContainer();
    const toastId = 'toast-' + (toastCounter++);
    
    // If there's already a loading toast and we're showing another one, remove the old one
    if (type === 'loading') {
        const existingToasts = container.querySelectorAll('.toast.loading');
        existingToasts.forEach(toast => toast.remove());
    }
    
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'loading') icon = 'fa-spinner';
    else if (type === 'nearby') icon = 'fa-check-circle';
    else if (type === 'far') icon = 'fa-truck';
    else if (type === 'error') icon = 'fa-exclamation-circle';
    
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    
    activeToasts[toastId] = toast;
    
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toastId);
        }, duration);
    }
    
    return toastId;
}

function updateToast(toastId, message, type = null) {
    const toast = activeToasts[toastId];
    if (!toast) return false;
    
    const iconSpan = toast.querySelector('i');
    const messageSpan = toast.querySelector('span');
    
    if (messageSpan) messageSpan.textContent = message;
    
    if (type) {
        // Update toast type
        const oldType = toast.className.replace('toast', '').trim();
        toast.classList.remove(oldType);
        toast.classList.add(type);
        
        // Update icon if needed
        if (iconSpan) {
            const oldIconClass = iconSpan.className.split(' ').find(cls => cls.startsWith('fa-'));
            if (oldIconClass) iconSpan.classList.remove(oldIconClass);
            
            let newIcon = 'fa-info-circle';
            if (type === 'loading') newIcon = 'fa-spinner';
            else if (type === 'nearby') newIcon = 'fa-check-circle';
            else if (type === 'far') newIcon = 'fa-truck';
            else if (type === 'error') newIcon = 'fa-exclamation-circle';
            
            iconSpan.classList.add(newIcon);
        }
    }
    
    return true;
}

function removeToast(toastId) {
    const toast = activeToasts[toastId];
    if (!toast) return;
    
    // Add fade-out class first for smooth transition
    toast.classList.add('fade-out');
    
    // Then remove after transition completes
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        delete activeToasts[toastId];
    }, 300); // Match the CSS transition duration
}

function calculateDistance(point1, point2) {
    if (!point1 || !point2) return Infinity;
    
    // Use cached value if possible (for frequently accessed pairs)
    const cacheKey = `${point1[0]},${point1[1]}_${point2[0]},${point2[1]}`;
    if (state.distanceCache && state.distanceCache[cacheKey]) {
        return state.distanceCache[cacheKey];
    }
    
    const toRad = (value) => value * Math.PI / 180;
    const R = 6371000; // Earth radius in meters
    
    const lat1 = point1[1];
    const lon1 = point1[0];
    const lat2 = point2[1];
    const lon2 = point2[0];
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Cache the result for future use
    if (!state.distanceCache) state.distanceCache = {};
    state.distanceCache[cacheKey] = distance;
    
    return distance;
}

// Smart Cart Management
function getCart() {
    try {
        const cartStr = localStorage.getItem('cart');
        if (!cartStr || cartStr === '{}' || cartStr === 'null') {
            // If main cart is empty, try backup
            const backupCart = localStorage.getItem('backup_cart');
            if (backupCart && backupCart !== '{}' && backupCart !== 'null') {
                localStorage.setItem('cart', backupCart);
                cart = JSON.parse(backupCart);
                return cart;
            }
            cart = {};
            return {};
        }
        cart = JSON.parse(cartStr);
        return cart;
    } catch (e) {
        console.error('Error parsing cart:', e);
        cart = {};
        return {};
    }
}

function saveCart(cartData) {
    try {
        const cartStr = JSON.stringify(cartData);
        localStorage.setItem('cart', cartStr);
        // Also save a backup
        localStorage.setItem('backup_cart', cartStr);
        cart = cartData;
    } catch (e) {
        console.error('Error saving cart:', e);
        showToast('Could not save your cart', 'error');
    }
}

function ensureCartLoaded() {
    const currentCart = getCart();
    
    if (!currentCart || Object.keys(currentCart).length === 0) {
        console.log('Cart is empty, checking for backup...');
        
        // Try to restore from backup
        const backupCartStr = localStorage.getItem('backup_cart');
        if (backupCartStr && backupCartStr !== '{}' && backupCartStr !== 'null') {
            try {
                const backupCart = JSON.parse(backupCartStr);
                if (backupCart && Object.keys(backupCart).length > 0) {
                    console.log('Found backup cart, restoring');
                    localStorage.setItem('cart', backupCartStr);
                    cart = backupCart;
                    return true;
                }
            } catch (e) {
                console.error('Error parsing backup cart:', e);
            }
        }
        
        // If we're in debug mode, create a sample cart
        if (DEBUG_MODE) {
            console.log('Debug mode, creating sample cart');
            const sampleCart = {
                '1': [1, 'Sample Item', '9.99', '/static/images/placeholder.jpg']
            };
            saveCart(sampleCart);
            return true;
        }
    }
    
    return Object.keys(currentCart).length > 0;
}

async function initializeMap() {
    return new Promise((resolve, reject) => {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.error('Map container not found');
            return reject(new Error('Map container not found'));
        }
        
        mapContainer.classList.add('loading');
        
        const checkoutButton = document.getElementById('checkoutButton');
        if (!checkoutButton) {
            console.error('Checkout button not found');
            return reject(new Error('Checkout button not found'));
        }

        const restaurantLat = Number(checkoutButton.getAttribute('data-restaurant-lat'));
        const restaurantLon = Number(checkoutButton.getAttribute('data-restaurant-lon'));
        
        if (isNaN(restaurantLat) || isNaN(restaurantLon)) {
            console.error('Invalid restaurant coordinates', { restaurantLat, restaurantLon });
            return reject(new Error('Invalid restaurant coordinates'));
        }

        state.restaurantLocation = [restaurantLon, restaurantLat];
        
        // Ensure Mapbox is loaded
        if (typeof mapboxgl === 'undefined') {
            console.error('Mapbox GL JS is not loaded');
            return reject(new Error('Mapbox GL JS is not loaded'));
        }
        
        mapboxgl.accessToken = 'pk.eyJ1IjoibWl0Y2hlbGwyMzEiLCJhIjoiY205dGF0YXprMGFoajJrc2I5cDVvNnprZSJ9.LiQvQKUCOIe5fW0QYSOSFQ';

        try {
            state.map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/streets-v11',
                center: state.restaurantLocation,
                zoom: 14,
                attributionControl: false,
                renderWorldCopies: false,
                cooperativeGestures: true,
                fadeDuration: 0,
                antialias: true
            });

            state.map.on('load', () => {
                mapContainer.classList.remove('loading');
                
                // Add navigation control
                state.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
                
                // Create restaurant marker
                const restaurantEl = document.createElement('div');
                restaurantEl.innerHTML = '<i class="fas fa-utensils fa-lg"></i>';
                restaurantEl.style.color = '#ffffff';
                restaurantEl.style.backgroundColor = '#d32f2f';
                restaurantEl.style.borderRadius = '50%';
                restaurantEl.style.width = '28px';
                restaurantEl.style.height = '28px';
                restaurantEl.style.display = 'flex';
                restaurantEl.style.justifyContent = 'center';
                restaurantEl.style.alignItems = 'center';
                restaurantEl.style.boxShadow = '0 0 0 2px white, 0 0 5px rgba(0,0,0,0.3)';

                state.restaurantMarker = new mapboxgl.Marker({ element: restaurantEl })
                    .setLngLat(state.restaurantLocation)
                    .setPopup(new mapboxgl.Popup({
                        closeButton: false,
                        closeOnClick: false,
                        offset: 25
                    }).setHTML('<strong>Restaurant</strong>'))
                    .addTo(state.map);
                
                // Show popup on hover
                restaurantEl.addEventListener('mouseenter', () => {
                    state.restaurantMarker.getPopup().addTo(state.map);
                });
                restaurantEl.addEventListener('mouseleave', () => {
                    state.restaurantMarker.getPopup().remove();
                });

                state.isMapInitialized = true;
                console.log('Map initialized with restaurant marker');
                
                // If we already have a user location, update map immediately
                if (state.userLocation) {
                    updateMapWithUserLocation();
                }
                
                resolve();
            });

            state.map.on('error', (e) => {
                console.error('Mapbox error:', e.error);
                mapContainer.classList.remove('loading');
                reject(e.error);
            });
        } catch (err) {
            console.error('Map initialization error:', err);
            mapContainer.classList.remove('loading');
            reject(err);
        }
    });
}

async function getUserLocation(retries = 2, showNotification = true) {
    // If we already have an ongoing location request, return that promise
    if (state.locationPromise && state.locationLoading) {
        return state.locationPromise;
    }
    
    // Check if we have a recent enough location
    const now = Date.now();
    if (state.userLocation && 
        state.lastLocationUpdateTime > 0 && 
        now - state.lastLocationUpdateTime < LOCATION_CACHE_DURATION) {
        console.log('Using cached location');
        return Promise.resolve(state.userLocation);
    }
    
    // Start a new location request
    state.locationLoading = true;
    state.locationAttempts++;
    
    let loadingToastId = null;
    if (showNotification) {
        loadingToastId = showToast('Detecting your location...', 'loading', 0);
    }
    
    // Reduce timeout to make it faster
    const locationTimeout = 3000; // Reduced from 5000 to 3000ms
    
    const locationPromise = new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            state.locationLoading = false;
            if (loadingToastId) removeToast(loadingToastId);
            showToast('Geolocation is not supported by your browser', 'error');
            return reject(new Error('Geolocation not supported'));
        }
        
        navigator.geolocation.getCurrentPosition(
            // Success handler - Make this a quick success
            (position) => {
                state.locationLoading = false;
                const userLoc = [position.coords.longitude, position.coords.latitude];
                
                // Store the location in state
                state.userLocation = userLoc;
                state.lastLocationUpdateTime = now;
                
                // Immediately remove loading toast without showing "Location found" message
                if (loadingToastId) {
                    removeToast(loadingToastId);
                }
                
                resolve(userLoc);
            },
            // Error handler
            (error) => {
                state.locationLoading = false;
                
                if (retries > 0) {
                    if (loadingToastId) {
                        updateToast(loadingToastId, 'Retrying location detection...', 'loading');
                    }
                    
                    setTimeout(() => {
                        getUserLocation(retries - 1, false)
                            .then(userLoc => {
                                if (loadingToastId) removeToast(loadingToastId);
                                resolve(userLoc);
                            })
                            .catch(err => {
                                if (loadingToastId) removeToast(loadingToastId);
                                handleLocationError(err, null, resolve, reject);
                            });
                    }, 300);
                } else {
                    if (loadingToastId) removeToast(loadingToastId);
                    handleLocationError(error, null, resolve, reject);
                }
            },
            { 
                maximumAge: LOCATION_MAX_AGE, 
                timeout: locationTimeout,
                enableHighAccuracy: true 
            }
        );
    });
    
    state.locationPromise = locationPromise;
    
    // Clear the location promise when done
    locationPromise.finally(() => {
        state.locationPromise = null;
        state.locationLoading = false;
    });
    
    return locationPromise;
}

// Helper for handling location errors
function handleLocationError(error, toastId, resolve, reject) {
    console.error('Geolocation error:', error);
    
    let errorMsg = 'Could not detect your location';
    if (error.code === 1) {
        errorMsg = 'Location permission denied. Please enable location services in your browser settings.';
    } else if (error.code === 2) {
        errorMsg = 'Location unavailable. Try moving to an area with better GPS signal.';
    } else if (error.code === 3) {
        errorMsg = 'Location request timed out. Please try again.';
    }
    
    if (state.locationAttempts <= 1) {
        if (toastId) {
            updateToast(toastId, errorMsg, 'error');
            setTimeout(() => removeToast(toastId), 3000);
        } else {
            showToast(errorMsg, 'error');
        }
    }
    
    if (state.userLocation) {
        // Use last known location as fallback
        resolve(state.userLocation);
    } else {
        // If we can't get location, default to home delivery
        if (!state.deliveryTypeUserOverride) {
            state.deliveryType = 'home';
            updateDeliveryTypeUI();
        }
        reject(error);
    }
}

function formatDistance(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
}

function calculateDeliveryTime(distanceMeters) {
    const distanceKm = distanceMeters / 1000;
    const timeMinutes = Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60);
    return Math.max(10, timeMinutes);
}

function updateDeliveryTime(distanceMeters) {
    const timeMinutes = calculateDeliveryTime(distanceMeters);
    $('.estimated-delivery').html(`<i class="far fa-clock"></i> ~${timeMinutes} mins`);
}

function updateMapWithUserLocation(force = false) {
    if (!state.isMapInitialized) return;
    
    // Prevent multiple simultaneous updates
    if (state.locationUpdateQueued && !force) return;
    state.locationUpdateQueued = true;
    
    // Skip showing toasts during initialization
    const skipToasts = !force && state.locationAttempts <= 1;
    
    getUserLocation(1, false).then(userLoc => {
        state.locationUpdateQueued = false;
        
        if (state.userMarker) {
            // Update existing marker position
            state.userMarker.setLngLat(userLoc);
        } else {
            // Create new user marker
            const userMarkerEl = document.createElement('div');
            userMarkerEl.className = 'user-marker';
            userMarkerEl.innerHTML = '<i class="fas fa-user fa-sm"></i>';
            
            state.userMarker = new mapboxgl.Marker({ element: userMarkerEl })
                .setLngLat(userLoc)
                .addTo(state.map);
        }

        // Only adjust bounds if needed or not yet done
        if (!state.mapBoundsAdjusted || force) {
            const bounds = new mapboxgl.LngLatBounds()
                .extend(userLoc)
                .extend(state.restaurantLocation);
                
            state.map.fitBounds(bounds, { 
                padding: { top: 50, bottom: 50, left: 50, right: 50 },
                duration: 300 // Faster animation
            });
            
            state.mapBoundsAdjusted = true;
        }

        // Calculate and update distance
        state.distanceToRestaurant = calculateDistance(userLoc, state.restaurantLocation);
        
        // Only auto-determine delivery type if the user hasn't manually overridden it
        if (state.deliveryTypeUserOverride === null) {
            const isAtRestaurant = state.distanceToRestaurant <= THRESHOLD_DISTANCE;
            const newDeliveryType = isAtRestaurant ? 'restaurant' : 'home';
            
            if (state.deliveryType !== newDeliveryType) {
                state.deliveryType = newDeliveryType;
                updateDeliveryTypeUI();
                
                // Only show toast when delivery type actually changes
                if (!skipToasts) {
                    if (isAtRestaurant) {
                        showToast('You are at the restaurant!', 'nearby', 2000);
                    } else {
                        showToast(`${formatDistance(state.distanceToRestaurant)} from restaurant`, 'far', 2000);
                    }
                }
            }
        }
        
        updateDistanceDisplay(state.distanceToRestaurant);
        
        // Update delivery time if needed
        if (state.deliveryType === 'home') {
            updateDeliveryTime(state.distanceToRestaurant);
        }
    }).catch(err => {
        state.locationUpdateQueued = false;
        console.error('Error updating map:', err);
        
        if (!skipToasts) {
            showToast('Error updating location', 'error');
        }
        
        // Default to home delivery if location fails and no override
        if (!state.deliveryTypeUserOverride) {
            state.deliveryType = 'home';
            updateDeliveryTypeUI();
        }
    });
}

function updateDeliveryTypeUI() {
    if (!elements) return;
    
    // Update delivery switch labels
    elements.deliverySwitchLabels.removeClass('active manual-override');
    const currentTypeLabel = $(`.delivery-switch-label[data-delivery-type="${state.deliveryType}"]`);
    currentTypeLabel.addClass('active');
    
    // If user has manually overridden, show that visually
    if (state.deliveryTypeUserOverride !== null) {
        currentTypeLabel.addClass('manual-override');
    }

    // Animate the transition between delivery types
    if (state.deliveryType === 'restaurant') {
        $('.delivery-details-home').fadeOut(150, function() {
            $('.delivery-details-restaurant').fadeIn(150);
            $('.table-info').fadeIn(150);
        });
    } else {
        $('.delivery-details-restaurant').fadeOut(150, function() {
            $('.delivery-details-home').fadeIn(150);
            $('.table-info').fadeOut(150);
        });
    }
    
    // Update payment options with the new delivery type
    updatePaymentOptions();
}

function updateDistanceDisplay(dist) {
    if (!elements.distanceValue || !elements.distanceStatus) {
        return;
    }
    
    if (dist === Infinity || isNaN(dist)) {
        elements.distanceValue.html('<i class="fas fa-exclamation-circle"></i> Could not calculate distance');
        elements.distanceStatus.text('').removeClass('nearby far');
        return;
    }
    
    const distanceHtml = dist < 1000
        ? `<i class="fas fa-location-arrow"></i> ${Math.round(dist)} meters away`
        : `<i class="fas fa-location-arrow"></i> ${(dist / 1000).toFixed(1)} km away`;
    
    // Animate the distance update if it's changing
    if (elements.distanceValue.html() !== distanceHtml) {
        elements.distanceValue.fadeOut(100, function() {
            $(this).html(distanceHtml).fadeIn(100);
        });
    }
    
    const isNearby = dist <= THRESHOLD_DISTANCE;
    const statusText = isNearby
        ? '<i class="fas fa-check-circle"></i> You\'re at the restaurant!'
        : '<i class="fas fa-truck"></i> Delivery recommended';
    
    if (elements.distanceStatus.html() !== statusText) {
        elements.distanceStatus.fadeOut(100, function() {
            $(this).html(statusText)
                .toggleClass('nearby', isNearby)
                .toggleClass('far', !isNearby)
                .fadeIn(100);
        });
    }
}

function calculateCartTotal() {
    const cart = getCart();
    let subtotal = 0;
    Object.entries(cart).forEach(([_, item]) => subtotal += item[0] * parseFloat(item[2]));
    return subtotal + SERVICE_FEE + DELIVERY_FEE;
}

function updateOrderDetails() {
    const cart = getCart();
    const items = Object.entries(cart);
    
    if (!items.length) {
        elements.orderDetailsList.html(`
            <div class="empty-cart">
                <i class="fas fa-shopping-bag"></i>
                <p>Your cart is empty.</p>
            </div>
        `);
        elements.itemTotal.text('$0.00');
        elements.cartTotal.text('$0.00');
        updateCheckoutButtonState();
        return;
    }

    let html = '';
    let subtotal = 0;

    items.forEach(([id, item]) => {
        const qty = item[0];
        const name = item[1];
        const price = item[2];
        const img = item[3];
        
        const itemPrice = parseFloat(price);
        const total = qty * itemPrice;
        subtotal += total;
        
        html += `
            <div class="order-item" data-item-id="${id}" data-item-price="${itemPrice.toFixed(2)}">
                <img src="${img}" alt="${name}">
                <div class="item-details">
                    <h3>${name}</h3>
                    <p>$${itemPrice.toFixed(2)}</p>
                </div>
                <div class="item-quantity-controls">
                    <button class="quantity-button decrement-item">-</button>
                    <span class="item-quantity">${qty}</span>
                    <button class="quantity-button increment-item">+</button>
                </div>
                <button class="delete-item"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
    });

    elements.orderDetailsList.html(html);
    const totalDue = subtotal + SERVICE_FEE + DELIVERY_FEE;
    
    // Animate price changes
    if (elements.itemTotal.text() !== `${subtotal.toFixed(2)}`) {
        elements.itemTotal.addClass('pulse').text(`${subtotal.toFixed(2)}`);
        setTimeout(() => elements.itemTotal.removeClass('pulse'), 1000);
    }
    
    if (elements.cartTotal.text() !== `${totalDue.toFixed(2)}`) {
        elements.cartTotal.addClass('pulse').text(`${totalDue.toFixed(2)}`);
        setTimeout(() => elements.cartTotal.removeClass('pulse'), 1000);
    }

    if (elements.orderVerificationBox && elements.orderVerificationBox.is(':visible')) {
        updateOrderTotalAmountDisplay(totalDue);
    }
    
    updateCheckoutButtonState();
}

function updateCart(id, delta) {
    const cart = getCart();
    if (!cart[id]) return;

    cart[id][0] += delta;
    if (cart[id][0] < 1) delete cart[id];
    
    saveCart(cart);
    if ('vibrate' in navigator) navigator.vibrate(30);
    updateOrderDetails();
}

function deleteCartItem(id) {
    const cart = getCart();
    if (!cart[id]) return;

    delete cart[id];
    saveCart(cart);
    
    // Add haptic feedback
    if ('vibrate' in navigator) navigator.vibrate([50, 50, 50]);
    updateOrderDetails();
}

function updatePaymentOptions() {
    state.selectedPaymentMethod = '';
    elements.paymentOptions.removeClass('selected active');

    if (state.deliveryType === 'restaurant') {
        $('.payment-option.restaurant-only').addClass('active');
        $('.payment-option[data-method="Cash on Delivery"].restaurant-only').addClass('selected');
        state.selectedPaymentMethod = 'Cash on Delivery';
        
        // Hide verification box with animation
        if (elements.orderVerificationBox && elements.orderVerificationBox.is(':visible')) {
            elements.orderVerificationBox.slideUp(150);
        }
        
        state.paymentVerified = true;
        state.adminConfirmed = true;
        $('#cashDeliveryOption .order-verification-badge').remove();
        if (elements.verificationStatus) elements.verificationStatus.empty();
    } else {
        $('.payment-option.home-only').addClass('active');
        $('.payment-option[data-method="Cash on Delivery"].home-only').addClass('selected');
        state.selectedPaymentMethod = 'Cash on Delivery';
        
        // Show verification box with animation
        if (elements.orderVerificationBox && !elements.orderVerificationBox.is(':visible')) {
            elements.orderVerificationBox.slideDown(150);
        }
        
        state.paymentVerified = false;
        state.adminConfirmed = false;
        updateOrderTotalAmountDisplay(calculateCartTotal());
        
        // Open address modal if needed, but with a slight delay for smoother UX
        if (elements.openAddressModal && (!state.homeDeliveryAddress.full_name || 
            !state.homeDeliveryAddress.phone_number || 
            !state.homeDeliveryAddress.address)) {
            setTimeout(() => elements.openAddressModal.trigger('click'), 300);
        }
    }
    updateCheckoutButtonState();
}

function updateOrderTotalAmountDisplay(amount) {
    if (!elements.totalAmount) return;
    
    // Animate price change
    const newText = `${amount.toFixed(2)}`;
    if (elements.totalAmount.text() !== newText) {
        elements.totalAmount.addClass('pulse').text(newText);
        setTimeout(() => elements.totalAmount.removeClass('pulse'), 1000);
    }
}

function updateCheckoutButtonState() {
    if (!elements.checkoutButton) return;
    
    const cart = getCart();
    const cartEmpty = !Object.keys(cart).length;
    const paymentSelected = !!state.selectedPaymentMethod;
    const addressEntered = state.deliveryType === 'restaurant' || 
                          (state.homeDeliveryAddress.full_name && 
                           state.homeDeliveryAddress.phone_number && 
                           state.homeDeliveryAddress.address);
    const needsAdminConfirmation = state.deliveryType === 'home' && 
                                 state.selectedPaymentMethod === 'Cash on Delivery' && 
                                 !state.adminConfirmed;

    const disableButton = cartEmpty || !paymentSelected || !addressEntered || needsAdminConfirmation;
    
    // Change button appearance based on state
    elements.checkoutButton.prop('disabled', disableButton);
    
    let buttonClass = 'btn-primary';
    let buttonText = 'Place Order';
    
    if (state.deliveryType === 'home') {
        if (!addressEntered) {
            buttonText = 'Enter Delivery Address';
            buttonClass = 'btn-secondary';
        } else if (!state.paymentVerified) {
            buttonText = 'Verify Order First';
            buttonClass = 'btn-warning';
        } else if (needsAdminConfirmation && !state.adminConfirmationInProgress) {
            buttonText = 'Request Restaurant Confirmation';
            buttonClass = 'btn-info';
        } else if (state.adminConfirmationInProgress) {
            buttonText = 'Waiting for Restaurant Confirmation...';
            buttonClass = 'btn-info';
        }
        
        if (elements.verifyOrder) elements.verifyOrder.prop('disabled', !addressEntered);
        if (elements.confirmPhone) elements.confirmPhone.prop('disabled', !addressEntered);
    }
    
    // Update button appearance
    if (elements.checkoutButton.text() !== buttonText) {
        elements.checkoutButton.fadeOut(100, function() {
            $(this)
                .text(buttonText)
                .removeClass('btn-primary btn-secondary btn-warning btn-info btn-success')
                .addClass(buttonClass)
                .fadeIn(100);
        });
    }
}

function refreshLocation() {
    // Clear the last location update time to force a new location fetch
    state.lastLocationUpdateTime = 0;
    state.mapBoundsAdjusted = false; // Force map bounds adjustment
    
    const toastId = showToast('Updating your location...', 'loading', 0);
    
    getUserLocation(1, false)
        .then(() => {
            updateToast(toastId, 'Location updated!', 'nearby');
            setTimeout(() => removeToast(toastId), 1500);
            updateMapWithUserLocation(true); // Force update
        })
        .catch(err => {
            console.error("Error refreshing location:", err);
            updateToast(toastId, 'Could not update your location', 'error');
            setTimeout(() => removeToast(toastId), 3000);
        });
}

function requestAdminConfirmation() {
    console.log('Requesting admin confirmation...');
    state.adminConfirmationInProgress = true;
    updateCheckoutButtonState();
    
    // Show progress toast
    const toastId = showToast('Requesting restaurant confirmation...', 'loading', 0);
    
    // Simulate network request with progress
    setTimeout(() => {
        updateToast(toastId, 'Restaurant is reviewing your order...', 'loading');
        
        setTimeout(() => {
            state.adminConfirmed = true;
            state.adminConfirmationInProgress = false;
            
            updateToast(toastId, 'Restaurant confirmed your order!', 'nearby');
            setTimeout(() => removeToast(toastId), 2000);
            
            if (elements.verificationStatus) {
                elements.verificationStatus.html('<span style="color: #4caf50;"><i class="fas fa-check-circle"></i> Restaurant confirmed your order. Ready to proceed.</span>');
            }
            
            if ($('#cashDeliveryOption').length) {
                if (!$('#cashDeliveryOption .admin-confirmation-badge').length) {
                    const badge = $('<span class="admin-confirmation-badge" style="margin-left:5px;color:#4CAF50;"><i class="fas fa-check-circle"></i></span>');
                    badge.hide();
                    $('#cashDeliveryOption').append(badge);
                    badge.fadeIn(300);
                }
            }
            
            updateCheckoutButtonState();
        }, 1500);
    }, 1000);
}

function setupEventHandlers() {
    if (!elements) return;
    
    // Add a new refresh location button with animation
    const refreshButton = $('<button id="refreshLocation" class="btn btn-sm btn-primary mb-2" style="margin-left: 10px;"><i class="fas fa-sync-alt"></i> Refresh Location</button>');
    $('#distanceValue').after(refreshButton);
    
    $('#refreshLocation').on('click', function(e) {
        e.preventDefault();
        
        // Visual feedback on button
        const $this = $(this);
        $this.prop('disabled', true).addClass('pulse');
        
        refreshLocation();
        
        // Re-enable button after delay
        setTimeout(() => {
            $this.prop('disabled', false).removeClass('pulse');
        }, 2000);
    });

    elements.deliverySwitchLabels.on('click', function() {
        const wantedType = $(this).data('delivery-type');
        if (state.deliveryType === wantedType) return;
        
        // Visual feedback for click
        $(this).addClass('pulse');
        setTimeout(() => $(this).removeClass('pulse'), 1000);
        
        // Allow manual override
        state.deliveryTypeUserOverride = wantedType;
        state.deliveryType = wantedType;
        
        // Show toast notification about manual override
        if (wantedType === 'restaurant') {
            if (state.distanceToRestaurant > THRESHOLD_DISTANCE) {
                showToast('You are not near the restaurant, but we\'ll let you pick up in person if you wish.', 'info', 5000);
            }
        } else {
            showToast('Switched to home delivery mode', 'info');
        }
        
        updateDeliveryTypeUI();
        if ('vibrate' in navigator) navigator.vibrate(50);
    });

    // Address modal event handlers
    if (elements.openAddressModal) {
        elements.openAddressModal.on('click', () => {
            elements.modalFullName.val(state.homeDeliveryAddress.full_name || '');
            elements.modalPhoneNumber.val(state.homeDeliveryAddress.phone_number || '');
            elements.modalAddress.val(state.homeDeliveryAddress.address || '');
            elements.addressModal.addClass('active');
        });
    }
    
    if (elements.closeAddressModal) {
        elements.closeAddressModal.on('click', () => elements.addressModal.removeClass('active'));
    }
    
    if (elements.cancelAddress) {
        elements.cancelAddress.on('click', () => elements.addressModal.removeClass('active'));
    }
    
    if (elements.saveAddress) {
        elements.saveAddress.on('click', () => {
            const full = elements.modalFullName.val().trim();
            const phone = elements.modalPhoneNumber.val().trim();
            const addr = elements.modalAddress.val().trim();
            
            if (!full || !phone || !addr) return alert('Please fill in all fields for delivery address.');
            
            // Visual feedback
            elements.saveAddress.addClass('pulse');
            
            state.homeDeliveryAddress = { full_name: full, phone_number: phone, address: addr };
            
            // Show success toast
            showToast('Delivery address saved!', 'nearby', 2000);
            
            elements.addressModal.removeClass('active');
            if (elements.confirmPhone && !elements.confirmPhone.val().trim()) {
                elements.confirmPhone.val(phone);
            }
            
            setTimeout(() => elements.saveAddress.removeClass('pulse'), 1000);
            updateCheckoutButtonState();
        });
    }

    elements.paymentOptions.on('click', function () {
        if (!$(this).hasClass('active')) return;
        
        // Visual feedback
        $(this).addClass('pulse');
        setTimeout(() => $(this).removeClass('pulse'), 1000);
        
        elements.paymentOptions.removeClass('selected');
        $(this).addClass('selected');
        state.selectedPaymentMethod = $(this).data('method');

        if (state.deliveryType === 'home') {
            state.paymentVerified = false;
            state.adminConfirmed = false;
            $('#cashDeliveryOption .order-verification-badge, #cashDeliveryOption .admin-confirmation-badge').remove();
            if (elements.verificationStatus) elements.verificationStatus.empty();
        }
        updateCheckoutButtonState();
        if ('vibrate' in navigator) navigator.vibrate(50);
    });

    // Cart item event handlers
    if (elements.orderDetailsList) {
        elements.orderDetailsList.on('click', '.increment-item', function() {
            const $btn = $(this);
            $btn.addClass('pulse');
            setTimeout(() => $btn.removeClass('pulse'), 500);
            updateCart($(this).closest('.order-item').data('item-id'), 1);
        });

        elements.orderDetailsList.on('click', '.decrement-item', function() {
            const $btn = $(this);
            $btn.addClass('pulse');
            setTimeout(() => $btn.removeClass('pulse'), 500);
            updateCart($(this).closest('.order-item').data('item-id'), -1);
        });

        elements.orderDetailsList.on('click', '.delete-item', function() {
            const $item = $(this).closest('.order-item');
            $item.addClass('fade-out');
            
            // Animate item removal
            $item.fadeOut(300, function() {
                deleteCartItem($item.data('item-id'));
            });
        });
        
        // Add swipe gestures for mobile
        let touchStartX = 0;
        let touchEndX = 0;
        
        elements.orderDetailsList.on('touchstart', '.order-item', function(e) {
            touchStartX = e.originalEvent.touches[0].clientX;
        });
        
        elements.orderDetailsList.on('touchmove', '.order-item', function(e) {
            touchEndX = e.originalEvent.touches[0].clientX;
        });
        
        elements.orderDetailsList.on('touchend', '.order-item', function(e) {
            if (touchStartX - touchEndX > 100) {
                // Swipe left - delete
                $(this).addClass('fade-out');
                $(this).animate({marginLeft: '-100%'}, 300, function() {
                    deleteCartItem($(this).data('item-id'));
                });
            } else if (touchEndX - touchStartX > 100) {
                // Swipe right - increment
                updateCart($(this).data('item-id'), 1);
            }
        });
    }

    // Verification and payment event handlers
    if (elements.verifyOrder) {
        elements.verifyOrder.on('click', function() {
            const phoneNumber = elements.confirmPhone.val().trim();
            if (!phoneNumber || phoneNumber.length < 8 || !/^\d+$/.test(phoneNumber)) {
                elements.verificationStatus
                    .html('<span style="color: #f44336;"><i class="fas fa-exclamation-circle"></i> Please enter a valid phone number (at least 8 digits).</span>')
                    .hide().fadeIn(200);
                
                // Shake effect on phone input
                elements.confirmPhone.addClass('shake');
                setTimeout(() => elements.confirmPhone.removeClass('shake'), 800);
                return;
            }

            // Add visual feedback
            $(this).addClass('pulse');
            setTimeout(() => $(this).removeClass('pulse'), 1000);

            elements.paymentModal.css('display', 'flex').hide().fadeIn(200);
            $('#paymentVerificationProgress').show();
            $('#paymentVerificationSuccess, #paymentVerificationFailed, #continueToCheckout, #tryAgainPayment').hide();

            setTimeout(() => {
                const isValid = true;
                $('#paymentVerificationProgress').fadeOut(200, function() {
                    if (isValid) {
                        $('#paymentVerificationSuccess, #continueToCheckout').fadeIn(200);
                        state.paymentVerified = true;
                        elements.verificationStatus
                            .html('<span style="color: #4caf50;"><i class="fas fa-check-circle"></i> Verification successful. Restaurant confirmation required next.</span>')
                            .hide().fadeIn(200);
                    } else {
                        $('#paymentVerificationFailed, #tryAgainPayment').fadeIn(200);
                        state.paymentVerified = false;
                        elements.verificationStatus
                            .html('<span style="color: #f44336;"><i class="fas fa-times-circle"></i> Verification failed. Please try again.</span>')
                            .hide().fadeIn(200);
                    }
                    updateCheckoutButtonState();
                });
            }, 1000);
        });
    }

    // Payment modal handlers
    if (elements.closePaymentModal) {
        elements.closePaymentModal.on('click', () => {
            elements.paymentModal.fadeOut(200);
        });
    }
    
    if (elements.continueToCheckout) {
        elements.continueToCheckout.on('click', () => {
            elements.paymentModal.fadeOut(200);
        });
    }
    
    if (elements.tryAgainPayment) {
        elements.tryAgainPayment.on('click', () => {
            elements.paymentModal.fadeOut(200);
        });
    }

    // Checkout button handler
    if (elements.checkoutButton) {
        elements.checkoutButton.on('click', function(e) {
            e.preventDefault();
            const cart = getCart();
            if (!Object.keys(cart).length) return alert('Your cart is empty.');
            if (!state.selectedPaymentMethod) return alert('Please select a payment method.');
            
            // Add visual feedback
            $(this).addClass('pulse');
            setTimeout(() => $(this).removeClass('pulse'), 1000);
            
            if (state.deliveryType === 'home' && state.selectedPaymentMethod === 'Cash on Delivery') {
                if (!state.homeDeliveryAddress.full_name || !state.homeDeliveryAddress.phone_number || !state.homeDeliveryAddress.address) {
                    alert('Please enter your full delivery address details.');
                    if (elements.openAddressModal) elements.openAddressModal.focus();
                    return;
                }
                if (!state.paymentVerified) {
                    alert('Please verify your order details first.');
                    if (elements.verifyOrder) elements.verifyOrder.focus();
                    return;
                }
                if (!state.adminConfirmed && !state.adminConfirmationInProgress) {
                    requestAdminConfirmation();
                    return;
                }
                if (state.adminConfirmationInProgress && !state.adminConfirmed) {
                    alert('Please wait for the restaurant to confirm your order.');
                    return;
                }
            }

            // Show loading overlay with smooth transition
            if (elements.loadingOverlay) {
                elements.loadingOverlay.addClass('active').css('opacity', 0).animate({opacity: 1}, 300);
            }
            loadingOverlayShownAt = Date.now();

            const formData = {
                cart: JSON.stringify(cart),
                payment_method: state.selectedPaymentMethod,
                delivery_type: state.deliveryType,
                table_number: state.deliveryType === 'restaurant' ? state.tableNumber : '',
                delivery_address: state.deliveryType === 'home' ? JSON.stringify(state.homeDeliveryAddress) : '',
                csrfmiddlewaretoken: $('input[name="csrfmiddlewaretoken"]').val()
            };

            const restaurantSlug = elements.checkoutButton.attr('data-restaurant-name-slug');
            const hashedSlug = elements.checkoutButton.attr('data-restaurant-hashed-slug');
            const checkoutUrl = `/menu/${restaurantSlug}/${hashedSlug}/checkout/`;

            // No processing toast - just use the loading overlay as you wanted

            $.ajax({
                url: checkoutUrl,
                type: 'POST',
                data: formData,
                headers: { 'X-CSRFToken': $('input[name="csrfmiddlewaretoken"]').val() },
                success: (response) => {
                    if (response.order_id) {
                        const orderId = response.order_id;
                        const successUrl = `/menu/${restaurantSlug}/${hashedSlug}/${orderId}/order_success/`;
                        
                        // Ensure minimum load time for better UX
                        const elapsed = Date.now() - loadingOverlayShownAt;
                        const remaining = Math.max(0, MIN_LOADING_DURATION - elapsed);
                        
                        setTimeout(() => {
                            // Keep loading overlay visible until redirect
                            window.location.href = successUrl;
                            localStorage.removeItem('cart');
                        }, remaining);
                    } else {
                        console.error('Order failed:', response);
                        if (elements.loadingOverlay) {
                            elements.loadingOverlay.animate({opacity: 0}, 300, function() {
                                $(this).removeClass('active');
                            });
                        }
                        
                        // Show a simple alert instead of toast
                        alert('Failed to place order: ' + (response.message || 'Unknown error'));
                    }
                },
                error: (xhr) => {
                    console.error('Order error:', xhr);
                    if (elements.loadingOverlay) {
                        elements.loadingOverlay.animate({opacity: 0}, 300, function() {
                            $(this).removeClass('active');
                        });
                    }
                    
                    // Show a simple alert instead of toast
                    const msg = xhr.responseJSON?.message || xhr.statusText || 'Unknown error';
                    alert('Error placing order: ' + msg);
                }
            });
        });
    }

    // 4. Add a better function to help debug order placement errors
function debugOrder() {
    try {
        const cart = getCart();
        console.log('Current cart:', cart);
        
        if (!Object.keys(cart).length) {
            console.error('Cart is empty');
            return false;
        }
        
        // Check if payment method is selected
        if (!state.selectedPaymentMethod) {
            console.error('No payment method selected');
            return false;
        }
        
        // Check address if home delivery
        if (state.deliveryType === 'home') {
            if (!state.homeDeliveryAddress.full_name || 
                !state.homeDeliveryAddress.phone_number || 
                !state.homeDeliveryAddress.address) {
                console.error('Missing delivery address info');
                return false;
            }
        }
        
        const restaurantSlug = elements.checkoutButton.attr('data-restaurant-name-slug');
        const hashedSlug = elements.checkoutButton.attr('data-restaurant-hashed-slug');
        
        if (!restaurantSlug || !hashedSlug) {
            console.error('Missing restaurant slug data');
            return false;
        }
        
        const formData = {
            cart: JSON.stringify(cart),
            payment_method: state.selectedPaymentMethod,
            delivery_type: state.deliveryType,
            table_number: state.deliveryType === 'restaurant' ? state.tableNumber : '',
            delivery_address: state.deliveryType === 'home' ? JSON.stringify(state.homeDeliveryAddress) : '',
            csrfmiddlewaretoken: $('input[name="csrfmiddlewaretoken"]').val()
        };
        
        console.log('Order data looks good:', formData);
        console.log('CSRF token:', $('input[name="csrfmiddlewaretoken"]').val());
        return true;
    } catch (e) {
        console.error('Error during order debug:', e);
        return false;
    }
}

    // Add periodic location updates for battery efficiency
    let lastVisibilityState = document.visibilityState;
    let updateIntervalId = null;
    
    function setupLocationUpdates() {
        if (updateIntervalId) clearInterval(updateIntervalId);
        
        // More frequent updates when visible
        if (document.visibilityState === 'visible') {
            updateIntervalId = setInterval(() => {
                if (!state.locationLoading && Date.now() - state.lastLocationUpdateTime > 120000) {
                    getUserLocation(1, false)
                        .then(() => updateMapWithUserLocation())
                        .catch(err => console.error("Error updating location:", err));
                }
            }, 120000); // Every 2 minutes when visible
        } else {
            // Less frequent updates when tab is not visible
            updateIntervalId = setInterval(() => {
                if (!state.locationLoading && Date.now() - state.lastLocationUpdateTime > 300000) {
                    getUserLocation(1, false)
                        .then(() => updateMapWithUserLocation())
                        .catch(err => console.error("Error updating location:", err));
                }
            }, 300000); // Every 5 minutes when not visible
        }
    }
    
    // Set up initial interval and adjust on visibility change
    setupLocationUpdates();
    
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== lastVisibilityState) {
            lastVisibilityState = document.visibilityState;
            setupLocationUpdates();
            
            // Immediately update location when tab becomes visible again
            if (document.visibilityState === 'visible' && 
                Date.now() - state.lastLocationUpdateTime > 60000) {
                getUserLocation(1, false)
                    .then(() => updateMapWithUserLocation())
                    .catch(err => console.error("Error updating location:", err));
            }
        }
    });
}

// Enhanced initialization with error handling
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Starting initialization');
    
    // Show initial loading indicator
    const initialLoadingToast = showToast('Initializing order system...', 'loading', 0);
    
    // Initialize all DOM elements
    elements = {
        checkoutButton: $('#checkoutButton'),
        openAddressModal: $('#openAddressModal'),
        addressModal: $('#addressModal'),
        closeAddressModal: $('#closeAddressModal'),
        saveAddress: $('#saveAddress'),
        cancelAddress: $('#cancelAddress'),
        loadingOverlay: $('#loading-overlay'),
        orderVerificationForm: $('#orderVerificationForm'),
        orderVerificationBox: $('#orderVerificationBox'),
        paymentModal: $('#paymentModal'),
        closePaymentModal: $('#closePaymentModal'),
        continueToCheckout: $('#continueToCheckout'),
        tryAgainPayment: $('#tryAgainPayment'),
        verifyOrder: $('#verifyOrder'),
        verificationStatus: $('#verificationStatus'),
        totalAmount: $('#mobileMoneyAmount'),
        confirmPhone: $('#confirmPhone'),
        modalFullName: $('#modal-full-name'),
        modalPhoneNumber: $('#modal-phone-number'),
        modalAddress: $('#modal-address'),
        orderDetailsList: $('#orderDetailsList'),
        itemTotal: $('#itemTotal'),
        cartTotal: $('#cartTotal'),
        deliverySwitchLabels: $('.delivery-switch-label'),
        paymentOptions: $('.payment-option'),
        distanceValue: $('#distanceValue'),
        distanceStatus: $('#distanceStatus')
    };

    // Initialize toast container
    initializeToastContainer();
    
    // Ensure cart is loaded
    ensureCartLoaded();
    
    // Update order details
    updateOrderDetails();
    
    // First try to get user location
    getUserLocation(1, false)
        .then(userLoc => {
            console.log('Initial location obtained:', userLoc);
            updateToast(initialLoadingToast, 'Loading map...', 'loading');
            
            // Then initialize map with this location
            return initializeMap()
                .then(() => {
                    console.log('Map initialized successfully');
                    // Map initialization will handle updating with user location
                });
        })
        .catch(err => {
            console.error('Error getting initial location:', err);
            updateToast(initialLoadingToast, 'Initializing map...', 'loading');
            
            // Try to initialize map anyway
            return initializeMap();
        })
        .then(() => {
            // Once map is initialized (with or without location), set up event handlers
            updateToast(initialLoadingToast, 'Setup complete!', 'nearby');
            setTimeout(() => removeToast(initialLoadingToast), 1000);
            setupEventHandlers();
        })
        .catch(err => {
            console.error('Error during initialization:', err);
            updateToast(initialLoadingToast, 'Error during setup. Trying to continue...', 'error');
            setTimeout(() => removeToast(initialLoadingToast), 3000);
            
            // Try to continue despite errors
            setupEventHandlers();
        });
});
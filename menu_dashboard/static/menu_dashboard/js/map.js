// Constants
const SERVICE_FEE = 0.25;
const DELIVERY_FEE = 0.00;
const THRESHOLD_DISTANCE = 300; // Increased from 100 to 300 meters
const ADMIN_CONFIRMATION_TIMEOUT = 60000; // 60 seconds
const LOCATION_TIMEOUT = 5000; // 5 seconds
const LOCATION_MAX_AGE = 30000; // 30 seconds
const AVERAGE_SPEED_KMH = 30; // Average delivery speed in km/h

// Add at the top of the file, after other constants
let loadingOverlayShownAt = 0;
const MIN_LOADING_DURATION = 3000; // 10 seconds

// Map state management
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
    homeDeliveryAddress: {},
    paymentVerified: false,
    adminConfirmed: false,
    adminConfirmationInProgress: false,
    orderReferenceId: null,
    tableNumber: '1',
    locationLoading: false
};

// DOM Elements cache - will be initialized when DOM is loaded
let elements;

// Set this to true to show debug UI, false for production
const DEBUG_MODE = false;

// Add toast notification styles
$('<style>')
    .text(`
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
        }
        .toast i {
            font-size: 16px;
        }
        .toast.loading i {
            color: #2196F3;
            animation: spin 1s linear infinite;
        }
        .toast.nearby i {
            color: #4CAF50;
        }
        .toast.far i {
            color: #FF9800;
        }
        .toast.error i {
            color: #f44336;
        }
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `)
    .appendTo('head');

// Initialize toast container
let toastContainer = null;

function initializeToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

function showToast(message, type = 'info') {
    const container = initializeToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'loading') icon = 'fa-spinner';
    else if (type === 'nearby') icon = 'fa-check-circle';
    else if (type === 'far') icon = 'fa-truck';
    else if (type === 'error') icon = 'fa-exclamation-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function calculateDistance(point1, point2) {
    // First try to use turf.js if available
    if (typeof turf !== 'undefined' && turf.distance) {
        return turf.distance(point1, point2, { units: 'meters' });
    }
    
    // Fallback to Haversine formula if turf.js is not available
    const toRad = (value) => value * Math.PI / 180;
    const R = 6371000; // Earth radius in meters
    
    const lat1 = point1[1]; // Extract latitude from [lng, lat] format
    const lon1 = point1[0]; // Extract longitude from [lng, lat] format
    const lat2 = point2[1];
    const lon2 = point2[0];
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    console.log('Fallback distance calculation:', distance, 'meters');
    return distance;
}

// Map Functions
async function initializeMap() {
    return new Promise((resolve, reject) => {
        if (!document.getElementById('map')) {
            console.error('Map container not found');
            reject(new Error('Map container not found'));
            return;
        }

        const checkoutButton = document.getElementById('checkoutButton');
        if (!checkoutButton) {
            console.error('Checkout button not found');
            reject(new Error('Checkout button not found'));
            return;
        }

        const restaurantLat = Number(checkoutButton.getAttribute('data-restaurant-lat'));
        const restaurantLon = Number(checkoutButton.getAttribute('data-restaurant-lon'));

        if (isNaN(restaurantLat) || isNaN(restaurantLon)) {
            console.error('Invalid restaurant coordinates', { restaurantLat, restaurantLon });
            reject(new Error('Invalid restaurant coordinates'));
            return;
        }

        state.restaurantLocation = [restaurantLon, restaurantLat];
        console.log('Restaurant location set:', state.restaurantLocation);

        // Check if mapboxgl is properly loaded
        if (typeof mapboxgl === 'undefined') {
            console.error('Mapbox GL JS is not loaded');
            reject(new Error('Mapbox GL JS is not loaded'));
            return;
        }

        // Verify access token is correct
        if (!mapboxgl.accessToken) {
            mapboxgl.accessToken = 'pk.eyJ1IjoibWl0Y2hlbGwyMzEiLCJhIjoiY205dGF0YXprMGFoajJrc2I5cDVvNnprZSJ9.LiQvQKUCOIe5fW0QYSOSFQ';
        }
        
        try {
            state.map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/streets-v11',
                center: state.restaurantLocation,
                zoom: 14,
                fadeDuration: 0 // Smoother rendering
            });

            console.log('Map creation attempted');

            state.map.on('load', () => {
                console.log('Map loaded successfully');
                
                const restaurantEl = document.createElement('div');
                restaurantEl.innerHTML = '<i class="fas fa-utensils fa-2x"></i>';
                restaurantEl.style.color = '#d32f2f';
                restaurantEl.style.textShadow = '0 0 3px #fff';

                state.restaurantMarker = new mapboxgl.Marker({ element: restaurantEl })
                    .setLngLat(state.restaurantLocation)
                    .setPopup(new mapboxgl.Popup().setHTML('<strong>Restaurant</strong>'))
                    .addTo(state.map);

                state.isMapInitialized = true;
                console.log('Map fully initialized with restaurant marker');
                
                // Only try to update with user location after map is initialized
                getUserLocation(1, true)
                    .then(userLocation => {
                        console.log('Got user location after map init:', userLocation);
                        updateMapWithUserLocation();
                    })
                    .catch(err => {
                        console.error('Failed to get user location after map init:', err);
                        // Still resolve the map initialization
                    });
                
                resolve();
            });

            state.map.on('error', (e) => {
                console.error('Mapbox error:', e.error);
                reject(e.error);
            });
        } catch (err) {
            console.error('Map initialization error:', err);
            reject(err);
        }
    });
}

async function getUserLocation(retries = 1, showNotification = true) {
    if (state.userLocation && !state.locationLoading) {
        console.log('Using cached user location:', state.userLocation);
        return Promise.resolve(state.userLocation);
    }
    
    state.locationLoading = true;
    // Only show toast notification if the parameter is true
    if (showNotification) {
        showToast('Detecting your location...', 'loading');
    }
    
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            state.locationLoading = false;
            showToast('Geolocation is not supported by your browser', 'error');
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.locationLoading = false;
                const userLoc = [position.coords.longitude, position.coords.latitude];
                state.userLocation = userLoc;
                // Log accuracy information for debugging
                console.log('Location accuracy:', position.coords.accuracy, 'meters');
                console.log('User location obtained:', userLoc);
                resolve(userLoc);
            },
            (error) => {
                state.locationLoading = false;
                console.error('Geolocation error:', error);
                
                // More detailed error message based on error code
                let errorMsg = 'Could not detect your location';
                if (error.code === 1) {
                    errorMsg = 'Location permission denied. Please enable location services.';
                } else if (error.code === 2) {
                    errorMsg = 'Location unavailable. Try moving to an area with better GPS signal.';
                } else if (error.code === 3) {
                    errorMsg = 'Location timed out. Please try again.';
                }
                
                showToast(errorMsg, 'error');
                
                if (error.code === 3 && retries > 0) {
                    console.log(`Location timed out. Retrying... (${retries} left)`);
                    setTimeout(() => {
                        getUserLocation(retries - 1, showNotification).then(resolve).catch(reject);
                    }, 1000);
                } else if (state.userLocation) {
                    // Fall back to last known location if available
                    console.log('Using last known location as fallback');
                    resolve(state.userLocation);
                } else {
                    reject(error);
                }
            },
            { 
                maximumAge: LOCATION_MAX_AGE, 
                timeout: LOCATION_TIMEOUT, 
                enableHighAccuracy: true 
            }
        );
    });
}

function formatDistance(meters) {
    if (meters >= 1000) {
        return (meters / 1000).toFixed(1) + 'km';
    }
    return Math.round(meters) + 'm';
}

function calculateDeliveryTime(distanceMeters) {
    const distanceKm = distanceMeters / 1000;
    const timeHours = distanceKm / AVERAGE_SPEED_KMH;
    const timeMinutes = Math.round(timeHours * 60);
    return Math.max(10, timeMinutes); // Minimum 10 minutes
}

function updateDeliveryTime(distanceMeters) {
    const timeMinutes = calculateDeliveryTime(distanceMeters);
    $('.estimated-delivery').html(`<i class="far fa-clock"></i> ~${timeMinutes} mins`);
}

async function updateMapWithUserLocation() {
    console.log('updateMapWithUserLocation called, map initialized:', state.isMapInitialized);
    
    if (!state.isMapInitialized) {
        console.log('Map not initialized yet, cannot update with user location');
        return;
    }

    try {
        // Pass false to prevent showing duplicate toast notifications
        const userLoc = await getUserLocation(1, false);
        console.log('User location for map update:', userLoc);
        
        if (state.userMarker) {
            console.log('Removing existing user marker');
            state.userMarker.remove();
        }
        
        // Create new user marker
        const userMarkerEl = document.createElement('div');
        userMarkerEl.innerHTML = '<i class="fas fa-user fa-lg"></i>';
        userMarkerEl.className = 'user-marker';
        userMarkerEl.style.color = '#03a9f4';
        userMarkerEl.style.textShadow = '0 0 3px #fff';
        
        state.userMarker = new mapboxgl.Marker({ element: userMarkerEl, draggable: false })
            .setLngLat(userLoc)
            .addTo(state.map);
        
        console.log('User marker added to map');

        // Create bounds that include both user and restaurant
        const bounds = new mapboxgl.LngLatBounds()
            .extend(userLoc)
            .extend(state.restaurantLocation);
            
        // Fit map to bounds with padding
        state.map.fitBounds(bounds, { 
            padding: 70,
            duration: 500 // animation time in milliseconds
        });

        // Calculate and update distance
        state.distanceToRestaurant = calculateDistance(userLoc, state.restaurantLocation);
        console.log('Distance to restaurant:', state.distanceToRestaurant, 'meters');
        console.log('Threshold distance:', THRESHOLD_DISTANCE, 'meters');

        // Debug info
        if (DEBUG_MODE) {
            if (!document.getElementById('debug-distance')) {
                const debugEl = document.createElement('div');
                debugEl.id = 'debug-distance';
                debugEl.style.position = 'fixed';
                debugEl.style.bottom = '10px';
                debugEl.style.left = '10px';
                debugEl.style.background = 'rgba(0,0,0,0.7)';
                debugEl.style.color = 'white';
                debugEl.style.padding = '8px';
                debugEl.style.borderRadius = '4px';
                debugEl.style.fontSize = '12px';
                debugEl.style.zIndex = '9999';
                document.body.appendChild(debugEl);
            }
            document.getElementById('debug-distance').textContent =
                `Distance: ${Math.round(state.distanceToRestaurant)}m | Threshold: ${THRESHOLD_DISTANCE}m`;
        } else {
            const dbg = document.getElementById('debug-distance');
            if (dbg) dbg.remove();
        }

        // Update delivery type based on distance
        const isAtRestaurant = state.distanceToRestaurant <= THRESHOLD_DISTANCE;
        const newDeliveryType = isAtRestaurant ? 'restaurant' : 'home';
        state.deliveryType = newDeliveryType;
        
        if (elements && elements.deliverySwitchLabels) {
            elements.deliverySwitchLabels.removeClass('active');
            $(`.delivery-switch-label[data-delivery-type="${newDeliveryType}"]`).addClass('active');

            // Show/hide appropriate elements based on delivery type
            if (isAtRestaurant) {
                $('.delivery-details-restaurant').removeClass('inactive').addClass('active');
                $('.delivery-details-home').removeClass('active').addClass('inactive');
                $('.table-info').show();
                showToast('You are at the restaurant!', 'nearby');
            } else {
                $('.delivery-details-restaurant').removeClass('active').addClass('inactive');
                $('.delivery-details-home').removeClass('inactive').addClass('active');
                $('.table-info').hide();
                showToast(formatDistance(state.distanceToRestaurant) + ' away', 'far');
                updateDeliveryTime(state.distanceToRestaurant);
            }

            updateDistanceDisplay(state.distanceToRestaurant);
            updatePaymentOptions();
        } else {
            console.warn('Elements not initialized yet, skipping UI updates');
        }
    } catch (err) {
        console.error('Error updating map with user location:', err);
        showToast('Error updating location', 'error');
    }
}

function updateDistanceDisplay(dist) {
    if (!elements || !elements.distanceValue || !elements.distanceStatus) {
        console.warn('Distance display elements not found');
        return;
    }
    
    if (dist === Infinity) {
        elements.distanceValue.html('<i class="fas fa-exclamation-circle"></i> Could not calculate distance');
        elements.distanceStatus.text('');
        elements.distanceStatus.removeClass('nearby far');
        return;
    }
    
    const distanceHtml = dist < 1000
        ? `<i class="fas fa-location-arrow"></i> ${Math.round(dist)} meters away`
        : `<i class="fas fa-location-arrow"></i> ${(dist / 1000).toFixed(1)} km away`;
    
    elements.distanceValue.html(distanceHtml);
    
    const statusText = dist <= THRESHOLD_DISTANCE
        ? '<i class="fas fa-check-circle"></i> You\'re at the restaurant!'
        : '<i class="fas fa-truck"></i> Delivery recommended';
    
    elements.distanceStatus
        .html(statusText)
        .toggleClass('nearby', dist <= THRESHOLD_DISTANCE)
        .toggleClass('far', dist > THRESHOLD_DISTANCE);
}

// Cart Management
function calculateCartTotal() {
    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
    let subtotal = 0;
    
    Object.entries(cart).forEach(([id, item]) => {
        subtotal += item[0] * parseFloat(item[2]);
    });
    
    return subtotal + SERVICE_FEE + DELIVERY_FEE;
}

function updateOrderDetails() {
    if (!elements || !elements.orderDetailsList) {
        console.warn('Order details elements not initialized yet');
        return;
    }
    
    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
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
        const [qty, name, price, img] = item;
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
    elements.itemTotal.text(`$${subtotal.toFixed(2)}`);
    elements.cartTotal.text(`$${totalDue.toFixed(2)}`);

    if (elements.orderVerificationBox && elements.orderVerificationBox.is(':visible')) {
        updateOrderTotalAmountDisplay(totalDue);
    }

    updateCheckoutButtonState();
}

function updateCart(id, delta) {
    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
    if (!cart[id]) return;

    cart[id][0] += delta;
    if (cart[id][0] < 1) delete cart[id];

    localStorage.setItem('cart', JSON.stringify(cart));
    if ('vibrate' in navigator) navigator.vibrate(30);
    updateOrderDetails();
}

function deleteCartItem(id) {
    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
    if (!cart[id]) return;

    delete cart[id];
    localStorage.setItem('cart', JSON.stringify(cart));
    if ('vibrate' in navigator) navigator.vibrate(50);
    updateOrderDetails();
}

// Payment and Delivery
function updatePaymentOptions() {
    if (!elements || !elements.paymentOptions) {
        console.warn('Payment elements not initialized yet');
        return;
    }
    
    state.selectedPaymentMethod = '';
    elements.paymentOptions.removeClass('selected active');

    if (state.deliveryType === 'restaurant') {
        $('.payment-option.restaurant-only').addClass('active');
        $('.payment-option[data-method="Cash on Delivery"].restaurant-only').addClass('selected');
        state.selectedPaymentMethod = 'Cash on Delivery';
        if (elements.orderVerificationBox) elements.orderVerificationBox.hide();
        state.paymentVerified = true;
        state.adminConfirmed = true;
        $('#cashDeliveryOption .order-verification-badge').remove();
        if (elements.verificationStatus) elements.verificationStatus.empty();
    } else {
        $('.payment-option.home-only').addClass('active');
        $('.payment-option[data-method="Cash on Delivery"].home-only').addClass('selected');
        state.selectedPaymentMethod = 'Cash on Delivery';
        if (elements.orderVerificationBox) elements.orderVerificationBox.show();
        state.paymentVerified = false;
        state.adminConfirmed = false;
        updateOrderTotalAmountDisplay(calculateCartTotal());
        if (elements.openAddressModal && 
            (!state.homeDeliveryAddress.full_name || 
            !state.homeDeliveryAddress.phone_number || 
            !state.homeDeliveryAddress.address)) {
            elements.openAddressModal.trigger('click');
        }
    }
    updateCheckoutButtonState();
}

function updateOrderTotalAmountDisplay(amount) {
    if (elements && elements.totalAmount) {
        elements.totalAmount.text(`$${amount.toFixed(2)}`);
    }
}

function updateCheckoutButtonState() {
    if (!elements || !elements.checkoutButton) {
        console.warn('Checkout button not initialized yet');
        return;
    }
    
    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
    const cartEmpty = !Object.keys(cart).length;
    const paymentSelected = !!state.selectedPaymentMethod;
    const addressEntered = state.deliveryType === 'restaurant' ? 
        true : 
        !!(state.homeDeliveryAddress.full_name && 
           state.homeDeliveryAddress.phone_number && 
           state.homeDeliveryAddress.address);

    const needsAdminConfirmation = state.deliveryType === 'home' && 
                                 state.selectedPaymentMethod === 'Cash on Delivery' && 
                                 !state.adminConfirmed;

    const disableButton = cartEmpty || !paymentSelected || 
                         (state.deliveryType === 'home' && !addressEntered) ||
                         needsAdminConfirmation;

    elements.checkoutButton.prop('disabled', disableButton);

    if (state.deliveryType === 'home') {
        if (!addressEntered) {
            elements.checkoutButton.text('Enter Delivery Address');
            if (elements.verifyOrder) elements.verifyOrder.prop('disabled', true);
            if (elements.confirmPhone) elements.confirmPhone.prop('disabled', true);
        } else if (!state.paymentVerified) {
            elements.checkoutButton.text('Verify Order First');
            if (elements.verifyOrder) elements.verifyOrder.prop('disabled', false);
            if (elements.confirmPhone) elements.confirmPhone.prop('disabled', false);
        } else if (needsAdminConfirmation && !state.adminConfirmationInProgress) {
            elements.checkoutButton.text('Request Restaurant Confirmation');
        } else if (state.adminConfirmationInProgress) {
            elements.checkoutButton.text('Waiting for Restaurant Confirmation...');
        } else {
            elements.checkoutButton.text('Place Order');
            if (elements.verifyOrder) elements.verifyOrder.prop('disabled', true);
            if (elements.confirmPhone) elements.confirmPhone.prop('disabled', true);
        }
    } else {
        elements.checkoutButton.text('Place Order');
    }
}

// Set initial delivery type based on active class
function setDeliveryType() {
    const activeLabel = $('.delivery-switch-label.active');
    if (activeLabel.length) {
        state.deliveryType = activeLabel.data('delivery-type');
        updatePaymentOptions();
    }
}

// Mock admin confirmation function (since it's not defined in your original code)
function requestAdminConfirmation() {
    if (!elements || !elements.checkoutButton) return;
    
    state.adminConfirmationInProgress = true;
    elements.checkoutButton.text('Waiting for Restaurant Confirmation...');
    elements.checkoutButton.prop('disabled', true);
    
    // Mock confirmation delay
    setTimeout(() => {
        state.adminConfirmed = true;
        state.adminConfirmationInProgress = false;
        
        elements.verificationStatus.html('<span style="color: #4caf50;">Restaurant confirmed your order. Ready to proceed.</span>');
        if ($('#cashDeliveryOption').length) {
            if (!$('#cashDeliveryOption .admin-confirmation-badge').length) {
                $('#cashDeliveryOption').append('<span class="admin-confirmation-badge" style="margin-left:5px;color:#4CAF50;"><i class="fas fa-check-circle"></i></span>');
            }
        }
        
        updateCheckoutButtonState();
    }, ADMIN_CONFIRMATION_TIMEOUT);
}

// Event Handlers
function setupEventHandlers() {
    if (!elements) {
        console.error('Elements not initialized when setting up event handlers');
        return;
    }
    
    elements.deliverySwitchLabels.on('click', function () {
        const wanted = $(this).data('delivery-type');
        if (state.deliveryType === wanted) return;

        if (state.deliveryType === 'restaurant') {
            alert("You must be detected as being at the restaurant for 'Eat-in' delivery.");
        } else {
            alert("Delivery type is determined by your location relative to the restaurant. You cannot manually switch to 'Eat-in' if you are not detected nearby.");
        }
        
        elements.deliverySwitchLabels.removeClass('active');
        $(`.delivery-switch-label[data-delivery-type="${state.deliveryType}"]`).addClass('active');
    });

    elements.openAddressModal.on('click', () => {
        elements.modalFullName.val(state.homeDeliveryAddress.full_name || '');
        elements.modalPhoneNumber.val(state.homeDeliveryAddress.phone_number || '');
        elements.modalAddress.val(state.homeDeliveryAddress.address || '');
        elements.addressModal.addClass('active');
    });
    
    elements.closeAddressModal.on('click', () => elements.addressModal.removeClass('active'));
    elements.cancelAddress.on('click', () => elements.addressModal.removeClass('active'));
    
    elements.saveAddress.on('click', () => {
        const full = elements.modalFullName.val().trim();
        const phone = elements.modalPhoneNumber.val().trim();
        const addr = elements.modalAddress.val().trim();
        
        if (!full || !phone || !addr) {
            alert('Please fill in all fields for delivery address.');
            return;
        }
        
        state.homeDeliveryAddress = { full_name: full, phone_number: phone, address: addr };
        elements.addressModal.removeClass('active');

        if (elements.confirmPhone.val().trim() === '') {
            elements.confirmPhone.val(phone);
        }

        updateCheckoutButtonState();
    });

    elements.paymentOptions.on('click', function () {
        if (!$(this).hasClass('active')) return;

        elements.paymentOptions.removeClass('selected');
        $(this).addClass('selected');
        state.selectedPaymentMethod = $(this).data('method');

        if (state.deliveryType === 'home') {
            state.paymentVerified = false;
            state.adminConfirmed = false;
            $('#cashDeliveryOption .order-verification-badge, #cashDeliveryOption .admin-confirmation-badge').remove();
            elements.verificationStatus.empty();
        }

        updateCheckoutButtonState();
        if ('vibrate' in navigator) navigator.vibrate(50);
    });

    elements.orderDetailsList.on('click', '.increment-item', function() {
        const itemId = $(this).closest('.order-item').data('item-id');
        updateCart(itemId, +1);
    });

    elements.orderDetailsList.on('click', '.decrement-item', function() {
        const itemId = $(this).closest('.order-item').data('item-id');
        updateCart(itemId, -1);
    });

    elements.orderDetailsList.on('click', '.delete-item', function() {
        const itemId = $(this).closest('.order-item').data('item-id');
        deleteCartItem(itemId);
    });

    if (elements.verifyOrder) {
        elements.verifyOrder.on('click', function() {
            const phoneNumber = elements.confirmPhone.val().trim();

            if (!phoneNumber || phoneNumber.length < 8 || !/^\d+$/.test(phoneNumber)) {
                elements.verificationStatus.html('<span style="color: #f44336;">Please enter a valid phone number (at least 8 digits).</span>');
                return;
            }

            elements.paymentModal.css('display', 'flex');
            $('#paymentVerificationProgress').show();
            $('#paymentVerificationSuccess, #paymentVerificationFailed').hide();
            $('#continueToCheckout, #tryAgainPayment').hide();

            setTimeout(() => {
                const isValid = true;
                $('#paymentVerificationProgress').hide();

                if (isValid) {
                    $('#paymentVerificationSuccess, #continueToCheckout').show();
                    state.paymentVerified = true;
                    elements.verificationStatus.html('<span style="color: #4caf50;">Verification successful. Restaurant confirmation required next.</span>');
                } else {
                    $('#paymentVerificationFailed, #tryAgainPayment').show();
                    state.paymentVerified = false;
                    elements.verificationStatus.html('<span style="color: #f44336;">Verification failed. Please try again.</span>');
                }
                
                updateCheckoutButtonState();
            }, 1000);
        });
    }

    if (elements.checkoutButton) {
        elements.checkoutButton.on('click', function(e) {
            e.preventDefault();
            console.log('Checkout button clicked');

            const cart = JSON.parse(localStorage.getItem('cart') || '{}');
            if (Object.keys(cart).length === 0) {
                alert('Your cart is empty.');
                return;
            }
            if (!state.selectedPaymentMethod) {
                alert('Please select a payment method.');
                return;
            }
            if (state.deliveryType === 'home' && state.selectedPaymentMethod === 'Cash on Delivery') {
                if (!state.homeDeliveryAddress.full_name ||
                    !state.homeDeliveryAddress.phone_number ||
                    !state.homeDeliveryAddress.address) {
                    alert('Please enter your full delivery address details.');
                    elements.openAddressModal.focus();
                    return;
                }
                if (!state.paymentVerified) {
                    alert('Please verify your order details first.');
                    elements.verifyOrder.focus();
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

            elements.loadingOverlay.addClass('active');
            loadingOverlayShownAt = Date.now();
            console.log('Sending order request...');

            const formData = {
                cart: JSON.stringify(cart),
                payment_method: state.selectedPaymentMethod,
                csrfmiddlewaretoken: $('input[name="csrfmiddlewaretoken"]').val()
            };

            const restaurantSlug = elements.checkoutButton.attr('data-restaurant-name-slug');
            const hashedSlug = elements.checkoutButton.attr('data-restaurant-hashed-slug');
            const checkoutUrl = `/menu/${restaurantSlug}/${hashedSlug}/checkout/`;

            $.ajax({
                url: checkoutUrl,
                type: 'POST',
                data: formData,
                headers: {
                    'X-CSRFToken': $('input[name="csrfmiddlewaretoken"]').val()
                },
                success: function(response) {
                    console.log('Order response:', response);
                    
                    if (response.order_id) {
                        const orderId = response.order_id;
                        const successUrl = `/menu/${restaurantSlug}/${hashedSlug}/${orderId}/order_success/`;
                        
                        // Calculate remaining time to show loading overlay
                        const elapsed = Date.now() - loadingOverlayShownAt;
                        const remaining = Math.max(0, MIN_LOADING_DURATION - elapsed);
                        
                        // Only redirect after minimum loading duration
                        setTimeout(function(){
                            elements.loadingOverlay.removeClass('active');
                            window.location.href = successUrl;
                            localStorage.removeItem('cart');
                        }, remaining);
                    } else {
                        console.error('Order placement failed:', response);
                        elements.loadingOverlay.removeClass('active');
                        alert('Order placement failed: ' + (response.message || 'Unknown error'));
                    }
                },
                error: function(xhr) {
                    console.error('Order placement error:', xhr);
                    elements.loadingOverlay.removeClass('active');
                    const msg = xhr.responseJSON?.message || xhr.statusText;
                    alert('An error occurred while placing the order: ' + msg);
                }
            });
        });
    }
    
    // Close payment modal handlers
    if (elements.closePaymentModal) {
        elements.closePaymentModal.on('click', () => elements.paymentModal.hide());
    }
    
    if (elements.continueToCheckout) {
        elements.continueToCheckout.on('click', () => {
            elements.paymentModal.hide();
            updateCheckoutButtonState();
        });
    }
    
    if (elements.tryAgainPayment) {
        elements.tryAgainPayment.on('click', () => elements.paymentModal.hide());
    }
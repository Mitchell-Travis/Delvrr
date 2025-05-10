// Constants
const SERVICE_FEE = 0.25;
const DELIVERY_FEE = 0.00;
const THRESHOLD_DISTANCE = 500; // Increased from 300 to 500 meters for better detection
const ADMIN_CONFIRMATION_TIMEOUT = 60000; // 60 seconds
const LOCATION_TIMEOUT = 10000; // 10 seconds
const LOCATION_MAX_AGE = 30000; // 30 seconds
const AVERAGE_SPEED_KMH = 30; // km/h
const MIN_LOADING_DURATION = 3000; // 3 seconds

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
    deliveryTypeUserOverride: null, // NEW: Allow user to override automatic selection
    homeDeliveryAddress: {},
    paymentVerified: false,
    adminConfirmed: false,
    adminConfirmationInProgress: false,
    orderReferenceId: null,
    tableNumber: '1',
    locationLoading: false,
    locationAttempts: 0,
    lastLocationUpdateTime: 0
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
    }
    .toast i { font-size: 16px; }
    .toast.loading i { color: #2196F3; animation: spin 1s linear infinite; }
    .toast.nearby i { color: #4CAF50; }
    .toast.far i { color: #FF9800; }
    .toast.error i { color: #f44336; }
    .delivery-switch-label.manual-override {
        border: 2px solid #4CAF50 !important;
    }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`).appendTo('head');

// Toast container
let toastContainer = null;

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
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'loading') icon = 'fa-spinner';
    else if (type === 'nearby') icon = 'fa-check-circle';
    else if (type === 'far') icon = 'fa-truck';
    else if (type === 'error') icon = 'fa-exclamation-circle';
    
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function calculateDistance(point1, point2) {
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
    
    return distance;
}

async function initializeMap() {
    return new Promise((resolve, reject) => {
        if (!document.getElementById('map')) return reject(new Error('Map container not found'));
        const checkoutButton = document.getElementById('checkoutButton');
        if (!checkoutButton) return reject(new Error('Checkout button not found'));

        const restaurantLat = Number(checkoutButton.getAttribute('data-restaurant-lat'));
        const restaurantLon = Number(checkoutButton.getAttribute('data-restaurant-lon'));
        if (isNaN(restaurantLat) || isNaN(restaurantLon)) return reject(new Error('Invalid restaurant coordinates'));

        state.restaurantLocation = [restaurantLon, restaurantLat];
        mapboxgl.accessToken = 'pk.eyJ1IjoibWl0Y2hlbGwyMzEiLCJhIjoiY205dGF0YXprMGFoajJrc2I5cDVvNnprZSJ9.LiQvQKUCOIe5fW0QYSOSFQ';

        try {
            state.map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/streets-v11',
                center: state.restaurantLocation,
                zoom: 14
            });

            state.map.on('load', () => {
                const restaurantEl = document.createElement('div');
                restaurantEl.innerHTML = '<i class="fas fa-utensils fa-2x"></i>';
                restaurantEl.style.color = '#d32f2f';
                restaurantEl.style.textShadow = '0 0 3px #fff';

                state.restaurantMarker = new mapboxgl.Marker({ element: restaurantEl })
                    .setLngLat(state.restaurantLocation)
                    .setPopup(new mapboxgl.Popup().setHTML('<strong>Restaurant</strong>'))
                    .addTo(state.map);

                state.isMapInitialized = true;
                resolve();
                updateMapWithUserLocation();
            });

            state.map.on('error', (e) => reject(e.error));
        } catch (err) {
            reject(err);
        }
    });
}

async function getUserLocation(retries = 2, showNotification = true) {
    // If we have a recent location (less than 2 minutes old), use it
    const now = Date.now();
    if (state.userLocation && 
        state.lastLocationUpdateTime > 0 && 
        now - state.lastLocationUpdateTime < 120000 && 
        !state.locationLoading) {
        return Promise.resolve(state.userLocation);
    }
    
    state.locationLoading = true;
    state.locationAttempts++;
    
    if (showNotification) {
        showToast('Detecting your location...', 'loading', 10000);
    }
    
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            state.locationLoading = false;
            showToast('Geolocation is not supported by your browser', 'error');
            return reject(new Error('Geolocation not supported'));
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.locationLoading = false;
                const userLoc = [position.coords.longitude, position.coords.latitude];
                state.userLocation = userLoc;
                state.lastLocationUpdateTime = now;
                console.log('Location accuracy:', position.coords.accuracy, 'meters');
                resolve(userLoc);
            },
            (error) => {
                state.locationLoading = false;
                console.error('Geolocation error:', error);
                
                let errorMsg = 'Could not detect your location';
                if (error.code === 1) errorMsg = 'Location permission denied. Please enable location services in your browser settings.';
                else if (error.code === 2) errorMsg = 'Location unavailable. Try moving to an area with better GPS signal.';
                else if (error.code === 3) errorMsg = 'Location request timed out. Please ensure location services are enabled and try again.';
                
                if (state.locationAttempts <= 1) {
                    showToast(errorMsg, 'error');
                }
                
                if (error.code === 3 && retries > 0) {
                    setTimeout(() => getUserLocation(retries - 1, showNotification).then(resolve).catch(reject), 1000);
                } else if (state.userLocation) {
                    console.log('Using last known location as fallback');
                    resolve(state.userLocation);
                } else {
                    // If we can't get location, default to home delivery
                    if (!state.deliveryTypeUserOverride) {
                        state.deliveryType = 'home';
                        updateDeliveryTypeUI();
                    }
                    reject(error);
                }
            },
            { maximumAge: LOCATION_MAX_AGE, timeout: LOCATION_TIMEOUT, enableHighAccuracy: true }
        );
    });
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

async function updateMapWithUserLocation() {
    if (!state.isMapInitialized) return;

    try {
        const userLoc = await getUserLocation(1, false);
        console.log('User location:', userLoc);
        if (state.userMarker) state.userMarker.remove();
        state.userMarker = new mapboxgl.Marker({ color: '#03a9f4' })
            .setLngLat(userLoc)
            .addTo(state.map);

        const bounds = new mapboxgl.LngLatBounds().extend(userLoc).extend(state.restaurantLocation);
        state.map.fitBounds(bounds, { padding: 70 });

        state.distanceToRestaurant = calculateDistance(userLoc, state.restaurantLocation);
        console.log('Distance to restaurant:', state.distanceToRestaurant, 'meters');

        // Only auto-determine delivery type if the user hasn't manually overridden it
        if (state.deliveryTypeUserOverride === null) {
            const isAtRestaurant = state.distanceToRestaurant <= THRESHOLD_DISTANCE;
            state.deliveryType = isAtRestaurant ? 'restaurant' : 'home';
        }
        
        updateDeliveryTypeUI();
        updateDistanceDisplay(state.distanceToRestaurant);
        
        // Show automatic detection toast with option to override
        if (state.deliveryType === 'restaurant' && state.distanceToRestaurant <= THRESHOLD_DISTANCE) {
            showToast('You are at the restaurant!', 'nearby');
        } else if (state.deliveryType === 'home' && state.distanceToRestaurant > THRESHOLD_DISTANCE) {
            showToast(`${formatDistance(state.distanceToRestaurant)} away from restaurant`, 'far');
            updateDeliveryTime(state.distanceToRestaurant);
        }
    } catch (err) {
        console.error('Geo error for map:', err);
        showToast('Error updating location', 'error');
        // Default to home delivery if location fails
        if (!state.deliveryTypeUserOverride) {
            state.deliveryType = 'home';
            updateDeliveryTypeUI();
        }
    }
}

function updateDeliveryTypeUI() {
    // Update delivery switch labels
    elements.deliverySwitchLabels.removeClass('active manual-override');
    const currentTypeLabel = $(`.delivery-switch-label[data-delivery-type="${state.deliveryType}"]`);
    currentTypeLabel.addClass('active');
    
    // If user has manually overridden, show that visually
    if (state.deliveryTypeUserOverride !== null) {
        currentTypeLabel.addClass('manual-override');
    }

    // Update delivery details sections
    if (state.deliveryType === 'restaurant') {
        $('.delivery-details-restaurant').removeClass('inactive').addClass('active');
        $('.delivery-details-home').removeClass('active').addClass('inactive');
        $('.table-info').show();
    } else {
        $('.delivery-details-restaurant').removeClass('active').addClass('inactive');
        $('.delivery-details-home').removeClass('inactive').addClass('active');
        $('.table-info').hide();
    }
    
    updatePaymentOptions();
}

function updateDistanceDisplay(dist) {
    if (!elements.distanceValue || !elements.distanceStatus) {
        console.error('Distance display elements not found');
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
    
    elements.distanceValue.html(distanceHtml);
    
    const isNearby = dist <= THRESHOLD_DISTANCE;
    const statusText = isNearby
        ? '<i class="fas fa-check-circle"></i> You\'re at the restaurant!'
        : '<i class="fas fa-truck"></i> Delivery recommended';
    
    elements.distanceStatus.html(statusText)
        .toggleClass('nearby', isNearby)
        .toggleClass('far', !isNearby);
}

function calculateCartTotal() {
    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
    let subtotal = 0;
    Object.entries(cart).forEach(([_, item]) => subtotal += item[0] * parseFloat(item[2]));
    return subtotal + SERVICE_FEE + DELIVERY_FEE;
}

function updateOrderDetails() {
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

    items.forEach(([id, [qty, name, price, img]]) => {
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

    if (elements.orderVerificationBox.is(':visible')) updateOrderTotalAmountDisplay(totalDue);
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

function updatePaymentOptions() {
    state.selectedPaymentMethod = '';
    elements.paymentOptions.removeClass('selected active');

    if (state.deliveryType === 'restaurant') {
        $('.payment-option.restaurant-only').addClass('active');
        $('.payment-option[data-method="Cash on Delivery"].restaurant-only').addClass('selected');
        state.selectedPaymentMethod = 'Cash on Delivery';
        elements.orderVerificationBox.hide();
        state.paymentVerified = true;
        state.adminConfirmed = true;
        $('#cashDeliveryOption .order-verification-badge').remove();
        elements.verificationStatus.empty();
    } else {
        $('.payment-option.home-only').addClass('active');
        $('.payment-option[data-method="Cash on Delivery"].home-only').addClass('selected');
        state.selectedPaymentMethod = 'Cash on Delivery';
        elements.orderVerificationBox.show();
        state.paymentVerified = false;
        state.adminConfirmed = false;
        updateOrderTotalAmountDisplay(calculateCartTotal());
        if (!state.homeDeliveryAddress.full_name || !state.homeDeliveryAddress.phone_number || !state.homeDeliveryAddress.address) {
            elements.openAddressModal.trigger('click');
        }
    }
    updateCheckoutButtonState();
}

function updateOrderTotalAmountDisplay(amount) {
    elements.totalAmount.text(`$${amount.toFixed(2)}`);
}

function updateCheckoutButtonState() {
    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
    const cartEmpty = !Object.keys(cart).length;
    const paymentSelected = !!state.selectedPaymentMethod;
    const addressEntered = state.deliveryType === 'restaurant' || 
                          (state.homeDeliveryAddress.full_name && state.homeDeliveryAddress.phone_number && state.homeDeliveryAddress.address);
    const needsAdminConfirmation = state.deliveryType === 'home' && state.selectedPaymentMethod === 'Cash on Delivery' && !state.adminConfirmed;

    const disableButton = cartEmpty || !paymentSelected || !addressEntered || needsAdminConfirmation;
    elements.checkoutButton.prop('disabled', disableButton);

    if (state.deliveryType === 'home') {
        if (!addressEntered) elements.checkoutButton.text('Enter Delivery Address');
        else if (!state.paymentVerified) elements.checkoutButton.text('Verify Order First');
        else if (needsAdminConfirmation && !state.adminConfirmationInProgress) elements.checkoutButton.text('Request Restaurant Confirmation');
        else if (state.adminConfirmationInProgress) elements.checkoutButton.text('Waiting for Restaurant Confirmation...');
        else elements.checkoutButton.text('Place Order');
        
        elements.verifyOrder.prop('disabled', !addressEntered);
        elements.confirmPhone.prop('disabled', !addressEntered);
    } else {
        elements.checkoutButton.text('Place Order');
    }
}

function refreshLocation() {
    // Clear the last location update time to force a new location fetch
    state.lastLocationUpdateTime = 0;
    showToast('Updating your location...', 'loading');
    getUserLocation(1, false).then(() => {
        updateMapWithUserLocation();
    }).catch(err => {
        console.error("Error refreshing location:", err);
        showToast('Could not update your location', 'error');
    });
}

function setupEventHandlers() {
    // Add a new refresh location button
    const refreshButton = $('<button id="refreshLocation" class="btn btn-sm btn-outline-primary mb-2" style="margin-left: 10px;"><i class="fas fa-sync-alt"></i> Refresh Location</button>');
    $('#distanceValue').after(refreshButton);
    
    $('#refreshLocation').on('click', function(e) {
        e.preventDefault();
        refreshLocation();
    });

    elements.deliverySwitchLabels.on('click', function() {
        const wantedType = $(this).data('delivery-type');
        if (state.deliveryType === wantedType) return;
        
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
        
        if (!full || !phone || !addr) return alert('Please fill in all fields for delivery address.');
        
        state.homeDeliveryAddress = { full_name: full, phone_number: phone, address: addr };
        elements.addressModal.removeClass('active');
        if (!elements.confirmPhone.val().trim()) elements.confirmPhone.val(phone);
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
        updateCart($(this).closest('.order-item').data('item-id'), 1);
    });

    elements.orderDetailsList.on('click', '.decrement-item', function() {
        updateCart($(this).closest('.order-item').data('item-id'), -1);
    });

    elements.orderDetailsList.on('click', '.delete-item', function() {
        deleteCartItem($(this).closest('.order-item').data('item-id'));
    });

    elements.verifyOrder.on('click', function() {
        const phoneNumber = elements.confirmPhone.val().trim();
        if (!phoneNumber || phoneNumber.length < 8 || !/^\d+$/.test(phoneNumber)) {
            elements.verificationStatus.html('<span style="color: #f44336;">Please enter a valid phone number (at least 8 digits).</span>');
            return;
        }

        elements.paymentModal.css('display', 'flex');
        $('#paymentVerificationProgress').show();
        $('#paymentVerificationSuccess, #paymentVerificationFailed, #continueToCheckout, #tryAgainPayment').hide();

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

    elements.checkoutButton.on('click', function(e) {
        e.preventDefault();
        const cart = JSON.parse(localStorage.getItem('cart') || '{}');
        if (!Object.keys(cart).length) return alert('Your cart is empty.');
        if (!state.selectedPaymentMethod) return alert('Please select a payment method.');
        
        if (state.deliveryType === 'home' && state.selectedPaymentMethod === 'Cash on Delivery') {
            if (!state.homeDeliveryAddress.full_name || !state.homeDeliveryAddress.phone_number || !state.homeDeliveryAddress.address) {
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

        $.ajax({
            url: checkoutUrl,
            type: 'POST',
            data: formData,
            headers: { 'X-CSRFToken': $('input[name="csrfmiddlewaretoken"]').val() },
            success: (response) => {
                if (response.order_id) {
                    const orderId = response.order_id;
                    const successUrl = `/menu/${restaurantSlug}/${hashedSlug}/${orderId}/order_success/`;
                    const elapsed = Date.now() - loadingOverlayShownAt;
                    const remaining = Math.max(0, MIN_LOADING_DURATION - elapsed);
                    setTimeout(() => {
                        elements.loadingOverlay.removeClass('active');
                        window.location.href = successUrl;
                        localStorage.removeItem('cart');
                    }, remaining);
                } else {
                    elements.loadingOverlay.removeClass('active');
                    alert('Order placement failed: ' + (response.message || 'Unknown error'));
                }
            },
            error: (xhr) => {
                elements.loadingOverlay.removeClass('active');
                const msg = xhr.responseJSON?.message || xhr.statusText;
                alert('An error occurred while placing the order: ' + msg);
            }
        });
    });

    // Close payment modal handlers
    elements.closePaymentModal.on('click', () => elements.paymentModal.css('display', 'none'));
    elements.continueToCheckout.on('click', () => elements.paymentModal.css('display', 'none'));
    elements.tryAgainPayment.on('click', () => elements.paymentModal.css('display', 'none'));

    // Add automatic location updates every 2 minutes
    setInterval(() => {
        if (document.visibilityState === 'visible' && !state.locationLoading) {
            console.log("Periodic location update");
            getUserLocation(1, false).then(() => {
                updateMapWithUserLocation();
            }).catch(err => {
                console.error("Error updating location:", err);
            });
        }
    }, 120000); // Every 2 minutes
}

document.addEventListener('DOMContentLoaded', () => {
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

    initializeToastContainer();
    setupEventHandlers();
    updateOrderDetails();

    getUserLocation(1, true).then(() => initializeMap()).catch((err) => {
        console.error('Error getting initial location:', err);
        initializeMap();
    });
});

// Placeholder for requestAdminConfirmation (assumed to be defined elsewhere)
function requestAdminConfirmation() {
    console.log('Requesting admin confirmation...');
    state.adminConfirmationInProgress = true;
    updateCheckoutButtonState();
    setTimeout(() => {
        state.adminConfirmed = true;
        state.adminConfirmationInProgress = false;
        updateCheckoutButtonState();
    }, 2000); // Simulated delay
}
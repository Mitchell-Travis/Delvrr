// Constants
const SERVICE_FEE = 0.25;
const DELIVERY_FEE = 0.00;
const THRESHOLD_DISTANCE = 100; // meters
const ADMIN_CONFIRMATION_TIMEOUT = 60000; // 60 seconds

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
    tableNumber: '1'
};

// DOM Elements cache
const elements = {
    checkoutButton: $('#checkoutButton'),
    openAddressModal: $('#openAddressModal'),
    addressModal: $('#addressModal'),
    closeAddressModal: $('#closeAddressModal'),
    saveAddress: $('#saveAddress'),
    cancelAddress: $('#cancelAddress'),
    loadingOverlay: $('#loading-overlay'),
    orderVerificationForm: $('#orderVerificationForm'),
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
    mapContainer: document.getElementById('map-container'),
    toggleMapButton: document.getElementById('toggleMap'),
    distanceValue: $('.distance-value'),
    distanceStatus: $('#distanceStatus'),
    orderDetailsList: $('#orderDetailsList'),
    itemTotal: $('#itemTotal'),
    cartTotal: $('#cartTotal'),
    deliverySwitchLabels: $('.delivery-switch-label'),
    paymentOptions: $('.payment-option')
};

// Map Functions
async function initializeMap() {
    return new Promise((resolve, reject) => {
        if (!document.getElementById('map')) {
            reject(new Error('Map container not found'));
            return;
        }

        const checkoutButton = document.getElementById('checkoutButton');
        if (!checkoutButton) {
            reject(new Error('Checkout button not found'));
            return;
        }

        const restaurantLat = parseFloat(checkoutButton.getAttribute('data-restaurant-lat'));
        const restaurantLon = parseFloat(checkoutButton.getAttribute('data-restaurant-lon'));

        if (isNaN(restaurantLat) || isNaN(restaurantLon)) {
            reject(new Error('Invalid restaurant coordinates'));
            return;
        }

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

async function getUserLocation(retries = 1) {
    if (state.userLocation) {
        return Promise.resolve(state.userLocation);
    }
    
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLoc = [position.coords.longitude, position.coords.latitude];
                state.userLocation = userLoc;
                resolve(userLoc);
            },
            (error) => {
                if (error.code === 3 && retries > 0) {
                    setTimeout(() => {
                        getUserLocation(retries - 1).then(resolve).catch(reject);
                    }, 1000);
                } else {
                    reject(error);
                }
            },
            { maximumAge: 60000, timeout: 10000, enableHighAccuracy: true }
        );
    });
}

async function updateMapWithUserLocation() {
    if (!state.isMapInitialized) return;

    try {
        const userLoc = await getUserLocation();
        
        const userEl = document.createElement('div');
        userEl.innerHTML = '<i class="fas fa-user fa-2x"></i>';
        userEl.style.color = '#1976d2';
        userEl.style.textShadow = '0 0 3px #fff';
        
        if (state.userMarker) state.userMarker.remove();
        
        state.userMarker = new mapboxgl.Marker({ element: userEl })
            .setLngLat(userLoc)
            .setPopup(new mapboxgl.Popup().setHTML('<strong>Your Location</strong>'))
            .addTo(state.map);

        const bounds = new mapboxgl.LngLatBounds()
            .extend(userLoc)
            .extend(state.restaurantLocation);
            
        state.map.fitBounds(bounds, { padding: 70 });

        const routeGeoJSON = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [userLoc, state.restaurantLocation]
            }
        };
        
        if (state.map.getSource('route')) {
            state.map.getSource('route').setData(routeGeoJSON);
        } else {
            state.map.addSource('route', { type: 'geojson', data: routeGeoJSON });
            state.map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#03a9f4', 'line-width': 3, 'line-dasharray': [2, 1] }
            });
        }

        state.distanceToRestaurant = calculateDistance(userLoc, state.restaurantLocation);
        updateDistanceDisplay(state.distanceToRestaurant);

    } catch (err) {
        console.error('Geo error for map:', err);
        elements.distanceValue.text('Could not determine your location for map');
        elements.distanceStatus.text('').removeClass('nearby far');
    }
}

function calculateDistance(point1, point2) {
    return turf.distance(point1, point2, { units: 'meters' });
}

function updateDistanceDisplay(dist) {
    if (dist === Infinity) {
        elements.distanceValue.text('Could not calculate distance');
        elements.distanceStatus.text('');
        elements.distanceStatus.removeClass('nearby far');
        return;
    }
    
    elements.distanceValue.text(dist < 1000
        ? `${Math.round(dist)} meters away`
        : `${(dist / 1000).toFixed(1)} km away`
    );
    
    elements.distanceStatus
        .text(dist <= THRESHOLD_DISTANCE
            ? "You're at the restaurant!"
            : "Delivery recommended"
        )
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

    if (elements.orderVerificationForm.is(':visible')) {
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
    state.selectedPaymentMethod = '';
    elements.paymentOptions.removeClass('selected active');

    if (state.deliveryType === 'restaurant') {
        $('.payment-option.restaurant-only').addClass('active');
        $('.payment-option[data-method="Cash on Delivery"].restaurant-only').addClass('selected');
        state.selectedPaymentMethod = 'Cash on Delivery';
        elements.orderVerificationForm.hide();
        state.paymentVerified = true;
        state.adminConfirmed = true;
        $('#cashDeliveryOption .order-verification-badge').remove();
        elements.verificationStatus.empty();
    } else {
        $('.payment-option.home-only').addClass('active');
        $('.payment-option[data-method="Cash on Delivery"].home-only').addClass('selected');
        state.selectedPaymentMethod = 'Cash on Delivery';
        elements.orderVerificationForm.show();
        state.paymentVerified = false;
        state.adminConfirmed = false;
        updateOrderTotalAmountDisplay(calculateCartTotal());
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
            elements.verifyOrder.prop('disabled', true);
            elements.confirmPhone.prop('disabled', true);
        } else if (!state.paymentVerified) {
            elements.checkoutButton.text('Verify Order First');
            elements.verifyOrder.prop('disabled', false);
            elements.confirmPhone.prop('disabled', false);
        } else if (needsAdminConfirmation && !state.adminConfirmationInProgress) {
            elements.checkoutButton.text('Request Restaurant Confirmation');
        } else if (state.adminConfirmationInProgress) {
            elements.checkoutButton.text('Waiting for Restaurant Confirmation...');
        } else {
            elements.checkoutButton.text('Place Order');
            elements.verifyOrder.prop('disabled', true);
            elements.confirmPhone.prop('disabled', true);
        }
    } else {
        elements.checkoutButton.text('Place Order');
    }
}

// Event Handlers
function setupEventHandlers() {
    elements.toggleMapButton.addEventListener('click', () => {
        const isMapActive = elements.mapContainer.classList.toggle('active');
        elements.toggleMapButton.innerHTML = isMapActive
            ? '<i class="fas fa-map"></i> Hide map'
            : '<i class="fas fa-map"></i> Show map';
        if (isMapActive && !state.isMapInitialized) initializeMap();
    });

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

    elements.checkoutButton.on('click', function(e) {
        e.preventDefault();

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

        const formData = {
            cart: JSON.stringify(cart),
            payment_method: state.selectedPaymentMethod
        };

        const restaurantSlug = elements.checkoutButton.attr('data-restaurant-name-slug');
        const hashedSlug = elements.checkoutButton.attr('data-restaurant-hashed-slug');
        const checkoutUrl = `/menu/${restaurantSlug}/${hashedSlug}/checkout/`;

        $.ajax({
            url: checkoutUrl,
            type: 'POST',
            data: formData,
            success: function(response) {
                elements.loadingOverlay.removeClass('active');
                if (response.order_id) {
                    const orderId = response.order_id;
                    const successUrl = `/menu/${restaurantSlug}/${hashedSlug}/${orderId}/order_success/`;
                    const successMessage = `
                        <div class="order-success-modal">
                          <div class="order-success-content">
                            <i class="fas fa-check-circle success-icon"></i>
                            <h2>Order Placed Successfully!</h2>
                            <p>${state.deliveryType === 'restaurant' ? 'Please wait at your table, your order will be served soon.' : 'Your order will be delivered to the address you provided.'}</p>
                            <button id="closeSuccessModal" class="primary-button">View Order Details</button>
                          </div>
                        </div>
                    `;
                    $('body').append(successMessage);

                    $('#closeSuccessModal').on('click', function() {
                        $('.order-success-modal').remove();
                        window.location.href = successUrl;
                    });

                    localStorage.removeItem('cart');
                } else {
                    alert('Order placement failed: ' + (response.message || 'Unknown error'));
                }
            },
            error: function(xhr) {
                elements.loadingOverlay.removeClass('active');
                const msg = xhr.responseJSON?.message || xhr.statusText;
                alert('An error occurred while placing the order: ' + msg);
            }
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventHandlers();
    updateOrderDetails();
    setDeliveryType();
    
    if (typeof turf === 'undefined') {
        console.warn("Turf.js is not loaded. Distance calculations will use fallbacks.");
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        state,
        elements,
        initializeMap,
        getUserLocation,
        updateMapWithUserLocation,
        calculateDistance,
        updateOrderDetails,
        updateCart,
        deleteCartItem,
        updatePaymentOptions,
        updateCheckoutButtonState
    };
} 
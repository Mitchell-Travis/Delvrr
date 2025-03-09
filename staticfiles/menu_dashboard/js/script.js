$(document).ready(function() {
    const SERVICE_FEE = 0.51;
    var cart = {}; // Initialize cart object

    // Check if cart data is stored in local storage
    if (localStorage.getItem('cart') !== null) {
        cart = JSON.parse(localStorage.getItem('cart')); // Retrieve cart data from local storage
        updateCart(cart); // Update cart content
    }

    // Function to update cart content
    function updateCart(cart) {
        var totalItems = 0;
        var subtotal = 0.00;
        var cartItemsHtml = ''; // HTML for displaying cart items

        if (Object.keys(cart).length === 0) {
            // Clear the cart if it's empty
            $('#cartItems').html('<li class="list-group-item">Your cart is empty.</li>');
            $('#cartCount').text(totalItems).addClass('d-none'); // Hide cart count display
            $('#cartTotal').text('$0.00'); // Update total price
            $('#cartIconCount').addClass('d-none'); // Hide cart icon count
            localStorage.removeItem('cart'); // Remove cart data from local storage
            return;
        }

        for (var item in cart) {
            var quantity = cart[item][0];
            var productName = cart[item][1];
            var productPrice = parseFloat(cart[item][2]); // Ensure product price is parsed as float
            var productImage = cart[item][3];

            totalItems += quantity; // Update total quantity
            subtotal += quantity * productPrice; // Calculate subtotal

            // Build HTML for each cart item
            cartItemsHtml += `
        <div class="d-flex align-items-center justify-content-between py-2" style="border-bottom: 1px solid #ddd;">
            <img src="${productImage}" alt="${productName}" class="img-thumbnail" style="width: 60px; height: 60px;">
            <div class="ms-3 me-auto">
                <div>${productName}</div>
                <div>$${productPrice.toFixed(2)}</div>
                <div class="d-flex align-items-center">
                    <div class="input-group" style="width: 90px;">
                        <button class="btn btn-outline-secondary btn-sm decrement" data-product-id="${item}" style="width: 20px; height: 20px; padding: 0;">-</button>
                        <input type="text" value="${quantity}" class="form-control text-center" style="width: 30px; height: 20px; padding: 0;" readonly>
                        <button class="btn btn-outline-secondary btn-sm increment" data-product-id="${item}" style="width: 20px; height: 20px; padding: 0;">+</button>
                    </div>
                </div>
            </div>
            <button type="button" class="btn-close btn-sm remove-item" data-product-id="${item}" aria-label="Close"></button>
        </div>
            `;
        }

        $('#orderDetailsList').html(cartItemsHtml);
        $('#itemSubtotal').text(`$${subtotal.toFixed(2)}`);
        $('#serviceFee').text(`$${SERVICE_FEE.toFixed(2)}`);
        $('#cartSubtotal').text(`$${(subtotal + SERVICE_FEE).toFixed(2)}`);
        $('#cartCount').text(totalItems).toggleClass('d-none', totalItems === 0);
        $('#cartTotal').text(`$${subtotal.toFixed(2)}`).toggleClass('d-none', subtotal === 0);
        $('#cartIconCount').text(totalItems).toggleClass('d-none', totalItems === 0);
        localStorage.setItem('cart', JSON.stringify(cart)); // Save cart data to local storage
    }

    // Function to show loading overlay
    function showLoadingOverlay() {
        $('#loading-overlay').addClass('active'); // Show loading overlay
    }

    // Function to hide loading overlay
    function hideLoadingOverlay() {
        $('#loading-overlay').removeClass('active'); // Hide loading overlay
    }

    function simulateCheckoutProcess(delay) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(); // Resolve the promise after the delay
        }, delay);
      });
    }

    // Quantity Change Buttons Click Event
    $(document).on('click', '.increment, .decrement', function() {
        var button = $(this);
        var id = button.data('product-id'); // Get product ID

        if (button.hasClass('increment')) {
            cart[id][0]++; // Increment quantity
        } else if (button.hasClass('decrement') && cart[id][0] > 1) {
            cart[id][0]--; // Decrement quantity
        }
        updateCart(cart); // Update cart content
    });

    // Remove Item Button Click Event
    $(document).on('click', '.remove-item', function() {
        var id = $(this).data('product-id'); // Get product ID
        delete cart[id]; // Remove item from cart
        updateCart(cart); // Update cart content
    });

    // Checkout Button Click Event
   $('#checkoutButton').click(function() {
      var restaurantId = $(this).data('restaurant-id'); // Replace with your restaurant ID from template context

      if (Object.keys(cart).length === 0) {
        alert("Your cart is empty!");
        return;
      }

      showLoadingOverlay(); // Show loading overlay during checkout

      // Simulate checkout process with a delay using Promise
      simulateCheckoutProcess(10000) // Adjust the delay in milliseconds (here: 2 seconds)
        .then(() => {
          hideLoadingOverlay(); // Hide the loading overlay after the delay
          window.location.href = `/dashboard/${restaurantId}/checkout/`;
        });
    });

    // Add to Cart Button Click Event
    $(document).on('click', '.cart', function() {
        var button = $(this);
        var productId = button.data('product-id'); // Get product ID
        var productName = button.closest('.card-product').find('h5').text().trim(); // Get product name
        var productPrice = parseFloat(button.closest('.card-product').find('.price').text().replace(/[^\d.-]/g, '')); // Get product price and parse float
        var productImage = button.closest('.card-product').find('img').attr('src').trim(); // Get product image source

        if (isNaN(productPrice)) {
            // Handle invalid price gracefully (e.g., log an error, skip adding to cart)
            console.error('Invalid product price:', button.closest('.card-product').find('.price').text().trim());
            return;
        }

        if (cart[productId] !== undefined) {
            cart[productId][0]++; // Increment quantity if item already exists in cart
        } else {
            cart[productId] = [1, productName, productPrice, productImage]; // Add new item to cart
        }

        updateCart(cart); // Update cart content

        // Apply the shake animation
        button.closest('.card-product').addClass('shake');
        setTimeout(function() {
            button.closest('.card-product').removeClass('shake');
        }, 1000); // Remove shake class after 1 second

        // Vibrate the phone
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    });

    // Check if the user is navigating back from the checkout page
    $(window).on('pageshow', function(event) {
        if (event.originalEvent.persisted || performance.getEntriesByType('navigation')[0].type === 'back_forward') {
            setTimeout(hideLoadingOverlay, 1000); // Hide loading overlay after 1 second delay if navigating back
        }
    });

    // Additional timer to hide the loading overlay after a fixed duration
     // Hide the loading overlay after 10 seconds if it is still active
});
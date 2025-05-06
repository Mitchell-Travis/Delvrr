from django.shortcuts import render,redirect,reverse, get_object_or_404
from .models import *
from django.http import HttpResponseRedirect,HttpResponse, JsonResponse
from django.contrib.auth.models import Group, User
from django.contrib.auth.decorators import login_required,user_passes_test
from django.contrib import messages
from django.conf import settings
from accounts.models import User
from datetime import datetime
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.http import HttpResponseServerError
from django.urls import reverse
from django.utils.text import slugify
from PIL import Image
from io import BytesIO
import json
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Max
import logging
# from weasyprint import HTML
from django.template.loader import render_to_string
from django.utils import timezone
import logging
from django.views.generic import DetailView, View
from django.db.models import Prefetch
from django.core.cache import cache
from django.db.models import Prefetch, Q, F, Case, When, FloatField
from django.contrib.sites.shortcuts import get_current_site
from django.views.decorators.cache import cache_control, never_cache
from django.views.decorators.cache import cache_page  # server-side cache
# from celery import shared_task

# from django.db.models import Func, F
# from django.db.models.functions import Radians, Power, Sin, Cos, Sqrt, ATan2, Pi
# from django.contrib.gis.db.models.functions import Distance
# from django.contrib.gis.geos import Point

from django.http import HttpResponseForbidden
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.core.cache import cache
from django.db import transaction
from django.views.decorators.http import require_http_methods, require_POST
from django.views.decorators.vary import vary_on_cookie
from django.core.validators import validate_email
from django.db.models import F, Sum
from django.db import transaction


class ProductDetailView(DetailView):
    model = Product
    template_name = 'menu_dashboard/product_detail.html'
    context_object_name = 'product'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Get related products from the same category
        related_products = Product.objects.filter(
            category=self.object.category,
            restaurant=self.object.restaurant,
            status='Available'
        ).exclude(id=self.object.id)[:4]
        context['related_products'] = related_products
        return context


@login_required(login_url='vendor_login')
def vendor_topup(request):
    if request.method == 'POST':
        user_code = request.POST.get('user_code')
        amount = request.POST.get('amount')

        try:
            # Convert amount to Decimal
            amount = Decimal(amount)
            
            user_code_obj = UserCode.objects.get(code=user_code)
            user = user_code_obj.user
            wallet, created = Wallet.objects.get_or_create(user=user)

            topup_request = TopUpRequest.objects.create(
                user_code=user_code_obj,
                amount=amount  # Use Decimal amount
            )
            wallet.balance += amount  # Use Decimal amount
            wallet.save()
            topup_request.processed = True
            topup_request.save()

            return JsonResponse({'message': 'Top-up successful', 'new_balance': wallet.balance})
        except UserCode.DoesNotExist:
            return JsonResponse({'message': 'Invalid user code'}, status=400)
        except Exception as e:
            return JsonResponse({'message': f'Error: {str(e)}'}, status=500)

    return render(request, 'menu_dashboard/vendor_topup.html')


@login_required
def view_wallet(request):
    user = request.user
    wallet, created = Wallet.objects.get_or_create(user=user)
    topup_requests = TopUpRequest.objects.filter(user_code__user=user).order_by('-timestamp')
    
    print(f"Wallet Balance: {wallet.balance}")  # Debug print
    print(f"Top-up Requests: {topup_requests}")  # Debug print

    return render(request, 'menu_dashboard/view_wallet.html', {
        'wallet': wallet,
        'topup_requests': topup_requests
    })

def delete_product(request, product_id):
    try:
        # Perform the deletion logic here based on the product_id
        product = Product.objects.get(pk=product_id)
        product.delete()
        return JsonResponse({'message': 'Product deleted successfully'})
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': f'An error occurred: {str(e)}'}, status=500)


@login_required(login_url='adminlogin')
def restaurant_menu_list(request):
    current_user = request.user
    restaurant = Restaurant.objects.get(user=request.user)

    # Filter products by the restaurant
    products = Product.objects.filter(restaurant=current_user.restaurant)
    product_count = Product.objects.filter(restaurant=current_user.restaurant).count()


    context = {
        'products': products,
        'product_count': product_count
    }
    return render(request, 'menu_dashboard/products.html', context)


def contact(request):

    context = {

    }

    return render(request, 'menu_dashboard/contact.html', context)


from django.utils.timezone import now

# @cache_control(max_age=3600)  # Cache for 1 hour
# def restaurant_menu(request, restaurant_name_slug, hashed_slug):
#     # Fetch the restaurant
#     restaurant = get_object_or_404(Restaurant, hashed_slug=hashed_slug)

#     # Log menu visit
#     ip_address = request.META.get('REMOTE_ADDR')
#     user_agent_str = request.META.get('HTTP_USER_AGENT', '')
#     parsed_user_agent = getattr(request, 'user_agent', None)
#     device = parsed_user_agent.device.family if parsed_user_agent and hasattr(parsed_user_agent, 'device') else "Unknown Device"
#     MenuVisit.objects.create(
#         restaurant=restaurant,
#         ip_address=ip_address,
#         user_agent=user_agent_str,
#         device=device
#     )

#     # Cache categories + products
#     cache_key = f"restaurant_{restaurant.id}_categories"
#     categories = cache.get(cache_key)
#     if not categories:
#         product_queryset = Product.objects.filter(restaurant=restaurant).prefetch_related('variations')
#         categories = list(
#             Category.objects
#                 .filter(products__restaurant=restaurant)
#                 .distinct()
#                 .order_by('order')
#                 .prefetch_related(Prefetch('products', queryset=product_queryset))
#         )
#         cache.set(cache_key, categories, 300)  # 5 minutes

#     # Build categorized_products
#     today = datetime.today().weekday()  # 0 = Monday, …, 6 = Sunday
#     categorized_products = []
#     for category in categories:
#         category_products = list(category.products.all())
#         for product in category_products:
#             # variations
#             product.variations_list = list(product.variations.all()) if product.variations.exists() else None
#             default_variation = product.variations.filter(name='S').first() or product.variations.first()
#             product.display_price = default_variation.price if default_variation else product.get_display_price()
#             product.has_description = bool(product.description and product.description.strip())

#             # Wednesday wings discount example
#             product.is_discounted = (today == 2 and 'wings' in product.name.lower())
#             if product.is_discounted and product.display_price and not product.price_by_percentage:
#                 # ── START PATCH: coerce to float before dividing
#                 try:
#                     price = float(product.display_price)
#                 except (TypeError, ValueError):
#                     price = 0.0
#                 product.display_price = price / 2
#                 # ── END PATCH
#             product.gst_note = "12% GST will be added" if product.charge_gst else ""
#         if category_products:
#             categorized_products.append(category_products)

#     # Uncategorized products
#     uncategorized_products = list(
#         Product.objects
#             .filter(restaurant=restaurant, category__isnull=True)
#             .prefetch_related('variations')
#     )
#     for product in uncategorized_products:
#         product.variations_list = list(product.variations.all()) if product.variations.exists() else None
#         default_variation = product.variations.filter(name='S').first() or product.variations.first()
#         product.display_price = default_variation.price if default_variation else product.get_display_price()

#         product.is_discounted = (today == 2 and 'wings' in product.name.lower())
#         if product.is_discounted and product.display_price and not product.price_by_percentage:
#             # ── START PATCH: coerce to float before dividing
#             try:
#                 price = float(product.display_price)
#             except (TypeError, ValueError):
#                 price = 0.0
#             product.display_price = price / 2
#             # ── END PATCH
#         product.gst_note = "12% GST will be added" if product.charge_gst else ""
#     if uncategorized_products:
#         categorized_products.append(uncategorized_products)

#     if not categorized_products:
#         categorized_products = [[]]

#     # Assign restaurant to customer if logged in
#     if request.user.is_authenticated:
#         customer, _ = Customer.objects.get_or_create(user=request.user)
#         customer.assign_restaurant(restaurant)
#     else:
#         messages.info(request, "To place an order, please log in or continue as a guest.")

#     # --- Dynamic Open Graph / Twitter Card metadata ---
#     if restaurant.logo_pic:
#         logo_url = request.build_absolute_uri(restaurant.logo_pic.url)
#     else:
#         logo_url = request.build_absolute_uri('/static/images/default_restaurant.png')

#     canonical_url   = request.build_absolute_uri()
#     og_title        = restaurant.restaurant_name or "Delvrr - QR Code Digital Menu"
#     og_description  = restaurant.address or "Scan the QR code to access the digital menu."

#     # Brand colors
#     brand_colors = restaurant.brand_colors.all()
#     primary_brand_color   = brand_colors[0].color if brand_colors.count() > 0 else "#f7c028"
#     secondary_brand_color = brand_colors[1].color if brand_colors.count() > 1 else "#000000"
#     third_brand_color     = brand_colors[2].color if brand_colors.count() > 2 else "#ffffff"

#     context = {
#         'restaurant': restaurant,
#         'allProds': categorized_products,
#         'categories': categories,
#         'primary_brand_color': primary_brand_color,
#         'secondary_brand_color': secondary_brand_color,
#         'third_brand_color': third_brand_color,
#         'hide_all_category': restaurant.id == 9,
#         # OG/Twitter context:
#         'logo_url': logo_url,
#         'canonical_url': canonical_url,
#         'og_title': og_title,
#         'og_description': og_description,
#     }

#     return render(request, 'menu_dashboard/index.html', context)


@cache_control(max_age=3600)  # Cache for 1 hour
def restaurant_link(request, restaurant_name_slug, hashed_slug):
    # Fetch the restaurant
    restaurant = get_object_or_404(Restaurant, hashed_slug=hashed_slug)

    # Log menu visit
    ip_address = request.META.get('REMOTE_ADDR')
    user_agent_str = request.META.get('HTTP_USER_AGENT', '')
    parsed_user_agent = getattr(request, 'user_agent', None)
    device = parsed_user_agent.device.family if parsed_user_agent and hasattr(parsed_user_agent, 'device') else "Unknown Device"
    MenuVisit.objects.create(
        restaurant=restaurant,
        ip_address=ip_address,
        user_agent=user_agent_str,
        device=device
    )

    # Cache categories + products
    cache_key = f"restaurant_{restaurant.id}_categories"
    categories = cache.get(cache_key)
    if not categories:
        product_queryset = Product.objects.filter(restaurant=restaurant).prefetch_related('variations')
        categories = list(
            Category.objects
                .filter(products__restaurant=restaurant)
                .distinct()
                .order_by('order')
                .prefetch_related(Prefetch('products', queryset=product_queryset))
        )
        cache.set(cache_key, categories, 300)  # 5 minutes

    # Build categorized_products
    today = datetime.today().weekday()  # 0 = Monday, …, 6 = Sunday
    categorized_products = []
    for category in categories:
        category_products = list(category.products.all())
        for product in category_products:
            # variations
            product.variations_list = list(product.variations.all()) if product.variations.exists() else None
            default_variation = product.variations.filter(name='S').first() or product.variations.first()
            product.display_price = default_variation.price if default_variation else product.get_display_price()
            product.has_description = bool(product.description and product.description.strip())

            # Wednesday wings discount example
            product.is_discounted = (today == 2 and 'wings' in product.name.lower())
            if product.is_discounted and product.display_price and not product.price_by_percentage:
                # ── START PATCH: coerce to float before dividing
                try:
                    price = float(product.display_price)
                except (TypeError, ValueError):
                    price = 0.0
                product.display_price = price / 2
                # ── END PATCH
            product.gst_note = "12% GST will be added" if product.charge_gst else ""
        if category_products:
            categorized_products.append(category_products)

    # Uncategorized products
    uncategorized_products = list(
        Product.objects
            .filter(restaurant=restaurant, category__isnull=True)
            .prefetch_related('variations')
    )
    for product in uncategorized_products:
        product.variations_list = list(product.variations.all()) if product.variations.exists() else None
        default_variation = product.variations.filter(name='S').first() or product.variations.first()
        product.display_price = default_variation.price if default_variation else product.get_display_price()

        product.is_discounted = (today == 2 and 'wings' in product.name.lower())
        if product.is_discounted and product.display_price and not product.price_by_percentage:
            # ── START PATCH: coerce to float before dividing
            try:
                price = float(product.display_price)
            except (TypeError, ValueError):
                price = 0.0
            product.display_price = price / 2
            # ── END PATCH
        product.gst_note = "12% GST will be added" if product.charge_gst else ""
    if uncategorized_products:
        categorized_products.append(uncategorized_products)

    if not categorized_products:
        categorized_products = [[]]

    # Assign restaurant to customer if logged in
    if request.user.is_authenticated:
        customer, _ = Customer.objects.get_or_create(user=request.user)
        customer.assign_restaurant(restaurant)
    else:
        messages.info(request, "To place an order, please log in or continue as a guest.")

    # --- Dynamic Open Graph / Twitter Card metadata ---
    if restaurant.logo_pic:
        logo_url = request.build_absolute_uri(restaurant.logo_pic.url)
    else:
        logo_url = request.build_absolute_uri('/static/images/default_restaurant.png')

    canonical_url   = request.build_absolute_uri()
    og_title        = restaurant.restaurant_name or "Delvrr - QR Code Digital Menu"
    og_description  = restaurant.address or "Scan the QR code to access the digital menu."

    # Brand colors
    brand_colors = restaurant.brand_colors.all()
    primary_brand_color   = brand_colors[0].color if brand_colors.count() > 0 else "#f7c028"
    secondary_brand_color = brand_colors[1].color if brand_colors.count() > 1 else "#000000"
    third_brand_color     = brand_colors[2].color if brand_colors.count() > 2 else "#ffffff"

    context = {
        'restaurant': restaurant,
        'allProds': categorized_products,
        'categories': categories,
        'primary_brand_color': primary_brand_color,
        'secondary_brand_color': secondary_brand_color,
        'third_brand_color': third_brand_color,
        'hide_all_category': restaurant.id == 9,
        # OG/Twitter context:
        'logo_url': logo_url,
        'canonical_url': canonical_url,
        'og_title': og_title,
        'og_description': og_description,
    }

    return render(request, 'menu_dashboard/index1.html', context)


logger = logging.getLogger(__name__)

@login_required(login_url='customer_signin')
def order_success(request, restaurant_name_slug, hashed_slug, order_id):
    # 1) Verify the restaurant via both slugs
    restaurant = get_object_or_404(
        Restaurant,
        slug=restaurant_name_slug,
        hashed_slug=hashed_slug
    )
    # 2) Fetch the order and ensure it belongs to that restaurant
    order = get_object_or_404(
        Orders,
        id=order_id,
        restaurant=restaurant
    )
    # 3) Confirm the logged-in user owns this order
    if request.user.customer != order.customer:
        return HttpResponseForbidden("You are not authorized to view this order.")
    # 4) (Optional) clear any session-based cart
    if 'cart' in request.session:
        del request.session['cart']
        
    # 5) Get order products - using OrderProduct instead of OrderItem
    order_items = OrderProduct.objects.filter(order=order)
    
    # 6) Get brand colors with fallbacks (similar to RestaurantCheckoutView)
    brand_colors = restaurant.brand_colors.all()
    primary_brand_color = brand_colors[0].color if brand_colors.count() > 0 else "#f7c028"
    secondary_brand_color = brand_colors[1].color if brand_colors.count() > 1 else "#000000"
    third_brand_color = brand_colors[2].color if brand_colors.count() > 2 else "#ffffff"
    
    # 7) Convert to local timezone (for accuracy) and build context
    local_order_time = timezone.localtime(order.order_date)
    context = {
        'restaurant':    restaurant,
        'order':         order,
        'order_id':      order.id,
        'order_time':    local_order_time,
        'customer_name': f"{order.customer.user.first_name} {order.customer.user.last_name}",
        'payment_method': order.payment_method,
        'table_number':   order.table_number,
        'amount':         order.amount,
        'order_items':    order_items,
        'primary_brand_color': primary_brand_color,
        'secondary_brand_color': secondary_brand_color,
        'third_brand_color': third_brand_color,
    }
    # 8) Render the success page
    return render(request, 'menu_dashboard/order_success.html', context)


# @login_required(login_url='customer_signin')
# def download_receipt(request, order_id):
#     try:
#         order = get_object_or_404(Orders, id=order_id)

#         # Check authorization
#         if request.user.customer != order.customer:
#             logger.warning(f"Unauthorized receipt access attempt for order {order_id} by user {request.user.id}")
#             return render(request, 'menu_dashboard/unauthorized.html', status=403)

#         # Prepare context
#         context = {
#             'order': order,
#             'customer_name': f"{order.customer.user.get_full_name()}",
#             'order_time': order.order_date,
#             'generated_at': timezone.now()
#         }

#         # Generate PDF
#         html_string = render_to_string('menu_dashboard/receipt_template.html', context)
#         html = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
#         pdf = html.write_pdf()

#         # Prepare response
#         filename = f"receipt_{order.id}_{timezone.now().strftime('%Y%m%d')}.pdf"
#         response = HttpResponse(pdf, content_type='application/pdf')
#         response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
#         logger.info(f"Receipt generated for order {order_id}")
#         return response

#     except Exception as e:
#         logger.error(f"Error generating receipt for order {order_id}: {str(e)}")
#         return render(request, 'menu_dashboard/error.html', {'error': 'Failed to generate receipt'}, status=500)

    

def restaurant_search(request):
    query = request.GET.get('q')
    if query:
        restaurants = Restaurant.objects.filter(restaurant_name__icontains=query)
    else:
        restaurants = Restaurant.objects.all()

    context = {
        'restaurants': restaurants,
        'query': query,
    }

    return render(request, 'menu_dashboard/store-list.html', context)




def restaurant_list(request):
    # Fetch all restaurants from the database
    restaurants = Restaurant.objects.all()

    context = {
        'restaurants': restaurants,
    }

    return render(request, 'menu_dashboard/store-list.html', context)


import logging

logger = logging.getLogger(__name__)


from django.shortcuts import redirect
from django.contrib import messages

@method_decorator([login_required, never_cache], name='dispatch')
class RestaurantCheckoutView(View):
    """
    A class-based view for handling restaurant checkout operations.
    This view is optimized for performance and scalability.
    """
    
    def get(self, request, restaurant_name_slug, hashed_slug):
        """
        Handle GET requests for the checkout page.
        Uses caching to improve performance.
        """
        try:
            # Try to get restaurant from cache first
            cache_key = f"restaurant_{restaurant_name_slug}_{hashed_slug}"
            restaurant = cache.get(cache_key)
            
            if not restaurant:
                # If not in cache, fetch from database with optimized query
                restaurant = get_object_or_404(
                    Restaurant.objects.select_related('user')
                                    .prefetch_related('brand_colors'),
                    slug=restaurant_name_slug,
                    hashed_slug=hashed_slug
                )
                # Cache for 5 minutes
                cache.set(cache_key, restaurant, 300)
            
            # Get brand colors with fallbacks
            brand_colors = restaurant.brand_colors.all()
            primary_brand_color = brand_colors[0].color if brand_colors.count() > 0 else "#f7c028"
            secondary_brand_color = brand_colors[1].color if brand_colors.count() > 1 else "#000000"
            third_brand_color = brand_colors[2].color if brand_colors.count() > 2 else "#ffffff"
            
            context = {
                'restaurant': restaurant,
                'is_logged_in': request.user.is_authenticated,
                'restaurant_lat': restaurant.latitude,
                'restaurant_lon': restaurant.longitude,
                'primary_brand_color': primary_brand_color,
                'secondary_brand_color': secondary_brand_color,
                'third_brand_color': third_brand_color,
            }
            
            return render(request, 'menu_dashboard/checkout.html', context)
            
        except Exception as e:
            logger.error(f"Error in checkout GET: {str(e)}")
            return JsonResponse({'error': 'An error occurred while loading the checkout page'}, status=500)

    @method_decorator(require_POST)
    def post(self, request, restaurant_name_slug, hashed_slug):
        """
        Handle POST requests for order submission.
        Uses transaction management and proper error handling.
        """
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Authentication required'}, status=401)
        
        try:
            # Validate input data
            cart_data = request.POST.get('cart')
            payment_method = request.POST.get('payment_method')
            table_number = request.POST.get('table_number')
            
            if not cart_data or not payment_method:
                return JsonResponse({'error': 'Missing required data'}, status=400)
            
            # Parse cart data
            try:
                cart = json.loads(cart_data)
            except json.JSONDecodeError:
                return JsonResponse({'error': 'Invalid cart data format'}, status=400)
            
            # Start transaction
            with transaction.atomic():
                # Get restaurant
                restaurant = get_object_or_404(
                    Restaurant.objects.select_related('user'),
                    slug=restaurant_name_slug,
                    hashed_slug=hashed_slug
                )
                
                # Get or create customer
                customer, _ = Customer.objects.get_or_create(user=request.user)
                
                # Create order
                order = Orders.objects.create(
                    customer=customer,
                    restaurant=restaurant,
                    status='Pending',
                    payment_method=payment_method,
                    table_number=table_number,
                    amount=0
                )
                
                # Calculate total amount
                total_amount = Decimal('0.00')
                service_charge = Decimal('0.25')
                
                # Process cart items
                for product_id, item_data in cart.items():
                    try:
                        product = Product.objects.select_for_update().get(
                            id=product_id,
                            restaurant=restaurant,
                            status='Available'
                        )
                        
                        qty = int(item_data[0])
                        if qty <= 0:
                            raise ValidationError(f"Invalid quantity for product {product_id}")
                        
                        # Calculate item total
                        item_total = product.price * qty
                        total_amount += item_total
                        
                        # Create order product
                        OrderProduct.objects.create(
                            order=order,
                            product=product,
                            quantity=qty,
                            price=product.price
                        )
                        
                    except Product.DoesNotExist:
                        raise ValidationError(f"Product {product_id} not found or not available")
                    except (ValueError, TypeError):
                        raise ValidationError(f"Invalid data for product {product_id}")
                
                # Add service charge
                total_amount += service_charge
                
                # Update order amount
                order.amount = total_amount
                order.save()
                
                # Create earnings record
                Earnings.objects.create(
                    order=order,
                    service_charge=service_charge
                )
                
                # Update table status if table number provided
                if table_number:
                    Table.objects.filter(
                        restaurant=restaurant,
                        table_number=table_number
                    ).update(is_occupied=True)
                
                # Clear cart from session
                if 'cart' in request.session:
                    del request.session['cart']
                
                # Log successful order
                logger.info(f"Order {order.id} placed successfully for restaurant {restaurant.id}")
                
                return JsonResponse({
                    'success': True,
                    'order_id': order.id,
                    'total_amount': str(total_amount),
                    'message': 'Order placed successfully'
                })
                
        except ValidationError as e:
            logger.warning(f"Validation error in checkout: {str(e)}")
            return JsonResponse({'error': str(e)}, status=400)
        except Exception as e:
            logger.error(f"Error in checkout POST: {str(e)}")
            return JsonResponse({'error': 'An error occurred while processing your order'}, status=500)

# Replace the old restaurant_checkout view with the new class-based view
restaurant_checkout = RestaurantCheckoutView.as_view()

@login_required(login_url='adminlogin')
def create_restaurant_menu(request):

    current_user = request.user
    restaurant = Restaurant.objects.get(user=request.user)

    if request.method == 'POST':
        # Retrieve form data for the product
        name = request.POST['name']
        product_image = request.FILES.get('product_image')  # Use get() to handle missing image gracefully
        price = request.POST['price']
        description = request.POST['description']
        category = request.POST['category']  # Retrieve the selected category

        # Retrieve promo form fields
        has_promo = request.POST.get('has_promo') == 'on'  # Check if the checkbox is checked
        promo_price = request.POST.get('promo_price')
        promo_start_date = request.POST.get('promo_start_date')
        promo_end_date = request.POST.get('promo_end_date')
        promo_discription = request.POST.get('promo_discription')

        # Retrieve form data for the table
        table_number = request.POST.get('table_number')

        try:
            # Validate that price is a valid decimal number
            price_decimal = Decimal(price)

            # Create a new product
            product = Product(
                name=name,
                product_image=product_image,
                price=price_decimal,
                description=description,
                category=category,  # Assign the selected category directly
                pub_date=datetime.now(),
                restaurant=request.user.restaurant,
                has_promo=has_promo,
                promo_price=promo_price,
                promo_start_date=promo_start_date,
                promo_end_date=promo_end_date,
                promo_discription=promo_discription
            )

            # Validate the model fields
            product.full_clean()

            # Save the product to the database
            product.save()

            # Create a new table if the table_number is provided
            if table_number:
                table = Table(
                    table_number=table_number,
                    restaurant=request.user.restaurant
                )
                table.full_clean()
                table.save()

            messages.success(request, 'Product created successfully.')
            return redirect('restaurant-menu-list')  # Redirect to a product listing page

        except ValidationError as e:
            for error in e:
                messages.error(request, error)

        except Exception as e:
            messages.error(request, f'An error occurred: {str(e)}')

    context = {
        # Pass any additional context data needed
    }

    return render(request, 'menu_dashboard/add-product.html', context)
    



@login_required(login_url='adminlogin')
def admin_dashboard_view(request):
    current_user = request.user
    restaurant = Restaurant.objects.get(user=request.user)

    total_orders = restaurant.get_total_orders()

    product_count = Product.objects.filter(restaurant=current_user.restaurant).count()

    # Generate the menu URL based on the restaurant's unique identifier and slugified name
    restaurant_id = restaurant.id
    restaurant_name = restaurant.restaurant_name
    restaurant_name_slug = slugify(restaurant_name)  # Slugify the name

    # Get the logo image URL
    logo_image_url = restaurant.logo_pic.url  # Assuming you have a logo_pic field in your Restaurant model

    restaurant_menu = reverse('restaurant_menu', args=[restaurant_name_slug, restaurant_id])

    context = {
        'product_count': product_count,
        'total_orders': total_orders,
        'restaurant_menu': restaurant_menu,
        'restaurant_name': restaurant_name,
        'logo_image_url': logo_image_url,  # Add the logo image URL to the context
    }

    return render(request, 'menu_dashboard/dashboard_view.html', context)


class RestaurantMenuView(DetailView):
    model = Restaurant
    template_name = 'menu_dashboard/index.html'
    context_object_name = 'restaurant'

    def get_object(self, queryset=None):
        # Get both slugs from URL
        restaurant_name_slug = self.kwargs.get('restaurant_name_slug')
        hashed_slug = self.kwargs.get('hashed_slug')
        
        print(f"Looking for restaurant with name_slug: {restaurant_name_slug} and hashed_slug: {hashed_slug}")  # Debug
        
        # Try to get restaurant by hashed_slug first
        try:
            restaurant = Restaurant.objects.get(hashed_slug=hashed_slug)
            print(f"Found restaurant: {restaurant.restaurant_name}")  # Debug
            
            # Verify restaurant_name_slug matches
            if restaurant.slug != restaurant_name_slug:
                print(f"Slug mismatch: {restaurant.slug} != {restaurant_name_slug}")  # Debug
                raise Restaurant.DoesNotExist
            return restaurant
        except Restaurant.DoesNotExist:
            print("Restaurant not found")  # Debug
            raise Http404("Restaurant not found")

    def get_queryset(self):
        return Restaurant.objects.select_related('user').prefetch_related('brand_colors')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        restaurant = self.object
        today = datetime.today().weekday()

        # Log menu visit asynchronously
        self._log_menu_visit(restaurant)

        # Get cached or fresh categories with products
        categories = self._get_cached_categories(restaurant)
        
        # Process products with variations and discounts
        categorized_products = self._process_products(categories, today)
        
        # Get uncategorized products
        uncategorized_products = self._get_uncategorized_products(restaurant, today)
        if uncategorized_products:
            categorized_products.append(uncategorized_products)

        # Handle customer assignment
        self._handle_customer_assignment(restaurant)

        # Get brand colors
        brand_colors = restaurant.brand_colors.all()
        primary_brand_color = brand_colors[0].color if brand_colors.count() > 0 else "#f7c028"
        secondary_brand_color = brand_colors[1].color if brand_colors.count() > 1 else "#000000"
        third_brand_color = brand_colors[2].color if brand_colors.count() > 2 else "#ffffff"

        # Get meta data
        logo_url = (
            self.request.build_absolute_uri(restaurant.logo_pic.url)
            if restaurant.logo_pic
            else self.request.build_absolute_uri('/static/images/default_restaurant.png')
        )

        # Update context with old variable names
        context.update({
            'allProds': categorized_products or [[]],
            'categories': categories,
            'primary_brand_color': primary_brand_color,
            'secondary_brand_color': secondary_brand_color,
            'third_brand_color': third_brand_color,
            'hide_all_category': restaurant.id == 9,
            'logo_url': logo_url,
            'canonical_url': self.request.build_absolute_uri(),
            'og_title': restaurant.restaurant_name or "Delvrr - QR Code Digital Menu",
            'og_description': restaurant.address or "Scan the QR code to access the digital menu.",
        })

        return context

    def _log_menu_visit(self, restaurant):
        """Log menu visit asynchronously using Django's async support"""
        from asgiref.sync import sync_to_async
        ip_address = self.request.META.get('REMOTE_ADDR')
        user_agent = self.request.META.get('HTTP_USER_AGENT', '')
        device = getattr(self.request.user_agent, 'device.family', 'Unknown Device')
        
        @sync_to_async
        def create_visit():
            MenuVisit.objects.create(
                restaurant=restaurant,
                ip_address=ip_address,
                user_agent=user_agent,
                device=device
            )
        
        # Run in background
        create_visit()

    def _get_cached_categories(self, restaurant):
        """Get categories from cache or database"""
        cache_key = f"restaurant_{restaurant.id}_categories"
        categories = cache.get(cache_key)
        
        if not categories:
            product_queryset = (
                Product.objects
                .filter(restaurant=restaurant)
                .select_related('category')
                .prefetch_related('variations')
            )
            
            categories = list(
                Category.objects
                .filter(products__restaurant=restaurant)
                .distinct()
                .order_by('order')
                .prefetch_related(
                    Prefetch('products', queryset=product_queryset)
                )
            )
            cache.set(cache_key, categories, 300)  # 5 minutes cache
        
        return categories

    def _process_products(self, categories, today):
        """Process products with their variations and discounts"""
        categorized_products = []
        
        for category in categories:
            category_products = []
            for product in category.products.all():
                self._process_product(product, today)
                category_products.append(product)
            
            if category_products:
                categorized_products.append(category_products)
        
        return categorized_products

    def _process_product(self, product, today):
        """Process individual product data"""
        # Handle variations
        product.variations_list = list(product.variations.all()) if product.variations.exists() else None
        default_variation = product.variations.filter(name='S').first() or product.variations.first()
        product.display_price = default_variation.price if default_variation else product.get_display_price()
        
        # Handle descriptions
        product.has_description = bool(product.description and product.description.strip())
        
        # Handle discounts
        product.is_discounted = (today == 2 and 'wings' in product.name.lower())
        if product.is_discounted and product.display_price and not product.price_by_percentage:
            try:
                price = float(product.display_price)
                product.display_price = price / 2
            except (TypeError, ValueError):
                product.display_price = 0.0
        
        # Handle GST
        product.gst_note = "12% GST will be added" if product.charge_gst else ""

    def _get_uncategorized_products(self, restaurant, today):
        """Get and process uncategorized products"""
        uncategorized_products = list(
            Product.objects
            .filter(restaurant=restaurant, category__isnull=True)
            .select_related('restaurant')
            .prefetch_related('variations')
        )
        
        for product in uncategorized_products:
            self._process_product(product, today)
        
        return uncategorized_products

    def _handle_customer_assignment(self, restaurant):
        """Handle customer assignment if user is authenticated"""
        if self.request.user.is_authenticated:
            customer, _ = Customer.objects.get_or_create(user=self.request.user)
            customer.assign_restaurant(restaurant)
        else:
            from django.contrib import messages
            messages.info(self.request, "To place an order, please log in or continue as a guest.")

# Replace the old restaurant_menu view with the new class-based view
restaurant_menu = RestaurantMenuView.as_view()

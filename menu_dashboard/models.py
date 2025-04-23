from django.db import models
from PIL import Image, ImageDraw, ImageFont
from django.contrib.auth.models import User, Group
from django.utils import timezone
from accounts.models import User  # Ensure this is the correct User model being imported
from django.conf import settings
from decimal import Decimal
from .qrcode_generator import generate_qrcode
from django.core.files import File
from django.db.models import Index
from django.core.cache import cache
from django.utils.text import slugify
import hashlib
from django.utils.timezone import now
from django.conf import settings
from io import BytesIO
from django.core.files.uploadedfile import InMemoryUploadedFile
import sys
from django.core.files.base import ContentFile


from datetime import datetime
import datetime
import hashlib
from decimal import Decimal, ROUND_HALF_UP

class Restaurant(models.Model):
    user             = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    restaurant_name  = models.CharField(max_length=40, null=True, blank=True, db_index=True)
    slug             = models.SlugField(max_length=255, null=True, blank=True)
    hashed_slug      = models.CharField(max_length=64, unique=True, blank=True)  
    logo_pic         = models.ImageField(upload_to='logo_pic/RestaurantLogo/', null=True, blank=True)
    address          = models.CharField(max_length=255, blank=True, null=True)
    mobile           = models.CharField(max_length=20)
    latitude         = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    longitude        = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    business_hours   = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['restaurant_name']),
        ]

    def save(self, *args, **kwargs):
        # 1) Generate slug if missing
        if not self.slug and self.restaurant_name:
            self.slug = slugify(self.restaurant_name)

        # 2) Generate hashed_slug if missing (after first save to get self.id)
        if not self.hashed_slug:
            # Temporarily save to get an ID if this is a new object
            super().save(*args, **kwargs)
            raw = f"{self.id}your_secret_salt"
            self.hashed_slug = hashlib.sha256(raw.encode()).hexdigest()[:10]

        # 3) Round latitude & longitude to 8 decimal places
        quant = Decimal('0.00000001')
        if self.latitude is not None:
            self.latitude = Decimal(self.latitude).quantize(quant, rounding=ROUND_HALF_UP)
        if self.longitude is not None:
            self.longitude = Decimal(self.longitude).quantize(quant, rounding=ROUND_HALF_UP)

        # 4) Save the final model
        super().save(*args, **kwargs)

    def __str__(self):
        return self.restaurant_name or "Unnamed Restaurant"

    def get_primary_brand_color(self):
        first = self.brand_colors.first()
        return first.color if first else "#f7c028"

    def get_total_orders(self):
        key = f'restaurant_{self.id}_total_orders'
        total = cache.get(key)
        if total is None:
            total = Orders.objects.filter(restaurant=self).count()
            cache.set(key, total, 3600)
        return total

    def is_open(self):
        """
        Returns True if the restaurant is open right now.
        Supports:
          - "Everyday" or "Everyday." → always open
          - Comma-separated schedules like "MonTue:0800-1700,WedThu:0900-1800"
        """
        now = datetime.datetime.now()
        dow = now.strftime('%a')               # 'Mon', 'Tue', ...
        current = int(now.strftime('%H%M'))    # e.g. 1330

        if not self.business_hours:
            return False

        bh = self.business_hours.strip().rstrip('.').lower()
        if bh == 'everyday':
            return True

        try:
            for part in self.business_hours.split(','):
                days, hours = part.split(':')
                open_time, close_time = map(int, hours.split('-'))
                days = days.strip()
                # treat 'Everyday' here also
                if 'Everyday'.lower() in days.lower():
                    return open_time <= current <= close_time
                # check if today is in the 'days' substring
                if dow.lower()[:3] in days.lower():
                    return open_time <= current <= close_time
        except ValueError:
            # malformed entry → treat as closed
            return False

        return False

class BrandColor(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='brand_colors')
    color = models.CharField(
        max_length=7,
        help_text="Hex color code, e.g. #f7c028"
    )

    def __str__(self):
        return f"{self.restaurant.restaurant_name}: {self.color}"

def default_profile_pic():
    return 'media/default.jpg'

class Customer(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    profile_pic = models.ImageField(upload_to='profile_pic/CustomerProfilePic/', default=default_profile_pic, null=True, blank=True)
    mobile = models.CharField(max_length=20, null=False)

    # Add a ForeignKey relationship to the Restaurant model
    restaurant = models.ForeignKey(Restaurant, null=True, blank=True, on_delete=models.SET_NULL)

    def assign_restaurant(self, restaurant):
        self.restaurant = restaurant
        self.save()

    class Meta:
        indexes = [
            models.Index(fields=['user']),
        ]

    @property
    def get_name(self):
        return f"{self.user.first_name} {self.user.last_name}"

    @property
    def get_id(self):
        return self.user.id

    def __str__(self):
        return self.user.first_name or "No Name"


class Table(models.Model):
    table_number = models.IntegerField(null=True, blank=True, db_index=True)
    restaurant = models.ForeignKey('Restaurant', on_delete=models.CASCADE, related_name='table', null=True, blank=True)
    qrcode_image = models.ImageField(upload_to='core/table_qrcodes', blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['restaurant', 'table_number']),
        ]

    def save(self, *args, **kwargs):
        if not self.qrcode_image:
            image_filename, image_buffer = generate_qrcode(self)
            self.qrcode_image.save(image_filename, File(image_buffer), save=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Table {self.table_number}" if self.table_number is not None else "No Table Number"



class Category(models.Model):
    name = models.CharField(max_length=50, unique=True)
    emoji = models.CharField(max_length=5, null=True, blank=True)  # For storing category emoji
    order = models.PositiveIntegerField(default=0)  # Add this field for ordering
    
    class Meta:
        ordering = ['order']  # Order categories by this field
        
    def __str__(self):
        return self.name


class Product(models.Model):
    STATUS_CHOICES = (
        ('Available', 'Available'),
        ('Unavailable', 'Unavailable'),
    )
    name = models.CharField(max_length=40, db_index=True)
    product_image = models.ImageField(upload_to='product_image/', null=True, blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    description = models.CharField(max_length=200, null=True, blank=True)
    restaurant = models.ForeignKey('Restaurant', on_delete=models.CASCADE,
                                   related_name='products', null=True, blank=True)
    category = models.ForeignKey('Category', on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name='products')
    subcategory = models.CharField(max_length=50, null=True, blank=True)
    pub_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES,
                              default='Available', db_index=True)
    has_promo = models.BooleanField(default=False)
    promo_price = models.DecimalField(max_digits=8, decimal_places=2,
                                      null=True, blank=True)
    promo_start_date = models.DateField(null=True, blank=True)
    promo_end_date = models.DateField(null=True, blank=True)
    promo_discription = models.CharField(max_length=200, null=True, blank=True)
    has_variations = models.BooleanField(default=False)
    charge_gst = models.BooleanField(default=False,
                                     help_text="If True, 12% GST will be added.")
    
    # New Fields
    special_offer = models.CharField(
        max_length=100, null=True, blank=True,
        help_text="E.g., 'Limited Time Offer!' or '50% off on Wednesdays'"
    )
    discount_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text=("For fixed pricing, this is the discount rate applied to the price.")
    )
    price_by_percentage = models.BooleanField(
        default=False,
        help_text="If enabled, the product will display its price as a percentage (e.g., '50%')."
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['restaurant', 'category', 'status']),
        ]
    
    def __str__(self):
        return self.name or "No Name"
    
    def save(self, *args, **kwargs):
        if self.product_image:
            self.resize_image()
        super().save(*args, **kwargs)
    
    def resize_image(self, max_width=800, max_height=800, quality=85):
        from PIL import Image
        from io import BytesIO
        from django.core.files.base import ContentFile
        import os
    
        # Open the image
        img = Image.open(self.product_image)
    
        # Check if resizing is needed
        if img.width > max_width or img.height > max_height:
        # Calculate the resize ratio to maintain aspect ratio
            ratio = min(max_width/img.width, max_height/img.height)
            new_width = int(img.width * ratio)
            new_height = int(img.height * ratio)
        
            # Resize the image
            img = img.resize((new_width, new_height), Image.LANCZOS)
        
            # Save the resized image
            output = BytesIO()
            # Preserve format
            format = os.path.splitext(self.product_image.name)[1][1:].upper()
            if format == 'JPG':
                
                format = 'JPEG'
        
            img.save(output, format=format, quality=quality)
            output.seek(0)
        
            # Replace the image with resized version
            self.product_image = ContentFile(output.read(), name=self.product_image.name)
    
    def get_display_price(self) -> str:
        """
        Returns a string for display:
         - If price_by_percentage=True, uses `price` as the percent (e.g. 50.00 → "50%").
         - Otherwise, shows a dollar amount, applying discount_percentage if set.
        """
        # 1) Percentage‑only pricing
        if self.price_by_percentage:
            if self.price is None:
                return ""
            pct = self.price
            # drop .00 for whole numbers
            if pct == pct.quantize(Decimal('1')):
                return f"{int(pct)}%"
            return f"{pct:.2f}%"
        
        # 2) Fixed‑price (with optional discount)
        if self.price is None:
            return ""
        final_price = self.price
        if self.discount_percentage:
            final_price = final_price * (Decimal('1') - self.discount_percentage / Decimal('100'))
        return f"${final_price:.2f}"
    
    def get_default_price(self, size="S"):
        """
        Returns the default price for a product or a variation.
        """
        if self.has_variations:
            variation = self.variations.filter(name=size).first()
            if variation:
                return variation.get_discounted_price()
        return self.get_display_price()
    
    def get_all_variations(self):
        return {
            variation.name: {
                'price': variation.price,
                'is_default': variation.is_default,
                'has_promo': variation.has_promo,
                'promo_price': variation.promo_price
            }
            for variation in self.variations.all()
        }

class ProductVariation(models.Model):
    """Model for storing different size/format variations of a product"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variations')
    name = models.CharField(max_length=50, help_text="E.g., 'S', 'M', 'L', 'F")
    price = models.DecimalField(max_digits=8, decimal_places=2)
    is_default = models.BooleanField(default=False, help_text="Is this the default variation?")
    
    # Promo fields for variations
    has_promo = models.BooleanField(default=False)
    promo_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    
    # New Discount Field for variations (optional)
    discount_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True, 
        help_text="Set a percentage discount, e.g., 50 for 50% off"
    )

    class Meta:
        unique_together = ('product', 'name')
        ordering = ['product', '-is_default', 'name']
    
    def __str__(self):
        return f"{self.product.name} - {self.name}"
    
    def get_discounted_price(self):
        """
        Returns the variation price after applying the discount, if applicable.
        Note: This method assumes variations use fixed pricing.
        """
        if self.discount_percentage:
            return round(self.price * (1 - self.discount_percentage / 100), 2)
        return self.price

    def save(self, *args, **kwargs):
        # If this is set as default, unset any other defaults for this product
        if self.is_default:
            ProductVariation.objects.filter(
                product=self.product, 
                is_default=True
            ).exclude(id=self.id).update(is_default=False)
        
        # Ensure product has_variations is set
        if not self.product.has_variations:
            self.product.has_variations = True
            self.product.save(update_fields=['has_variations'])
        
        super().save(*args, **kwargs)




class Orders(models.Model):
    STATUS = (
        ('Pending', 'Pending'),
        ('Order Confirmed', 'Order Confirmed'),
        ('Cooking', 'Cooking'),
        ('Out for Delivery', 'Out for Delivery'),
        ('Delivered', 'Delivered'),
    )

    PAYMENT_METHOD = (
        ('Cash on Delivery', 'Cash on Delivery'),
        ('Orange Money', 'Orange Money')
    )

    customer = models.ForeignKey('Customer', on_delete=models.CASCADE, null=True, db_index=True)
    restaurant = models.ForeignKey('Restaurant', on_delete=models.CASCADE, null=True, db_index=True)
    order_date = models.DateTimeField(auto_now_add=True, null=True, db_index=True)
    status = models.CharField(max_length=50, null=True, choices=STATUS, default='Pending', db_index=True)
    payment_method = models.CharField(max_length=50, null=True, choices=PAYMENT_METHOD)
    table_number = models.IntegerField(null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['customer', 'restaurant', 'status', 'order_date']),
        ]

    def __str__(self):
        customer_name = f"{self.customer.user.first_name} {self.customer.user.last_name}" if self.customer else "No Customer"
        restaurant_name = self.restaurant.restaurant_name if self.restaurant else "No Restaurant"
        return f'Order {self.id} - Customer: {customer_name}, Restaurant: {restaurant_name}'

    def submit_delivery_request(self):
        from django.db import transaction
        with transaction.atomic():
            delivery_request = DeliveryRequest.objects.create(order=self)
            available_riders = Rider.objects.filter(is_available=True).select_for_update()
            if available_riders.exists():
                rider = available_riders.first()
                delivery_request.rider = rider
                delivery_request.status = 'Assigned'
                delivery_request.save()
                rider.is_available = False
                rider.save()
            else:
                delivery_request.status = 'No Riders Available'
                delivery_request.save()
        return delivery_request

class Rider(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    mobile = models.CharField(max_length=20, null=False)
    is_available = models.BooleanField(default=True, db_index=True)

    def __str__(self):
        return self.user.username or "No Name"

class DeliveryRequest(models.Model):
    order = models.OneToOneField('Orders', on_delete=models.CASCADE)
    rider = models.ForeignKey('Rider', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=50, default='Pending', db_index=True)
    request_time = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['order', 'rider', 'status']),
        ]

    def __str__(self):
        return f'Delivery Request for Order {self.order.id}'

class Delivery(models.Model):
    delivery_request = models.OneToOneField('DeliveryRequest', on_delete=models.CASCADE)
    delivery_time = models.DateTimeField(null=True, blank=True, db_index=True)
    delivered = models.BooleanField(default=False, db_index=True)
    delivery_feedback = models.CharField(max_length=500, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['delivery_request', 'delivered']),
        ]

    def __str__(self):
        return f'Delivery for Order {self.delivery_request.order.id}'

class OrderProduct(models.Model):
    order = models.ForeignKey(Orders, on_delete=models.CASCADE)
    product = models.ForeignKey('Product', on_delete=models.CASCADE)
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        indexes = [
            models.Index(fields=['order', 'product']),
        ]

    def __str__(self):
        return f'Order {self.order_id} - Product: {self.product.name}, Quantity: {self.quantity}'

class Earnings(models.Model):
    order = models.OneToOneField('Orders', on_delete=models.CASCADE)
    service_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.51)
    currency = models.CharField(max_length=3, default='LRD')

    class Meta:
        indexes = [
            models.Index(fields=['order']),
        ]

    def __str__(self):
        return f'Earnings from Order {self.order.id} - Service Charge: {self.service_charge} {self.currency}'

class UserCode(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    code = models.CharField(max_length=6, unique=True, db_index=True)

    def __str__(self):
        return f'{self.user.username} - {self.code}'

class Wallet(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f'{self.user.username} - Balance: {self.balance}'

class TopUpRequest(models.Model):
    user_code = models.ForeignKey(UserCode, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    processed = models.BooleanField(default=False, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['user_code', 'processed', 'timestamp']),
        ]

    def __str__(self):
        return f'{self.user_code.user.username} - Amount: {self.amount} - Processed: {self.processed}'

class Feedback(models.Model):
    name = models.CharField(max_length=40, db_index=True)
    feedback = models.CharField(max_length=500)
    date = models.DateField(auto_now_add=True, null=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['name', 'date']),
        ]

    def __str__(self):
        return self.name or "No Name"



class MenuVisit(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="menu_visits")
    timestamp = models.DateTimeField(default=now)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField()
    device = models.CharField(max_length=100, blank=True, null=True)  # New field

    def __str__(self):
        if self.restaurant and hasattr(self.restaurant, 'name'):
            return f"{self.restaurant.name} - {self.timestamp}"
        return f"Unknown Restaurant - {self.timestamp}"


class Notification(models.Model):
    title = models.CharField(max_length=100)
    message = models.CharField(max_length=255)
    button_text = models.CharField(max_length=50, blank=True, null=True)
    button_url = models.URLField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    
    # New field to store notification type
    NOTIFICATION_TYPES = [
        ('success', 'Success'),
        ('info', 'Information'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]
    notification_type = models.CharField(
        max_length=10,
        choices=NOTIFICATION_TYPES,
        default='info'
    )
    
    # New field to link notifications to specific restaurants
    restaurants = models.ManyToManyField(
        'Restaurant', 
        related_name='notifications',
        blank=True,
        help_text="Select specific restaurants to receive this notification. Leave empty to send to all restaurants."
    )
    
    # Flag to indicate if notification should be sent to all restaurants
    send_to_all = models.BooleanField(
        default=False,
        help_text="If checked, this notification will be sent to all restaurants regardless of selection."
    )
    
    def __str__(self):
        return self.title
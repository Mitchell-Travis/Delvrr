from django.contrib import admin
import qrcode
import zipfile
import io
from django.contrib import admin
from django.http import HttpResponse
from django.urls import reverse
import qrcode
from io import BytesIO
from django.core.files import File
from django.contrib import admin
from .models import (
    Customer,
    Product,
    Orders,
    Feedback, 
    Table, 
    Restaurant,
    OrderProduct,
    Earnings,
    UserCode,
    Wallet,
    TopUpRequest,
    BrandColor,
    Category,
    ProductVariation,
    MenuVisit 
    )
from django.utils.html import format_html
from django.core.files.base import ContentFile
from django.utils.text import slugify
from PIL import Image
from django.db.models import Sum



@admin.register(MenuVisit)
class MenuVisitAdmin(admin.ModelAdmin):
    list_display = ('restaurant', 'timestamp', 'device')
    list_filter = ('restaurant', 'timestamp')
    search_fields = ('restaurant__name', 'device')


# Register your models here.
class CustomerAdmin(admin.ModelAdmin):
    pass
admin.site.register(Customer, CustomerAdmin)


class RestaurantAdmin(admin.ModelAdmin):
    list_display = ('restaurant_name', 'address', 'mobile', 'latitude', 'longitude', 'business_hours')
    search_fields = ('restaurant_name', 'address')

admin.site.register(Restaurant, RestaurantAdmin)

class ProductAdmin(admin.ModelAdmin):
    list_display = ('restaurant', 'name')
admin.site.register(Product, ProductAdmin)


class ProductVariationAdmin(admin.ModelAdmin):
    list_display = ('product', 'name', 'price')
admin.site.register(ProductVariation, ProductVariationAdmin)


class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'emoji')
admin.site.register(Category, CategoryAdmin)

class OrderAdmin(admin.ModelAdmin):
    list_display = ('customer_name', 'restaurant_name', 'ordered_products', 'order_date', 'status', 'payment_method', 'table_number', 'total_amount')
    list_filter = ('status', 'payment_method')
    search_fields = ('customer__user__first_name', 'customer__user__last_name', 'orderproduct__product__name', 'restaurant__restaurant_name')
    readonly_fields = ('order_date', 'total_amount')

    def customer_name(self, obj):
        if obj.customer and obj.customer.user:
            return f"{obj.customer.user.first_name} {obj.customer.user.last_name}"
        return "No Customer"
    customer_name.short_description = 'Customer Name'

    def restaurant_name(self, obj):
        if obj.restaurant:
            return obj.restaurant.restaurant_name
        return "No Restaurant"
    restaurant_name.short_description = 'Restaurant Name'

    def ordered_products(self, obj):
        order_items = OrderProduct.objects.filter(order=obj)
        product_list = ', '.join([f"{item.product.name} (x{item.quantity})" for item in order_items])
        return product_list
    ordered_products.short_description = 'Ordered Products'

    def total_amount(self, obj):
        order_items = OrderProduct.objects.filter(order=obj)
        total = sum(item.quantity * item.price for item in order_items)
        return total
    total_amount.short_description = 'Total Amount'

admin.site.register(Orders, OrderAdmin)


class EarningsAdmin(admin.ModelAdmin):
    list_display = ('order', 'service_charge', 'currency')

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        total_earnings = Earnings.objects.aggregate(total=Sum('service_charge'))['total'] or 0
        extra_context['total_earnings'] = total_earnings
        return super(EarningsAdmin, self).changelist_view(request, extra_context=extra_context)

admin.site.register(Earnings, EarningsAdmin)

class FeedbackAdmin(admin.ModelAdmin):
    pass
admin.site.register(Feedback, FeedbackAdmin)
# Register your models here.


class BrandcolorAdmin(admin.ModelAdmin):
    pass
admin.site.register(BrandColor, BrandcolorAdmin)


class UserCodeAdmin(admin.ModelAdmin):
    pass
admin.site.register(UserCode, UserCodeAdmin)


class WalletAdmin(admin.ModelAdmin):
    pass
admin.site.register(Wallet, WalletAdmin)


class TopUpRequestAdmin(admin.ModelAdmin):
    pass
admin.site.register(TopUpRequest, TopUpRequestAdmin)


class TableAdmin(admin.ModelAdmin):
    list_display = ('table_number', 'view_qrcode')
    actions = ['download_qr_codes']

    def view_qrcode(self, obj):
        if obj.qrcode_image:
            qr_code_url = obj.qrcode_image.url
            return format_html('<a href="{}" target="_blank">View QR Code</a>', qr_code_url)
        return "No QR Code"

    view_qrcode.short_description = 'QR Code'

    def download_qr_codes(self, request, queryset):
        # Generate individual QR code images for download
        for table in queryset:
            base_url = "http://172.20.10.3:8000/"  # Replace with your desired base URL
            restaurant_name_slug = slugify(table.restaurant.restaurant_name)  # Slugify the name
            table_qrcode_url = f'{base_url}/dashboard/{restaurant_name_slug}/{table.restaurant.id}'

            # Generate the QR code image
            qr = qrcode.QRCode(
                version=None,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=15,
                border=4,
            )
            qr.add_data(table_qrcode_url)
            qr.make(fit=True)

            qr_image = qr.make_image(fill_color="green", back_color="white").convert('RGBA')

            # Load the restaurant logo picture
            if table.restaurant.logo_pic:
                restaurant_logo_image_path = table.restaurant.logo_pic.path
                restaurant_logo_image = Image.open(restaurant_logo_image_path).convert('RGBA')

                # Calculate size and position to overlay the logo picture
                qr_width, qr_height = qr_image.size
                logo_image_size = qr_width // 8
                logo_image = restaurant_logo_image.resize((logo_image_size, logo_image_size))

                # Create a transparent image for pasting
                transparent = Image.new('RGBA', (qr_width, qr_height))
                transparent.paste(qr_image, (0, 0))

                # Calculate the position for the logo
                logo_position = (
                    (qr_width - logo_image_size) // 2,
                    (qr_height - logo_image_size) // 2,
                )

                # Paste the logo onto the transparent image
                transparent.paste(logo_image, logo_position, logo_image)
                qr_image = transparent

            # Save the image to a BytesIO buffer
            image_buffer = BytesIO()
            qr_image.save(image_buffer, format="PNG")

            # Build the response to send the QR code image for download
            response = HttpResponse(image_buffer.getvalue(), content_type='image/png')
            response['Content-Disposition'] = f'attachment; filename=table_{table.table_number}_qrcode.png'
            return response

    download_qr_codes.short_description = 'Download QR Codes for Selected Tables'

admin.site.register(Table, TableAdmin)
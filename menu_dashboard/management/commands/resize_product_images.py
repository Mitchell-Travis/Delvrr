# management/commands/resize_product_images.py
from django.core.management.base import BaseCommand
from menu_dashboard.models import Product

class Command(BaseCommand):
    help = 'Resize all existing product images'

    def handle(self, *args, **options):
        products = Product.objects.filter(product_image__isnull=False)
        total = products.count()
        self.stdout.write(f'Resizing {total} product images...')
        
        for i, product in enumerate(products):
            if product.product_image:
                product.resize_image()
                product.save(update_fields=['product_image'])
                self.stdout.write(f'Processed {i+1}/{total}: {product.name}')
        
        self.stdout.write(self.style.SUCCESS('Successfully resized all product images'))
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from menu_dashboard.models import Restaurant, Category, Product, BrandColor
from django.core.files.uploadedfile import SimpleUploadedFile

class RestaurantMenuViewTest(TestCase):
    def setUp(self):
        # Create test user
        self.user = get_user_model().objects.create_user(
            username='testuser',
            password='testpass123'
        )
        
        # Create a test image
        image_content = b'GIF87a\x01\x00\x01\x00\x80\x01\x00\x00\x00\x00ccc,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
        test_logo = SimpleUploadedFile(
            name='test_logo.gif',
            content=image_content,
            content_type='image/gif'
        )
        test_product_image = SimpleUploadedFile(
            name='test_product.gif',
            content=image_content,
            content_type='image/gif'
        )
        
        # Create test restaurant with logo
        self.restaurant = Restaurant.objects.create(
            user=self.user,
            restaurant_name='Test Restaurant',
            hashed_slug='test-slug',
            logo_pic=test_logo
        )
        
        # Create test category
        self.category = Category.objects.create(
            name='Test Category',
            order=1
        )
        
        # Create test product with image
        self.product = Product.objects.create(
            name='Test Product',
            price=10.00,
            restaurant=self.restaurant,
            category=self.category,
            product_image=test_product_image
        )
        
        # Create test brand colors
        BrandColor.objects.create(
            restaurant=self.restaurant,
            color='#f7c028'
        )
        
        self.client = Client()
    
    def test_restaurant_menu_view(self):
        # Test accessing the menu page
        response = self.client.get(
            reverse('restaurant_menu', 
                   kwargs={
                       'restaurant_name_slug': 'test-restaurant',
                       'hashed_slug': 'test-slug'
                   })
        )
        
        # Check if the page loads successfully
        self.assertEqual(response.status_code, 200)
        
        # Check if the correct template is used
        self.assertTemplateUsed(response, 'menu_dashboard/index1.html')
        
        # Check if the context contains the required data
        self.assertIn('restaurant', response.context)
        self.assertIn('allProds', response.context)
        self.assertIn('categories', response.context)
        self.assertIn('primary_brand_color', response.context)
        
        # Check if the restaurant data is correct
        self.assertEqual(response.context['restaurant'], self.restaurant)
        
        # Check if the product is in the categorized products
        self.assertTrue(
            any(self.product in category_products 
                for category_products in response.context['allProds'])
        ) 
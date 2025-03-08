from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from menu_dashboard.models import Restaurant, Product

User = get_user_model()

class RestaurantMenuTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Create a test user
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        
        # Create a restaurant with a slug
        self.restaurant = Restaurant.objects.create(
            user=self.user,
            restaurant_name='Test Restaurant',
            slug='test-restaurant',  # Ensure slug matches the URL pattern
            mobile='1234567890'
        )
        
        # Create some products for the restaurant
        Product.objects.create(restaurant=self.restaurant, name='Coffee', category='Drinks', price=3.00)
        Product.objects.create(restaurant=self.restaurant, name='Tea', category='Drinks', price=2.50)
        Product.objects.create(restaurant=self.restaurant, name='Burger', category='Food', price=5.00)
        Product.objects.create(restaurant=self.restaurant, name='Pizza', category='Food', price=6.00)
        Product.objects.create(restaurant=self.restaurant, name='Pasta', category='Food', price=4.50)
        Product.objects.create(restaurant=self.restaurant, name='Salad', category='Food', price=4.00)
        Product.objects.create(restaurant=self.restaurant, name='Soda', category='Drinks', price=1.50)

    def test_restaurant_menu_view(self):
        url = reverse('restaurant_menu', args=[self.restaurant.slug, self.restaurant.id])
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'menu_dashboard/index.html')
        self.assertIn('restaurant', response.context)
        self.assertIn('allProds', response.context)
        self.assertIn('beverages', response.context)
        
        # Check the number of products in each category
        self.assertEqual(len(response.context['beverages']), 3)
        self.assertEqual(len(response.context['allProds']), 1)
        self.assertEqual(len(response.context['allProds'][0]), 4)  # 6 products per category limit

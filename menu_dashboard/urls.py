from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from . import views
from django.contrib.auth.views import LoginView,LogoutView
from .views import ProductDetailView
from django.utils.text import slugify


urlpatterns = [

	path('view/', views.admin_dashboard_view,name='admin-dashboard'),
	path('restaurants/', views.restaurant_list, name='restaurant_list'),
	path('restaurant-search/', views.restaurant_search, name='restaurant_search'),
	path('create-menu/', views.create_restaurant_menu, name='create_menu'),
	path('<slug:restaurant_name_slug>/<slug:hashed_slug>/', views.restaurant_menu, name='restaurant_menu'),

	path('link/<slug:restaurant_name_slug>/<slug:hashed_slug>/', views.restaurant_link, name='restaurant_menu'),

	path('restaurant_menu_list/', views.restaurant_menu_list, name='restaurant-menu-list'),
	path('delete_product/<int:product_id>/', views.delete_product, name='delete_product'),
	path('contact/', views.contact, name='contact'),

	path(
        'menu/<slug:restaurant_name_slug>/<slug:hashed_slug>/checkout/',
        views.restaurant_checkout,
        name='restaurant_checkout'
    ),

    path(
        '<slug:restaurant_name_slug>/<slug:hashed_slug>/<int:order_id>/order_success/',
        views.order_success,
        name='order_success'
    ),
    # path('<int:order_id>/download_receipt/', views.download_receipt, name='download_receipt'),
	path('vendor/topup/', views.vendor_topup, name='vendor_topup'),
    path('wallet/', views.view_wallet, name='view_wallet'),
    path('product/<int:pk>/', ProductDetailView.as_view(), name='product_detail'),

]




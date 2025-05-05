from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from . import views
from django.contrib.auth.views import LoginView,LogoutView
from .views import ProductDetailView
from django.utils.text import slugify


urlpatterns = [
	path('menu/view/', views.admin_dashboard_view,name='admin-dashboard'),
	path('menu/restaurants/', views.restaurant_list, name='restaurant_list'),
	path('menu/restaurant-search/', views.restaurant_search, name='restaurant_search'),
	path('menu/create-menu/', views.create_restaurant_menu, name='create_menu'),
	re_path(r'^menu/(?P<restaurant_name_slug>[\w-]+)/(?P<hashed_slug>[\w-]+)/?$', views.restaurant_menu, name='restaurant_menu'),
	path('menu/link/<slug:restaurant_name_slug>/<slug:hashed_slug>/', views.restaurant_link, name='restaurant_menu'),
	path('menu/restaurant_menu_list/', views.restaurant_menu_list, name='restaurant-menu-list'),
	path('menu/delete_product/<int:product_id>/', views.delete_product, name='delete_product'),
	path('menu/contact/', views.contact, name='contact'),
	path(
        'menu/<slug:restaurant_name_slug>/<slug:hashed_slug>/checkout/',
        views.restaurant_checkout,
        name='restaurant_checkout'
    ),

    path(
        'menu/<slug:restaurant_name_slug>/<slug:hashed_slug>/<int:order_id>/order_success/',
        views.order_success,
        name='order_success'
    ),
    # path('<int:order_id>/download_receipt/', views.download_receipt, name='download_receipt'),
	path('menu/vendor/topup/', views.vendor_topup, name='vendor_topup'),
    path('menu/wallet/', views.view_wallet, name='view_wallet'),
    path('menu/product/<int:pk>/', ProductDetailView.as_view(), name='product_detail'),

]




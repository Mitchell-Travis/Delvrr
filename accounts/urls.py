from django.urls import path
from . import views
from django.contrib.auth.views import LoginView,LogoutView



urlpatterns = [
	
	path('customer_signup/', views.customer_signup_view, name='customer_signup'),
	path('customer_signin/', views.customer_signin_view, name='customer_signin'),
	# path('instruction/', views.instruction_page, name='instruction_page'),
	path('signup/', views.signup_view, name='signup'),
	path('restaurant_profile/', views.create_restaurant_profile, name='restaurant_profile'),
	path('customer_profile/', views.create_customer_profile, name='customer_profile'),
	path('welcome/', views.welcome_page, name='welcome_page'),
    # ... other URL patterns
	path('signin/', views.signin_view, name='signin'),
	path('afterlogin/', views.afterlogin_view,name='afterlogin'),
	path('logout', views.Logout,name='logout'),
	path('signout/', views.customer_signout_view, name='customer_signout'),
	path('verify_account/', views.verify_restaurant_account, name='verify_account'),
	path('register/', views.register, name='register'),
    path('verify_otp/', views.verify_otp, name='verify_otp'),
    path('otp/<str:uid>/', views.otpVerify, name='otp')


]



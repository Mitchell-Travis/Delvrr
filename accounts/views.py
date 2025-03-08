import requests
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import render, HttpResponseRedirect
from django.contrib import messages
from menu_dashboard.models import Restaurant, Customer, Orders  # Import your Restaurant model
from django.core.files.storage import FileSystemStorage  # Import FileSystemStorage if not already imported

from accounts.models import User, VerifyConfirmation, ConfirmationCode
from accounts.send_email_confirmation import EmailConfirmation
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.utils.crypto import get_random_string

from rest_framework import generics, status
from accounts.serializers import EmailSerializer, VerifyCodeSerializer
from django.utils.crypto import get_random_string
from django.core.mail import send_mail
from django.conf import settings

from .forms import RegistrationForm, OTPForm
from accounts.utils import (send_sms, 
    send_verification_code_to_phone_number, 
    verify_otp_code, format_phone_number)
from random import randint
import random
import logging
from twilio.rest import Client
from django.conf import settings
from django.urls import reverse
from django.db import transaction
from django.http import HttpResponseRedirect
import uuid
from allauth.socialaccount.providers.google.views import OAuth2LoginView
from allauth.socialaccount.models import SocialApp
from urllib.parse import urlparse, parse_qs
from django.utils import timezone
from urllib.parse import urlparse, unquote
from django.urls import get_resolver
from urllib.parse import quote 
from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError
from django.http import HttpResponseRedirect
import uuid
import json
from django.middleware.csrf import get_token
from datetime import datetime, timedelta



def otpVerify(request,uid):
    if request.method=="POST":
        profile=Profile.objects.get(uid=uid)     
        if request.COOKIES.get('can_otp_enter')!=None:
            if(profile.otp==request.POST['otp']):
                red=redirect("home")
                red.set_cookie('verified',True)
                return red
            return HttpResponse("wrong otp")
        return HttpResponse("10 minutes passed")        
    return render(request,"otp.html",{'id':uid}) 



def is_restaurant_owner(user):
    return user.groups.filter(name='Restaurant').exists()

def is_customer(user):
    return user.groups.filter(nmae='Customer').exists()


def afterlogin_view(request):
    if is_restaurant_owner(request.user):
        return redirect('admin-dashboard')
    else:
        return redirect('home')


def after_customer_login(request):
    if is_customer(request.user):
        return redirect('customer-dashboard')

    else:
        return redirect('home')


logger = logging.getLogger(__name__)
User = get_user_model()


def register(request):
    if request.method=="POST":
        if User.objects.filter(username__iexact=request.POST['user_name']).exists():
            return HttpResponse("User already exists")

        user=User.objects.create(username=request.POST['user_name'])
        otp=random.randint(1000,9999)
        profile=Profile.objects.create(user=user,phone_number=request.POST['phone_number'],otp=f'{otp}')
        if request.POST['methodOtp']=="methodOtpWhatsapp":
            messagehandler=MessageHandler(request.POST['phone_number'],otp).send_otp_via_whatsapp()
        else:
            messagehandler=MessageHandler(request.POST['phone_number'],otp).send_otp_via_message()
        red=redirect(f'otp/{profile.uid}/')
        red.set_cookie("can_otp_enter",True,max_age=600)
        return red  
    return render(request, 'accounts/register.html')



def verify_otp(request):
    if request.method == 'POST':
        form = OTPForm(request.POST)
        if form.is_valid():
            entered_otp = form.cleaned_data['otp']
            phone_number = request.session.get('phone_number')

            # Use Twilio Verify to check the OTP
            account_sid = settings.TWILIO_ACCOUNT_SID
            auth_token = settings.TWILIO_AUTH_TOKEN
            verify_service_sid = settings.TWILIO_VERIFY_SERVICE_SID

            client = Client(account_sid, auth_token)
            formatted_phone_number = format_phone_number(phone_number)

            try:
                verification_check = client.verify \
                    .v2 \
                    .services(verify_service_sid) \
                    .verification_checks \
                    .create(to=formatted_phone_number, code=entered_otp)

                if verification_check.status == "approved":
                    
                    username = request.session.get('username')
                    user = User.objects.get(username=username, phone_number=phone_number)
                    login(request, user)  # backend specified in settings.py
                    return redirect('home')
                else:
                    return render(request, 'accounts/verify_otp.html', {'form': form, 'error': 'Invalid OTP'})
            except Exception as e:
                logger.error(f"Error verifying OTP for {phone_number}: {str(e)}")
                return render(request, 'accounts/verify_otp.html', {'form': form, 'error': 'An error occurred during OTP verification.'})
    else:
        form = OTPForm()

    return render(request, 'accounts/verify_otp.html', {'form': form})


class SendCodeView(generics.GenericAPIView):
    serializer_class = EmailSerializer

    def get(self, request):
        return render(request, 'accounts/send_code.html')

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.POST)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user, created = User.objects.get_or_create(email=email)
            code = get_random_string(length=6, allowed_chars='0123456789')

            confirmation_code, created = ConfirmationCode.objects.get_or_create(user=user)
            confirmation_code.confirmed_code = code
            confirmation_code.save()

            subject = "Your Login Code"
            message = f'Your login code is {code}'
            send_mail(subject, message, settings.EMAIL_HOST_USER, [email])

            messages.success(request, 'Verification code sent to your email.')
            return redirect('verify-code')
        else:
            messages.error(request, 'Invalid email.')
            return redirect('send-code')


class VerifyCodeView(generics.GenericAPIView):
    serializer_class = VerifyCodeSerializer

    def get(self, request):
        return render(request, 'accounts/verify_code.html')

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.POST)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            code = serializer.validated_data['code']

            try:
                user = User.objects.get(email=email)
                confirmation_code = ConfirmationCode.objects.get(user=user)

                if confirmation_code.confirmed_code == code:
                    confirmation_code.confirmed_code = None
                    confirmation_code.save()
                    user.backend = 'django.contrib.auth.backends.ModelBackend'
                    login(request, user)
                    messages.success(request, 'Logged in successfully.')
                    return redirect('home')  # Redirect to home or any other page
                else:
                    messages.error(request, 'Invalid code.')
            except User.DoesNotExist:
                messages.error(request, 'Invalid email.')
            except ConfirmationCode.DoesNotExist:
                messages.error(request, 'No confirmation code found.')
        else:
            messages.error(request, 'Invalid data.')

        return redirect('verify-code')


def signup_view(request):
    if request.method == 'POST':
        # Retrieve form data from request.POST
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')

        # Create a CustomUser instance and set its attributes
        user = User.objects.create_user(username=username, email=email, password=password)

        # Add the user to the 'Restaurant' group
        my_restaurant_group, created = Group.objects.get_or_create(name='Restaurant')
        my_restaurant_group.user_set.add(user)

        # Authenticate the user with email and password
        user = authenticate(email=email, password=password)

        if user is not None and user.is_active:
            # Log the user in
            login(request, user)

            # Redirect to the restaurant creation page
            return redirect('restaurant_profile')

    return render(request, 'accounts/signup.html')


logger = logging.getLogger(__name__)

def customer_signup_view(request):
    next_url = request.GET.get('next', '')
    
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        
        try:
            # Create user
            user = User.objects.create_user(username=username, email=email, password=password)
            customer_group, created = Group.objects.get_or_create(name='Customer')
            user.groups.add(customer_group)
            # Create customer profile
            Customer.objects.create(user=user)
            # Authenticate the user using email
            user = authenticate(username=email, password=password)
            if user is not None and user.is_active:
                login(request, user)
                # Redirect to profile with next parameter using quote()
                return redirect(f'{reverse("customer_profile")}?next={quote(next_url)}')
            else:
                logger.error(f"Authentication failed for user: {username}")
                messages.error(request, 'Authentication failed. Please try again.')
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            messages.error(request, 'An error occurred during signup. Please try again.')
    
    return render(request, 'accounts/customer_signup.html', {'next': next_url})





logger = logging.getLogger(__name__)

def get_default_restaurant(user):
    try:
        customer = Customer.objects.get(user=user)
        return customer.restaurant
    except Customer.DoesNotExist:
        return None

def get_user_default_destination(request, user):
    """
    Redirect the user to the restaurant menu page if they have a default restaurant;
    otherwise, prompt them to select one.
    """
    default_restaurant = get_default_restaurant(user)
    if default_restaurant:
        # Assuming your Restaurant model has a 'slug' attribute.
        return redirect(
            'restaurant_menu',
            restaurant_id=default_restaurant.id,
            restaurant_name_slug=default_restaurant.slug
        )
    else:
        messages.info(request, "Welcome! Please select a restaurant.")
        return redirect('restaurant_list')

def get_post_login_destination(request, user, next_url):
    """
    Determine where to send the user after a successful login.
    
    - If a `next_url` exists and includes 'checkout', redirect there.
    - Otherwise, send them to their default destination (menu page or restaurant list).
    """
    if next_url and 'checkout' in next_url:
        # Redirect to checkout URL (assumed to be valid).
        return HttpResponseRedirect(next_url)
    
    return get_user_default_destination(request, user)

def customer_signin_view(request):
    device_id = str(uuid.uuid4())
    device_name = "Laptop"

    # Attempt to retrieve recent user data from session, else from cookie.
    recent_user = None
    if 'recent_user' in request.session:
        stored_user = request.session.get('recent_user')
        logger.debug("Found recent_user in session: %s", stored_user)
        try:
            last_login = datetime.fromisoformat(stored_user['last_login'])
            if datetime.now() - last_login < timedelta(hours=24):
                recent_user = stored_user
            else:
                logger.debug("Session recent_user expired; clearing.")
                del request.session['recent_user']
        except Exception as e:
            logger.error("Error processing session recent_user: %s", e)
            del request.session['recent_user']
    else:
        recent_cookie = request.COOKIES.get('recent_user')
        if recent_cookie:
            try:
                stored_user = json.loads(recent_cookie)
                logger.debug("Found recent_user in cookie: %s", stored_user)
                last_login = datetime.fromisoformat(stored_user['last_login'])
                if datetime.now() - last_login < timedelta(hours=24):
                    recent_user = stored_user
                    request.session['recent_user'] = stored_user
                else:
                    logger.debug("Cookie recent_user expired.")
            except Exception as e:
                logger.error("Error processing cookie recent_user: %s", e)

    next_url = request.GET.get('next', '') or request.POST.get('next', '')
    logger.debug("Initial next_url: %s", next_url)

    google_login_url = '/accounts/google/login/'

    if request.method == 'POST':
        logger.debug("POST data keys: %s", list(request.POST.keys()))

        # --- Quick Login Branch ---
        if request.POST.get('quick_login') and recent_user:
            logger.debug("Quick login triggered using recent_user: %s", recent_user)
            try:
                email = recent_user.get('email')
                user = User.objects.filter(email=email).first()
                if user and user.is_active:
                    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                    if user.groups.filter(name='Customer').exists():
                        destination = get_post_login_destination(request, user, next_url)
                        return destination
                    else:
                        messages.error(request, "This login is for customers only.")
                        return redirect('home')
                else:
                    messages.error(request, "Quick login failed. Please sign in manually.")
                    if 'recent_user' in request.session:
                        del request.session['recent_user']
            except Exception as e:
                logger.error("Error during quick login: %s", e)
                messages.error(request, "An error occurred. Please try again.")
                return redirect('customer_signin')

        # --- Firebase Authentication Branch (Optional) ---
        id_token = request.POST.get('id_token')
        if id_token:
            logger.debug("Firebase token provided.")
            try:
                decoded_token = auth.verify_id_token(id_token)
                uid = decoded_token['uid']
                email = decoded_token.get('email')
                logger.debug("Decoded Firebase token: uid=%s, email=%s", uid, email)
                user = authenticate(request, firebase_uid=uid)
                if user is None:
                    user = User.objects.create_user(username=uid, email=email)
                    user.save()
                login(request, user)
                if user.groups.filter(name='Customer').exists():
                    destination = get_post_login_destination(request, user, next_url)
                    return destination
                else:
                    messages.error(request, "This login is for customers only.")
                    return redirect('home')
            except FirebaseError as e:
                logger.error("Firebase authentication error: %s", e)
                messages.error(request, "Firebase authentication failed. Please try again.")
                return redirect('customer_signin')

        # --- Email/Password Authentication Branch ---
        email = request.POST.get('email')
        password = request.POST.get('password')
        logger.debug("Attempting email/password login for email: %s", email)
        if email and password:
            user = authenticate(request, email=email, password=password)
            if user is not None and user.is_active:
                login(request, user)
                if user.groups.filter(name='Customer').exists():
                    destination = get_post_login_destination(request, user, next_url)
                    return destination
                else:
                    messages.error(request, "This login is for customers only.")
                    return redirect('home')
            else:
                messages.error(request, "Invalid login credentials.")
        else:
            if not email:
                messages.error(request, "Email is required.")
            if not password:
                messages.error(request, "Password is required.")

    context = {
        "next": next_url,
        "device_id": device_id,
        "device_name": device_name,
        "google_login_url": google_login_url,
        "recent_user": recent_user,
    }
    response = render(request, 'accounts/customer_signin.html', context)

    # Set a cookie for recent_user (if available) so the quick login persists.
    if recent_user:
        response.set_cookie('recent_user', json.dumps(recent_user), max_age=86400)
    return response


def customer_signout_view(request):
    response = redirect('customer_signin')
    if request.user.is_authenticated:
        try:
            recent_data = {
                'email': request.user.email,
                'last_login': datetime.now().isoformat()
            }
            # Set a cookie with the recent user data (as JSON) with a 1-minute lifespan.
            response.set_cookie('recent_user', json.dumps(recent_data), max_age=60)
        except Exception as e:
            # Optionally log the error
            pass
        finally:
            logout(request)
    return response



def geocode_address(address):
    url = 'https://nominatim.openstreetmap.org/search'
    params = {
        'format': 'json',
        'q': address,
        'limit': 1  # Limit to one result
    }

    response = requests.get(url, params=params)
    if response.status_code == 200:
        try:
            data = response.json()
            if data:
                # Assuming the first result is the most relevant
                latitude = data[0]['lat']
                longitude = data[0]['lon']
                return latitude, longitude
        except Exception as e:
            print(f'Error parsing JSON response: {e}')
    
    return None, None
    
def create_restaurant_profile(request):
    if request.method == 'POST':
        # Retrieve form data from request.POST
        restaurant_name = request.POST.get('restaurant_name')
        mobile = request.POST.get('mobile')
        address = request.POST.get('address')
        business_hours = request.POST.get('business_hours')

        # Handle file upload
        uploaded_file = request.FILES['logo_pic']
        fs = FileSystemStorage()
        filename = fs.save(uploaded_file.name, uploaded_file)

        # Geocode the address to get latitude and longitude
        geocode_url = f'https://nominatim.openstreetmap.org/search?format=json&q={address}&limit=1'
        response = requests.get(geocode_url, headers={'User-Agent': 'Mozilla/5.0'})

        if response.status_code == 200:
            try:
                data = response.json()
                if data:
                    latitude = data[0]['lat']
                    longitude = data[0]['lon']

                    # Get the currently logged-in user
                    user = request.user

                    # Create a Restaurant instance and set its attributes
                    restaurant = Restaurant.objects.create(
                        user=user,  # Associate the restaurant with the user
                        restaurant_name=restaurant_name,
                        logo_pic=filename,
                        address=address,
                        mobile=mobile,
                        latitude=latitude,
                        longitude=longitude,
                        business_hours=business_hours
                    )

                    # Send email confirmation code to user
                    EmailConfirmation(request, user.username, user.email, user.password)  # Adjust based on your email handling

                    return render(request, 'accounts/email-verification-message.html')

                else:
                    messages.error(request, 'Could not geocode the address. Please enter a valid address.')
            except Exception as e:
                messages.error(request, f'Error: {e}')
        else:
            messages.error(request, 'Error fetching data from geocoding service.')

    return render(request, 'accounts/create_restaurant_profile.html')




def create_customer_profile(request):
    next_url = request.GET.get('next', '')
    
    if request.method == 'POST':
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        mobile = request.POST.get('mobile')
        
        try:
            user = request.user
            user.first_name = first_name
            user.last_name = last_name
            user.save()
            # Create or update the customer profile
            customer, created = Customer.objects.update_or_create(
                user=user,
                defaults={'mobile': mobile}
            )

            # If we have a next_url, process it for checkout
            if next_url:
                try:
                    # Parse the URL parts
                    parsed_url = urlparse(unquote(next_url))
                    path_parts = parsed_url.path.strip('/').split('/')

                    if 'dashboard' in path_parts and 'checkout' in path_parts:
                        dashboard_index = path_parts.index('dashboard')
                        if len(path_parts) > dashboard_index + 1:
                            restaurant_id = int(path_parts[dashboard_index + 1])
                            return redirect('restaurant_checkout', restaurant_id=restaurant_id)
                
                except Exception as e:
                    logger.error(f"Error processing next_url in profile creation: {e}")
            
            # If no next_url or processing failed, redirect to restaurant list
            return redirect('restaurant_list')
            
        except Exception as e:
            logger.error(f"Error creating customer profile: {e}")
            messages.error(request, 'An error occurred while creating your profile. Please try again.')
            
    return render(request, 'accounts/customer_profile.html', {'next': next_url})






@login_required
def welcome_page(request):
    customer = get_object_or_404(Customer, user=request.user)
    restaurant = customer.restaurant

    return render(request, 'accounts/welcome.html', {
        'user': request.user,
        'customer': customer,
        'restaurant': restaurant if restaurant else None,  # Handle None gracefully
    })



def signin_view(request):
    if request.method == 'POST':
        email = request.POST['email']
        password = request.POST['password'] 

        user = authenticate(email=email, password=password)

        if user is not None:
            if user.is_active:
                login(request, user)
                
                # Check if the user is a member of the 'Restaurant' group
                if user.groups.filter(name='Restaurant').exists():
                    return redirect('admin-dashboard')
                else:
                    # Handle other user types or roles here
                    return redirect('home')

            else:
                messages.error(request, 'Your account has been disabled')
        else:
            # Add validation errors for both email and password
            messages.error(request, 'Invalid login credentials')
            if not email:
                messages.error(request, 'Email is required')
            if not password:
                messages.error(request, 'Password is required')

    return render(request, 'accounts/signin.html')


def Logout(request):
    logout(request)
    return redirect('customer_signin')


def verify_restaurant_account(request):
    if request.method == 'POST':
        # Get the entered verification code from request.POST
        verified_code = request.POST.get('verified_code')

        # Get the confirmation code that has been sent
        config_code = ConfirmationCode.objects.filter(user=request.user).first()

        # Check if the entered code matches the sent code
        if verified_code == config_code.confirmed_code:
            # Create or update the VerifyConfirmation instance
            verify_confirmation, created = VerifyConfirmation.objects.get_or_create(user=request.user)
            verify_confirmation.verified_code = verified_code
            verify_confirmation.save()

            # Redirect to a success page or do whatever you want
            return render(request, 'accounts/verification_pass.html', {'verified_code': verified_code})
        else:
            return render(request, 'accounts/verify_account.html', {'error_message': 'Verification failed. Please check your email to verify the code'})

    return render(request, 'accounts/verification.html')







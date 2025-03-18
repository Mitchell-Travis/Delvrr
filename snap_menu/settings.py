# settings.py - Fix for static and media files

import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials
import dj_database_url
from decouple import config

# Path to your serviceAccountKey.json
FIREBASE_CREDENTIALS = "menu_dashboard/secrets/serviceAccountKey.json"

# Initialize Firebase Admin SDK
cred = credentials.Certificate(FIREBASE_CREDENTIALS)
firebase_admin.initialize_app(cred)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure--imqw09akhzp4l9k(-qvmxs2wi&#9@w@s)%kafewhcut)bsf*j'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False  # Set to False to use PostgreSQL

ALLOWED_HOSTS = [
    'localhost', 
    '172.20.10.3', 
    '127.0.0.1', 
    '[::1]', 
    '0.0.0.0',
    'delvrr.onrender.com',
    'www.delvrr.com',
    'delvrr.com'
]

# Your existing AUTH_USER_MODEL and AUTHENTICATION_BACKENDS settings...
AUTH_USER_MODEL = 'accounts.User'

# Backend for case insensitivity
AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',  # Default backend
    'accounts.backends.CaseInsensitiveModelBackend',  # Custom backend
    'allauth.account.auth_backends.AuthenticationBackend',
)

# Your existing INSTALLED_APPS...
INSTALLED_APPS = [
    'core.apps.CoreConfig',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'accounts',
    'menu_dashboard',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'allauth.socialaccount.providers.github'
]

# Fix middleware order - WhiteNoise must come after SecurityMiddleware
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Moved up, right after SecurityMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
    'django_user_agents.middleware.UserAgentMiddleware',
]

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'menu_dashboard.context_processors.get_active_notification',
            ],
            'libraries': {
                'custom_filters': 'menu_dashboard.templatetags.custom_filters',
            },
        },
    },
]

# Your existing settings for ROOT_URLCONF, TEMPLATES, WSGI_APPLICATION, SOCIALACCOUNT_PROVIDERS...
ROOT_URLCONF = 'snap_menu.urls'

# Database configuration - this will use PostgreSQL when DEBUG is False
if DEBUG:
    # Use SQLite locally
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    # Use PostgreSQL in production
    DATABASES = {
        'default': dj_database_url.parse(config('DATABASE_URL'))
    }

# Your existing AUTH_PASSWORD_VALIDATORS, internationalization settings...

# Static files configuration - consistent across development and production
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]

# Always use WhiteNoise for static files
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files configuration
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Your existing LOGIN_REDIRECT_URL, LOGIN_URL, DEFAULT_AUTO_FIELD...
LOGIN_REDIRECT_URL = '/afterlogin'
LOGIN_URL = '/customer_signin'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
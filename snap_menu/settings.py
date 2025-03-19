import os
from pathlib import Path
import dj_database_url
from decouple import config
import firebase_admin
from firebase_admin import credentials

BASE_DIR = Path(__file__).resolve().parent.parent

# Determine the environment
ENVIRONMENT = os.getenv("DJANGO_ENV", "development")

# Firebase Initialization (Optional)
FIREBASE_CREDENTIALS = BASE_DIR / "menu_dashboard/secrets/serviceAccountKey.json"
if os.path.exists(FIREBASE_CREDENTIALS):
    cred = credentials.Certificate(FIREBASE_CREDENTIALS)
    firebase_admin.initialize_app(cred)

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config("SECRET_KEY", default="your-default-secret-key")

# Debug Mode - Set to False in Production
DEBUG = ENVIRONMENT == "development"

# Allowed Hosts
ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "[::1]",
    "0.0.0.0",
    "delvrr.onrender.com",
    "www.delvrr.com",
    "delvrr.com",
    "172.20.10.3",  # Add this line
]


# Authentication
AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = (
    "django.contrib.auth.backends.ModelBackend",
    "accounts.backends.CaseInsensitiveModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
)

# Installed Apps
INSTALLED_APPS = [
    "core.apps.CoreConfig",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "accounts",
    "menu_dashboard",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.github",
]

# Middleware
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # For static files
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django_user_agents.middleware.UserAgentMiddleware",
]

# Templates
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "menu_dashboard.context_processors.get_active_notification",
            ],
            "libraries": {
                "custom_filters": "menu_dashboard.templatetags.custom_filters",
            },
        },
    },
]

# URL Config
ROOT_URLCONF = "snap_menu.urls"

# Database Configuration (Only PostgreSQL)
# Database Configuration
if ENVIRONMENT == "development":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": dj_database_url.config(
            default=config("DATABASE_URL", default="postgresql://postgres:postgres@localhost:5432/snapmenu")
        )
    }

# Static Files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media Files
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Authentication URLs
LOGIN_REDIRECT_URL = "/afterlogin"
LOGIN_URL = "/customer_signin"

# Default Auto Field
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

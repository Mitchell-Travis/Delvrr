from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from core.views import home

urlpatterns = [
    path("", home, name="home"),  # Root URL
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),  # Move accounts URLs under /accounts/
    path("core/", include("core.urls")),  # Move core URLs under /core/
    path("auth/", include("allauth.urls")),  # Move allauth URLs under /auth/
    path("menu/", include("menu_dashboard.urls")),
]

# Serve static files in production using WhiteNoise
if not settings.DEBUG:
    # Serve media files from Cloudinary CDN, no need for a local serve
    # Media is automatically served from Cloudinary using MEDIA_URL

    # Serve static files using WhiteNoise for production
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Serve static and media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

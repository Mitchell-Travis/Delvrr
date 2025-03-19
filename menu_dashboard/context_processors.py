from .models import Notification
from django.utils import timezone

def get_active_notification(request):
    # Check if user has dismissed the notification via cookie
    active_notifications = Notification.objects.filter(
        is_active=True,
        start_date__lte=timezone.now(),
        end_date__gte=timezone.now()
    )
    
    # Filter by restaurant if user is logged in and has a restaurant association
    if request.user.is_authenticated:
        try:
            # Adjust this based on how your user-restaurant relationship is structured
            restaurant = request.user.restaurant  # Assuming a one-to-one relationship
            
            # Get notifications for this restaurant or global notifications
            active_notifications = active_notifications.filter(
                models.Q(restaurants=restaurant) | models.Q(is_global=True)
            ).distinct().order_by('-start_date')
        except AttributeError:
            # If user doesn't have a restaurant, only show global notifications
            active_notifications = active_notifications.filter(is_global=True).order_by('-start_date')
    else:
        # For unauthenticated users, only show global notifications
        active_notifications = active_notifications.filter(is_global=True).order_by('-start_date')
    
    if active_notifications.exists():
        notification = active_notifications.first()
        cookie_name = f"notification_{notification.id}_closed"
        
        # If user hasn't closed this notification, show it
        if cookie_name not in request.COOKIES:
            return {'notification': notification}
    
    return {'notification': None}
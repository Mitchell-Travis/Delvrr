from .models import Notification
from django.utils import timezone
 
def get_active_notification(request):

     # Check if user has dismissed the notification via cookie
    active_notifications = Notification.objects.filter(
        is_active=True,
        start_date__lte=timezone.now(),
        end_date__gte=timezone.now()
    ).order_by('-start_date')
     
    if active_notifications.exists():
        notification = active_notifications.first()
        cookie_name = f"notification_{notification.id}_closed"
         
        # If user hasn't closed this notification, show it
        if cookie_name not in request.COOKIES:
            
            return {'notification': notification}
     
    return {'notification': None}
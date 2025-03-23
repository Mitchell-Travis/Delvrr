from django.utils import timezone
from django.db import models
from .models import Notification

def get_active_notification(request):
    print("Context processor called")  # Debug print

    # Base query for active notifications
    active_notifications = Notification.objects.filter(
        is_active=True,
        start_date__lte=timezone.now(),
        end_date__gte=timezone.now()
    )

    if request.user.is_authenticated:
        try:
            # Try to get the restaurant linked to the user
            current_restaurant = request.user.restaurant
            print(f"Found restaurant: {current_restaurant}")
        except Exception as e:
            print("No restaurant found for user, falling back to global notifications")
            current_restaurant = None

        if current_restaurant:
            active_notifications = active_notifications.filter(
                models.Q(send_to_all=True) | models.Q(restaurants=current_restaurant)
            )
        else:
            active_notifications = active_notifications.filter(send_to_all=True)
    else:
        print("User not authenticated, checking for global notifications")
        active_notifications = active_notifications.filter(send_to_all=True)

    active_notifications = active_notifications.order_by('-start_date').distinct()
    print(f"Found {active_notifications.count()} active notifications")

    if active_notifications.exists():
        notification = active_notifications.first()
        cookie_name = f"notification_{notification.id}_closed"

        # Only show the notification if the dismissal cookie is not present
        if cookie_name not in request.COOKIES:
            print(f"Returning notification: {notification.title}")
            return {'notification': notification}
        else:
            print("Notification was dismissed via cookie")

    return {'notification': None}
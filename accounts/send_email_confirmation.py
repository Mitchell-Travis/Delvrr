import string
import random
from accounts.models import User, ConfirmationCode
from django.core.mail import send_mail
from django.conf import settings

def EmailConfirmation(request, emailto, usrname, passwrd):
    chars = ''.join(string.digits)  # Characters of strings
    config_code = ''.join(random.choice(chars) for _ in range(6)).upper()
    save_code = ConfirmationCode.objects.filter(user=request.user).create(confirmed_code=config_code)
    save_code.user = request.user
    save_code.save()

    # Updated email content for Snap Menu
    subject = "Welcome To Snap Menu!"
    message = (
        f'Hello, {usrname},\n\n'
        f'Thank you for signing up on Snap Menu!\n\n'
        f'Username: {usrname}\n'
        f'Verification Code: {config_code}\n\n'
        f'About Snap Menu:\n\n'
        f'Snap Menu is a digital QR code menu system designed for restaurants. With Snap Menu, you can create and manage digital menus for your restaurant, making it easy for your customers to access your menu using their smartphones. Our platform offers a user-friendly experience for both restaurant owners and diners.\n\n'
        f'We hope Snap Menu helps streamline your restaurant operations. If you have any questions or need assistance, please don\'t hesitate to get in touch with us.\n\n'
        f'Contact Email: info@snapmenu.com\n\n'
        f'Best regards,\n'
        f'The Snap Menu Team'
    )

    send_mail(
        subject,
        message,
        settings.EMAIL_HOST_USER,
        [usrname], 
        fail_silently=False
    )

import logging
from django.conf import settings
from twilio.rest import Client

logger = logging.getLogger(__name__)

def format_phone_number(phone_number):
    if not phone_number.startswith('+'):
        phone_number = f'+{phone_number}'
    return phone_number

def send_sms(phone_number, message):
    account_sid = settings.TWILIO_ACCOUNT_SID
    auth_token = settings.TWILIO_AUTH_TOKEN
    twilio_phone_number = settings.TWILIO_PHONE_NUMBER

    client = Client(account_sid, auth_token)

    try:
        message = client.messages.create(
            body=message,
            from_=twilio_phone_number,
            to=format_phone_number(phone_number)
        )
        logger.info(f"SMS sent to {phone_number} with message: {message}")
        return True
    except Exception as e:
        logger.error(f"Error sending SMS to {phone_number} with message: {message}: {str(e)}")
        return False
        

def send_verification_code_to_phone_number(phone_number):
    account_sid = settings.TWILIO_ACCOUNT_SID
    auth_token = settings.TWILIO_AUTH_TOKEN
    verify_service_sid = settings.TWILIO_VERIFY_SERVICE_SID

    client = Client(account_sid, auth_token)

    try:
        formatted_phone_number = format_phone_number(phone_number)
        verification = client.verify \
            .v2 \
            .services(verify_service_sid) \
            .verifications \
            .create(to=formatted_phone_number, channel='sms')

        logger.info(f"Verification SID: {verification.sid}")
        return verification.sid
    except Exception as e:
        logger.error(f"Error sending verification code to {phone_number}: {str(e)}")
        return None

def verify_otp_code(phone_number, code):
    account_sid = settings.TWILIO_ACCOUNT_SID
    auth_token = settings.TWILIO_AUTH_TOKEN
    verify_service_sid = settings.TWILIO_VERIFY_SERVICE_SID

    client = Client(account_sid, auth_token)

    try:
        formatted_phone_number = format_phone_number(phone_number)
        verification_check = client.verify \
            .v2 \
            .services(verify_service_sid) \
            .verification_checks \
            .create(to=formatted_phone_number, code=code)

        return verification_check.status == "approved"
    except Exception as e:
        logger.error(f"Error verifying OTP for {phone_number}: {str(e)}")
        return False

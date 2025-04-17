from django import template
from decimal import Decimal, InvalidOperation

import base64
register = template.Library()


@register.filter
def get_default_price(variations, size="S"):
    """
    Returns the price (as Decimal) of the variation that matches the given size.
    If not found or price is invalid, returns None.
    """
    if not variations:
        return None

    for variation in variations:
        if getattr(variation, "name", None) == size:
            price = getattr(variation, "price", None)
            try:
                return Decimal(price)
            except (ValueError, TypeError, InvalidOperation):
                return None
    return None

@register.filter
def calculate_percentage(price, discount_percentage):
    """Calculate the discounted price if using percentage-based pricing."""
    try:
        discount = float(discount_percentage) / 100
        return round(float(price) * (1 - discount), 2)
    except (ValueError, TypeError):
        return price  # Return the original price if there's an erro


@register.filter
def thumb_url(image_field, size):
    width, height = size.split('x')
    # ... generate a resized version or URL ...
    return resized_url


@register.filter
def base64_encode(value):
    return base64.b64encode(value).decode('utf-8')



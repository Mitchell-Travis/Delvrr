from django import template

import base64
register = template.Library()


@register.filter
def get_default_price(variations, size="S"):
    """
    Iterates over the variations (QuerySet or list) and returns the price
    for the variation with the specified size. If not found, returns an empty string.
    """
    try:
        for variation in variations:
            if variation.name == size:
                return variation.price
    except Exception as e:
        # If variations is not iterable, log error or pass
        return ""
    return ""


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


    
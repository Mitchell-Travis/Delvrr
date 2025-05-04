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


@register.filter
def rgb_values(hex_color):
    """
    Turns "#RRGGBB" or "RRGGBB" (or 3-digit shorthand) into "R,G,B"
    """
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join([c*2 for c in hex_color])
    try:
        r, g, b = (int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    except ValueError:
        return ''
    return f"{r}, {g}, {b}"

@register.filter
def lighten(hex_color, percent):
    """
    Lightens a hex color by `percent` (0–100).
    """
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join(c*2 for c in hex_color)
    try:
        r, g, b = (int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    except ValueError:
        return ''
    def _light(c):
        return int(c + (255 - c) * (percent/100))
    lr, lg, lb = map(_light, (r, g, b))
    return "#{:02x}{:02x}{:02x}".format(lr, lg, lb)

@register.filter
def darken(hex_color, percent):
    """
    Darkens a hex color by `percent` (0–100).
    """
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join(c*2 for c in hex_color)
    try:
        r, g, b = (int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    except ValueError:
        return ''
    def _dark(c):
        return int(c * (1 - percent/100))
    dr, dg, db = map(_dark, (r, g, b))
    return "#{:02x}{:02x}{:02x}".format(dr, dg, db)

@register.filter
def is_light(hex_color):
    """
    Returns True if perceived brightness is above threshold.
    """
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join(c*2 for c in hex_color)
    try:
        r, g, b = (int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    except ValueError:
        return False
    # Perceived luminance
    lum = 0.2126*r + 0.7152*g + 0.0722*b
    return lum > 128



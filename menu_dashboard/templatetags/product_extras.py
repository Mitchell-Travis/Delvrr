from django import template
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
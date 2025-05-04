from django import template

register = template.Library()

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
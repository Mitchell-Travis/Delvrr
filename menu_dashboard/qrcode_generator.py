import logging
import qrcode
import hashlib
from qrcode.constants import ERROR_CORRECT_L
from django.utils.text import slugify
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)

def generate_qrcode(table):
    # Check if the restaurant is associated with the table
    if not table.restaurant:
        logger.error("No restaurant associated with the table.")
        return None, None  # Early return if no restaurant

    base_url = "https://delvrr.com/"
    restaurant_name_slug = slugify(table.restaurant.restaurant_name)
    
    # Use the restaurant's hashed_slug if available; otherwise, fallback
    if table.restaurant.hashed_slug:
        hashed_value = table.restaurant.hashed_slug
    else:
        hashed_value = hashlib.sha256(str(table.restaurant.id).encode('utf-8')).hexdigest()[:10]
    
    # Construct the URL with a trailing slash to match your URL pattern
    table_qrcode_url = f'{base_url}menu/{restaurant_name_slug}/{hashed_value}/'

    try:
        qr = qrcode.QRCode(
            version=None,
            error_correction=ERROR_CORRECT_L,
            box_size=15,
            border=4,
        )
        qr.add_data(table_qrcode_url)
        qr.make(fit=True)

        qr_image = qr.make_image(fill_color="green", back_color="white").convert('RGBA')

        # Check if the restaurant logo exists and overlay it on the QR code
        if table.restaurant.logo_pic:
            try:
                restaurant_logo_image_path = table.restaurant.logo_pic.path
                if restaurant_logo_image_path:  # Ensure the path is valid
                    restaurant_logo_image = Image.open(restaurant_logo_image_path).convert('RGBA')
                    qr_width, qr_height = qr_image.size
                    logo_image_size = qr_width // 8
                    logo_image = restaurant_logo_image.resize((logo_image_size, logo_image_size))
                    
                    # Create a transparent image and paste the QR code onto it
                    transparent = Image.new('RGBA', (qr_width, qr_height))
                    transparent.paste(qr_image, (0, 0))
                    
                    # Calculate the centered logo position
                    logo_position = (
                        (qr_width - logo_image_size) // 2,
                        (qr_height - logo_image_size) // 2,
                    )
                    
                    # Overlay the logo using its own mask for transparency
                    transparent.paste(logo_image, logo_position, logo_image)
                    qr_image = transparent
                else:
                    logger.warning("Restaurant logo path is None.")
            except Exception as e:
                logger.error(f"Error loading logo image: {e}")

        # Save the QR code to a buffer
        image_buffer = BytesIO()
        qr_image.save(image_buffer, format="PNG")
        image_buffer.seek(0)  # Reset buffer position

        image_filename = f"table_{table.table_number}_qrcode.png"
        return image_filename, image_buffer

    except Exception as e:
        logger.error(f"Error generating QR code: {e}")
        return None, None

from django.shortcuts import render, redirect, get_object_or_404, HttpResponse
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, authenticate
from accounts.models import User
from django.views.decorators.cache import cache_page
import logging

logger = logging.getLogger(__name__)

@cache_page(60 * 15)  # 15 minutes
def home(request):
	try:
		context = {
			'title': 'Delvrr - Smart Restaurant Ordering',
			'description': 'Order food online from your favorite restaurants',
		}
		return render(request, 'core/landing.html', context)
	except Exception as e:
		logger.error(f"Error rendering home page: {str(e)}")
		return HttpResponse("An error occurred while loading the page. Please try again later.", status=500)

def contact(request):
	try:
		context = {
			'title': 'Contact Us',
			'description': 'Get in touch with us',
		}
		return render(request, 'core/contact.html', context)
	except Exception as e:
		logger.error(f"Error rendering contact page: {str(e)}")
		return HttpResponse("An error occurred while loading the page. Please try again later.", status=500)












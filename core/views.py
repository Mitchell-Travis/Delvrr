from django.shortcuts import render, redirect, get_object_or_404, HttpResponse
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, authenticate
from accounts.models import User
from django.views.decorators.cache import cache_page






@cache_page(60 * 15)  # 15 minutes
def home(request):
	
	context = {

	}

	return render(request, 'core/landing.html', context)



def contact(request):
	
	context = {

	}

	return render(request, 'core/contact.html', context)












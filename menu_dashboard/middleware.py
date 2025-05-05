from django.utils.deprecation import MiddlewareMixin

class CacheControlMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        # Skip cache control for admin and auth paths
        if request.path.startswith('/admin/') or request.path.startswith('/auth/'):
            return response
            
        # Apply caching headers for static and media files
        if request.path.startswith('/static/') or request.path.startswith('/media/'):
            response['Cache-Control'] = 'public, max-age=31536000, immutable'
        return response
from locust import HttpUser, task, between

class MenuUser(HttpUser):
    wait_time = between(1, 3)  # Random wait time between requests to simulate user behavior

    @task
    def visit_menu_page(self):
        # The URL you want to test (The Pizza Bar menu page)
        self.client.get("/menu/the-pizza-bar/13384727548/")

    # Optional: You can add more tasks if you have specific product pages or other actions
    # @task
    # def visit_product(self):
    #     self.client.get("/menu/the-pizza-bar/13384727548/product/12345/")

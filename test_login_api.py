import requests

url = "http://localhost:8000/api/auth/login/"
payload = {
    "email": "admin@example.com",
    "password": "AdminPass123"
}
headers = {
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
print("Status Code:", response.status_code)
print("Response Body:", response.json())

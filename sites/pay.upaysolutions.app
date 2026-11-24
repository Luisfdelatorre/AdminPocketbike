server {
    listen 80;
    server_name pay.upaysolutions.app;

    client_max_body_size 20M;

    # Customer payment portal (/p/:id, /pay, /api internal proxy, /uploads) -> upay-pay (8187)
    location / {
        proxy_pass http://127.0.0.1:8187;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "keep-alive";
    }
}

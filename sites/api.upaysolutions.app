server {
    listen 80;
    server_name api.upaysolutions.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.upaysolutions.app;

    ssl_certificate /etc/letsencrypt/live/api.upaysolutions.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.upaysolutions.app/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20M;

    # Direct passthrough (/api/v1/..., /uploads/..., /health) -> upay-api (8184)
    location / {
        proxy_pass http://127.0.0.1:8184;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # SSE Support (Critical for real-time telemetry & alerts)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

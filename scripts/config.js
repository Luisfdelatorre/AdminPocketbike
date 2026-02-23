module.exports = {
    mongodb: {
        server: process.env.ME_MONGO_SERVER, // full URI works too in newer versions; if not, use below fields
        connectionString: process.env.ME_CONFIG_MONGODB_URL,
    },
    site: {
        port: process.env.PORT || 8081,
        baseUrl: "/",
        cookieSecret: process.env.ME_COOKIE_SECRET || "change_me",
        sessionSecret: process.env.ME_SESSION_SECRET || "change_me",
    },
    basicAuth: {
        username: process.env.ME_USER || "admin",
        password: process.env.ME_PASS || "admin123",
    },
};
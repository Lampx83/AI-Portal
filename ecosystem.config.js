module.exports = {
  apps: [
    {
      name: "research-web",
      script: "npm",
      args: "start",
      env: {
        POSTGRES_HOST: "10.2.13.200",
        POSTGRES_PORT: "8014",
        POSTGRES_DB: "research_db",
        POSTGRES_USER: "research_user",
        POSTGRES_PASSWORD: "xxxxxxx",
        POSTGRES_SSL: "false",
        NEXTAUTH_SECRET: "xxxxxxx",
        AZURE_AD_CLIENT_ID: "...",
        AZURE_AD_CLIENT_SECRET: "...",
        AZURE_AD_TENANT_ID: "...",
      }
    }
  ]
}

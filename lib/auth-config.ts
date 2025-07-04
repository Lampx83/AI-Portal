import type { Configuration, PopupRequest } from "@azure/msal-browser"

// Config object to be passed to Msal on creation
export const msalConfig: Configuration = {
  auth: {
    clientId: "3bf47dad-cc70-427a-bae0-a79bbf2ebec1",
    authority: "https://login.microsoftonline.com/7212a37c-41a9-4402-9f69-ac32c6f76e1a",
    redirectUri: "/", // Must be registered as a redirect URI in your Azure app registration
  },
  cache: {
    cacheLocation: "sessionStorage", // This is more secure than localStorage
    storeAuthStateInCookie: false,
  },
}

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
export const loginRequest: PopupRequest = {
  scopes: ["User.Read"],
}
